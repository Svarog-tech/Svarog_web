/**
 * HestiaCP Service
 * Handles automatic creation of hosting accounts via HestiaCP REST API
 */

const fetch = require('node-fetch');
const crypto = require('crypto');

class HestiaCP {
  constructor() {
    this.url = process.env.HESTIACP_URL;
    this.username = process.env.HESTIACP_USERNAME;
    this.accessKey = process.env.HESTIACP_ACCESS_KEY;
    this.secretKey = process.env.HESTIACP_SECRET_KEY;
    this.serverIp = process.env.HESTIACP_SERVER_IP;
    this.defaultPackage = process.env.HESTIACP_DEFAULT_PACKAGE || 'default';
  }

  /**
   * Generuje hash pro HestiaCP API autentizaci (stará metoda)
   */
  getAuthHash() {
    return `${this.accessKey}:${this.secretKey}`;
  }

  /**
   * Volá HestiaCP API příkaz
   * Podporuje 3 metody autentizace:
   * 1. Hash parametr (stará metoda): hash=ACCESS_KEY:SECRET_KEY
   * 2. POST parametry: access_key_id + secret_access_key
   * 3. Headers (doporučeno): x-access-key-id + x-secret-access-key
   * 
   * @param {string} command - HestiaCP příkaz (např. 'v-add-user')
   * @param {Array} args - Argumenty příkazu
   * @param {string} authMethod - Metoda autentizace: 'hash', 'params', 'headers' (default: 'headers')
   * @returns {Promise<{success: boolean, data?: any, error?: string}>}
   */
  async callAPI(command, args = [], authMethod = 'headers') {
    try {
      console.log(`[HestiaCP] Calling command: ${command}`, args, `(auth: ${authMethod})`);

      const formData = new URLSearchParams();
      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
      };

      // Metoda 3: Headers (doporučeno) - nejbezpečnější
      if (authMethod === 'headers') {
        headers['x-access-key-id'] = this.accessKey;
        headers['x-secret-access-key'] = this.secretKey;
      }
      // Metoda 2: POST parametry
      else if (authMethod === 'params') {
        formData.append('access_key_id', this.accessKey);
        formData.append('secret_access_key', this.secretKey);
      }
      // Metoda 1: Hash parametr (stará metoda, fallback)
      else {
        formData.append('hash', this.getAuthHash());
      }

      formData.append('returncode', 'yes');
      formData.append('cmd', command);

      // Přidej argumenty
      args.forEach((arg, index) => {
        if (arg !== null && arg !== undefined) {
          formData.append(`arg${index + 1}`, String(arg));
        }
      });

      // SECURITY: SSL certificate validation
      // V produkci VŽDY validovat certifikáty, v developmentu můžem ignorovat pro self-signed certs
      const https = require('https');
      const agent = new https.Agent({
        rejectUnauthorized: process.env.NODE_ENV === 'production' // true v produkci, false v development
      });

      // Zajisti že URL končí správně (buď už má /api/ nebo přidáme)
      let apiUrl = this.url;
      if (!apiUrl.endsWith('/api/') && !apiUrl.endsWith('/api')) {
        apiUrl = apiUrl.endsWith('/') ? `${apiUrl}api/` : `${apiUrl}/api/`;
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: formData.toString(),
        agent: agent
      });

      const data = await response.text();
      console.log(`[HestiaCP] Response: ${data.substring(0, 200)}...`); // Log jen prvních 200 znaků

      // HestiaCP vrací 0 pro success, jinak error code nebo error message
      // JSON odpověď může být také validní
      if (data === '0' || data === '' || response.ok) {
        // Zkus parsovat jako JSON pokud to vypadá jako JSON
        try {
          const jsonData = JSON.parse(data);
          return { success: true, data: jsonData };
        } catch {
          return { success: true, data };
        }
      } else {
        return { success: false, error: data };
      }
    } catch (error) {
      console.error('[HestiaCP] API call failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generuje náhodné uživatelské jméno
   * @param {string} email - Email uživatele
   * @returns {string}
   */
  generateUsername(email) {
    const prefix = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const random = crypto.randomBytes(3).toString('hex');
    return `${prefix.substring(0, 5)}${random}`;
  }

  /**
   * Generuje náhodné heslo
   * @returns {string}
   */
  generatePassword() {
    return crypto.randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  /**
   * Zkontroluje zda uživatel existuje
   * @param {string} username - HestiaCP username
   * @returns {Promise<boolean>}
   */
  async userExists(username) {
    const result = await this.callAPI('v-list-user', [username]);
    return result.success;
  }

  /**
   * Zkontroluje zda doména existuje
   * @param {string} username - HestiaCP username
   * @param {string} domain - Doména
   * @returns {Promise<boolean>}
   */
  async domainExists(username, domain) {
    const result = await this.callAPI('v-list-web-domain', [username, domain]);
    return result.success;
  }

  /**
   * Vytvoří nového uživatele v HestiaCP
   * @param {Object} params
   * @param {string} params.email - Email uživatele
   * @param {string} params.username - Volitelné - custom username
   * @param {string} params.password - Volitelné - custom heslo
   * @param {string} params.package - Volitelné - HestiaCP package (default: 'default')
   * @returns {Promise<{success: boolean, username?: string, password?: string, error?: string}>}
   */
  async createUser({ email, username, password, package: pkg }) {
    try {
      // Generuj username a password pokud nejsou poskytnuty
      const user = username || this.generateUsername(email);
      const pass = password || this.generatePassword();
      const packageName = pkg || this.defaultPackage;

      console.log(`[HestiaCP] Creating user: ${user}`);

      // Zkontroluj jestli uživatel už neexistuje
      if (await this.userExists(user)) {
        console.log(`[HestiaCP] User ${user} already exists`);
        return {
          success: false,
          error: `User ${user} already exists`
        };
      }

      // Vytvoř uživatele
      // v-add-user <username> <password> <email> [package] [first_name] [last_name]
      const result = await this.callAPI('v-add-user', [
        user,
        pass,
        email,
        packageName
      ]);

      if (!result.success) {
        return {
          success: false,
          error: result.error
        };
      }

      return {
        success: true,
        username: user,
        password: pass,
        package: packageName
      };
    } catch (error) {
      console.error('[HestiaCP] Error creating user:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Vytvoří web doménu pro uživatele
   * @param {Object} params
   * @param {string} params.username - HestiaCP username
   * @param {string} params.domain - Doména
   * @param {string} params.ip - Volitelné - IP adresa (default: server IP)
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async createWebDomain({ username, domain, ip }) {
    try {
      const serverIp = ip || this.serverIp;

      console.log(`[HestiaCP] Creating web domain: ${domain} for user ${username}`);

      // Zkontroluj jestli doména už neexistuje
      if (await this.domainExists(username, domain)) {
        console.log(`[HestiaCP] Domain ${domain} already exists for user ${username}`);
        return {
          success: true, // Není to chyba, doména už existuje
          message: `Domain ${domain} already exists`
        };
      }

      // Vytvoř web doménu
      // v-add-web-domain <username> <domain> [ip] [restart]
      const result = await this.callAPI('v-add-web-domain', [
        username,
        domain,
        serverIp,
        'yes' // restart nginx
      ]);

      if (!result.success) {
        return {
          success: false,
          error: result.error
        };
      }

      return {
        success: true,
        domain,
        ip: serverIp
      };
    } catch (error) {
      console.error('[HestiaCP] Error creating web domain:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Nastaví SSL certifikát (Let's Encrypt) pro doménu
   * @param {Object} params
   * @param {string} params.username - HestiaCP username
   * @param {string} params.domain - Doména
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async setupSSL({ username, domain }) {
    try {
      console.log(`[HestiaCP] Setting up SSL for: ${domain}`);

      // v-add-letsencrypt-domain <username> <domain> [aliases]
      const result = await this.callAPI('v-add-letsencrypt-domain', [
        username,
        domain,
        `www.${domain}` // Přidej www alias
      ]);

      if (!result.success) {
        // SSL setup může selhat pokud doména ještě není namířená na server
        // To není kritická chyba
        console.warn(`[HestiaCP] SSL setup failed (this is OK if domain DNS is not ready yet): ${result.error}`);
        return {
          success: false,
          error: result.error,
          warning: 'SSL will be available once domain DNS is properly configured'
        };
      }

      return {
        success: true
      };
    } catch (error) {
      console.error('[HestiaCP] Error setting up SSL:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Vytvoří kompletní hosting účet (uživatel + doména + SSL)
   * @param {Object} params
   * @param {string} params.email - Email uživatele
   * @param {string} params.domain - Doména
   * @param {string} params.package - Volitelné - HestiaCP package
   * @param {string} params.username - Volitelné - custom username
   * @param {string} params.password - Volitelné - custom password
   * @returns {Promise<{success: boolean, username?: string, password?: string, domain?: string, cpanelUrl?: string, error?: string}>}
   */
  async createHostingAccount({ email, domain, package: pkg, username, password }) {
    try {
      console.log(`[HestiaCP] Creating complete hosting account for: ${email}, domain: ${domain}`);

      // 1. Vytvoř uživatele
      const userResult = await this.createUser({
        email,
        username,
        password,
        package: pkg
      });

      if (!userResult.success) {
        return {
          success: false,
          error: `Failed to create user: ${userResult.error}`
        };
      }

      const createdUsername = userResult.username;
      const createdPassword = userResult.password;

      // 2. Vytvoř web doménu
      const domainResult = await this.createWebDomain({
        username: createdUsername,
        domain
      });

      if (!domainResult.success) {
        // Pokud se nepodařilo vytvořit doménu, zkus smazat uživatele
        await this.callAPI('v-delete-user', [createdUsername]);
        return {
          success: false,
          error: `Failed to create domain: ${domainResult.error}`
        };
      }

      // 3. Zkus nastavit SSL (není kritické pokud selže)
      await this.setupSSL({
        username: createdUsername,
        domain
      });

      // 4. Vygeneruj URL pro control panel
      const cpanelUrl = `${this.url}/login/?user=${createdUsername}`;

      return {
        success: true,
        username: createdUsername,
        password: createdPassword,
        domain,
        cpanelUrl,
        package: pkg || this.defaultPackage
      };
    } catch (error) {
      console.error('[HestiaCP] Error creating hosting account:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Smaže uživatele (včetně všech domén a dat)
   * @param {string} username - HestiaCP username
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteUser(username) {
    try {
      console.log(`[HestiaCP] Deleting user: ${username}`);

      const result = await this.callAPI('v-delete-user', [username, 'yes']);

      if (!result.success) {
        return {
          success: false,
          error: result.error
        };
      }

      return { success: true };
    } catch (error) {
      console.error('[HestiaCP] Error deleting user:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Suspenduje uživatele
   * @param {string} username - HestiaCP username
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async suspendUser(username) {
    try {
      console.log(`[HestiaCP] Suspending user: ${username}`);

      const result = await this.callAPI('v-suspend-user', [username, 'yes']);

      if (!result.success) {
        return {
          success: false,
          error: result.error
        };
      }

      return { success: true };
    } catch (error) {
      console.error('[HestiaCP] Error suspending user:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Unsuspenduje uživatele
   * @param {string} username - HestiaCP username
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async unsuspendUser(username) {
    try {
      console.log(`[HestiaCP] Unsuspending user: ${username}`);

      const result = await this.callAPI('v-unsuspend-user', [username, 'yes']);

      if (!result.success) {
        return {
          success: false,
          error: result.error
        };
      }

      return { success: true };
    } catch (error) {
      console.error('[HestiaCP] Error unsuspending user:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Singleton instance
const hestiacp = new HestiaCP();

module.exports = hestiacp;
