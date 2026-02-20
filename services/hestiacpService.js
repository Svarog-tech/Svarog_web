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
   * Volá HestiaCP API příkaz.
   * access_key a secret_key jsou vždy v POST body (application/x-www-form-urlencoded).
   *
   * @param {string} command - HestiaCP příkaz (např. 'v-add-user')
   * @param {Array} args - Argumenty příkazu
   * @param {{ returnCode?: boolean }} options - returnCode: true (default) = body je return code (0/1/3...); false = body je výstup příkazu (např. JSON)
   * @returns {Promise<{success: boolean, data?: any, error?: string}>}
   */
  async callAPI(command, args = [], options = {}) {
    const { returnCode = true } = options;

    try {
      const logger = require('../utils/logger');
      logger.debug(`[HestiaCP] Calling command: ${command}`, {
        argsCount: args.length,
        returnCode
      });

      const formData = new URLSearchParams();
      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
      };

      formData.append('access_key', this.accessKey);
      formData.append('secret_key', this.secretKey);

      if (returnCode) {
        formData.append('returncode', 'yes');
      }
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

      // SECURITY: Timeout zabraňuje visícím requestům při nedostupnosti HestiaCP
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      let response;
      try {
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: headers,
          body: formData.toString(),
          agent: agent,
          signal: controller.signal
        });
      } catch (err) {
        if (err.name === 'AbortError') {
          throw new Error(`HestiaCP API timeout po 30s: ${command}`);
        }
        throw err;
      } finally {
        clearTimeout(timeout);
      }

      const data = await response.text();
      const dataTrimmed = (data || '').trim();

      logger.debug(`[HestiaCP] Response received`, {
        command,
        status: response.status,
        responseLength: data.length,
        returnCodeMode: returnCode,
        bodyPreview: dataTrimmed.substring(0, 50)
      });

      if (returnCode) {
        // Při returncode=yes: body je číselný kód (0 = OK, jinak chyba).
        const isSuccess = dataTrimmed === '0';
        if (isSuccess) {
          try {
            const jsonData = JSON.parse(data);
            return { success: true, data: jsonData };
          } catch {
            return { success: true, data };
          }
        }
        // Pokud je to surový výpis adresáře (formát d|755|...), vrať obecnější chybu
        if (dataTrimmed && dataTrimmed.includes('|') && (dataTrimmed.startsWith('d|') || dataTrimmed.startsWith('f|'))) {
          return { success: false, error: 'HestiaCP API vrátilo neočekávaný formát odpovědi' };
        }
        return { success: false, error: dataTrimmed || data || 'Unknown error' };
      }

      // Bez returncode: body je výstup příkazu (např. JSON). Některé instalace vrací "0\n" + JSON.
      let toParse = (dataTrimmed || '').trim();
      if (toParse.startsWith('0\n') || toParse.startsWith('0\r\n')) {
        toParse = toParse.replace(/^0[\r\n]+/, '').trim();
      }
      try {
        const jsonData = JSON.parse(toParse || '{}');
        if (jsonData && typeof jsonData === 'object') {
          return { success: true, data: jsonData };
        }
      } catch {
        // ne-JSON výstup
      }
      return { success: false, error: dataTrimmed || 'Invalid or empty response' };
    } catch (error) {
      const logger = require('../utils/logger');
      logger.error('[HestiaCP] API call failed', {
        command,
        error: error.message,
        // NELOGOVAT stack trace v produkci (může obsahovat citlivé info)
        ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
      });
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
    // 6 bajtů = 12 hex znaků = 281 bilionů kombinací (snížení rizika kolize)
    const random = crypto.randomBytes(6).toString('hex');
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
   * Vrátí seznam dostupných HestiaCP balíčků z API (příkaz v-list-user-packages).
   * Volá API bez returncode, aby body obsahovalo JSON výstup; případně parsuje i "0" + JSON.
   * @returns {Promise<{success: boolean, packages?: string[], error?: string}>}
   */
  async listPackages() {
    // Bez returncode=yes: API vrací výstup příkazu (JSON) v body
    const result = await this.callAPI('v-list-user-packages', ['json'], { returnCode: false });
    if (result.success && result.data && typeof result.data === 'object') {
      const packageNames = Object.keys(result.data).filter(Boolean).sort();
      return { success: true, packages: packageNames };
    }
    // Fallback: tělo může být "0\n" + JSON (některé instalace)
    const raw = await this._callAPIRaw('v-list-user-packages', ['json'], false);
    if (raw.ok && raw.body) {
      const trimmed = String(raw.body).trim();
      const jsonStr = trimmed.startsWith('0\n') ? trimmed.slice(2).trim() : (trimmed === '0' ? '' : trimmed);
      if (jsonStr) {
        try {
          const data = JSON.parse(jsonStr);
          if (data && typeof data === 'object') {
            const packageNames = Object.keys(data).filter(Boolean).sort();
            return { success: true, packages: packageNames };
          }
        } catch {
          // ignore
        }
      }
    }
    return { success: false, error: result.error || raw.error || 'Failed to list HestiaCP packages' };
  }

  /**
   * Získá statistiky využití pro HestiaCP uživatele (disk, bandwidth, emaily, databáze atd.)
   * @param {string} username - HestiaCP username
   * @returns {Promise<{success: boolean, stats?: Object, error?: string}>}
   */
  async getUserStats(username) {
    const result = await this.callAPI('v-list-user-stats', [username, 'json'], { returnCode: false });
    if (result.success && result.data && typeof result.data === 'object') {
      const userData = result.data[username] || Object.values(result.data)[0];
      if (userData) {
        return {
          success: true,
          stats: {
            disk_used_mb: parseInt(userData.U_DISK || '0', 10),
            bandwidth_used_mb: parseInt(userData.U_BANDWIDTH || '0', 10),
            web_domains: parseInt(userData.U_WEB_DOMAINS || '0', 10),
            mail_accounts: parseInt(userData.U_MAIL_ACCOUNTS || '0', 10),
            databases: parseInt(userData.U_DATABASES || '0', 10),
          }
        };
      }
    }
    // Fallback: "0\n" + JSON
    const raw = await this._callAPIRaw('v-list-user-stats', [username, 'json'], false);
    if (raw.ok && raw.body) {
      const trimmed = String(raw.body).trim();
      const jsonStr = trimmed.startsWith('0\n') ? trimmed.slice(2).trim() : (trimmed === '0' ? '' : trimmed);
      if (jsonStr) {
        try {
          const data = JSON.parse(jsonStr);
          const userData = data[username] || Object.values(data)[0];
          if (userData) {
            return {
              success: true,
              stats: {
                disk_used_mb: parseInt(userData.U_DISK || '0', 10),
                bandwidth_used_mb: parseInt(userData.U_BANDWIDTH || '0', 10),
                web_domains: parseInt(userData.U_WEB_DOMAINS || '0', 10),
                mail_accounts: parseInt(userData.U_MAIL_ACCOUNTS || '0', 10),
                databases: parseInt(userData.U_DATABASES || '0', 10),
              }
            };
          }
        } catch { /* ignore */ }
      }
    }
    return { success: false, error: 'Failed to get user stats' };
  }

  /**
   * Získá informace o HestiaCP uživateli (limity balíčku, stav suspendace atd.)
   * @param {string} username - HestiaCP username
   * @returns {Promise<{success: boolean, user?: Object, error?: string}>}
   */
  async getUserInfo(username) {
    const result = await this.callAPI('v-list-user', [username, 'json'], { returnCode: false });
    if (result.success && result.data && typeof result.data === 'object') {
      const userData = result.data[username] || Object.values(result.data)[0];
      if (userData) {
        return {
          success: true,
          user: this._parseUserInfo(userData)
        };
      }
    }
    // Fallback
    const raw = await this._callAPIRaw('v-list-user', [username, 'json'], false);
    if (raw.ok && raw.body) {
      const trimmed = String(raw.body).trim();
      const jsonStr = trimmed.startsWith('0\n') ? trimmed.slice(2).trim() : (trimmed === '0' ? '' : trimmed);
      if (jsonStr) {
        try {
          const data = JSON.parse(jsonStr);
          const userData = data[username] || Object.values(data)[0];
          if (userData) {
            return {
              success: true,
              user: this._parseUserInfo(userData)
            };
          }
        } catch { /* ignore */ }
      }
    }
    return { success: false, error: 'Failed to get user info' };
  }

  /**
   * Parsuje surová data z v-list-user do normalizovaného formátu
   */
  _parseUserInfo(userData) {
    const parseLimit = (val) => {
      if (!val || val === 'unlimited') return 'unlimited';
      const num = parseInt(val, 10);
      return isNaN(num) ? 'unlimited' : num;
    };
    return {
      package: userData.PACKAGE || 'default',
      disk_quota_mb: parseLimit(userData.DISK_QUOTA),
      bandwidth_limit_mb: parseLimit(userData.BANDWIDTH),
      databases_limit: parseLimit(userData.DATABASES),
      mail_accounts_limit: parseLimit(userData.MAIL_ACCOUNTS),
      web_domains_limit: parseLimit(userData.WEB_DOMAINS),
      suspended: userData.SUSPENDED === 'yes',
      ip_addresses: userData.IP_OWNED || '',
    };
  }

  // ============================================
  // FILE SYSTEM OPERATIONS
  // ============================================

  /**
   * Vypíše obsah adresáře
   * @param {string} username - HestiaCP username
   * @param {string} dirPath - Cesta k adresáři
   * @returns {Promise<{success: boolean, entries?: Array, error?: string}>}
   */
  async listDirectory(username, dirPath) {
    const result = await this.callAPI('v-list-fs-directory', [username, dirPath, 'json'], { returnCode: false });
    if (result.success && result.data && typeof result.data === 'object') {
      const entries = Object.entries(result.data).map(([name, info]) => ({
        name,
        type: info.TYPE === 'd' ? 'directory' : 'file',
        size: parseInt(info.SIZE || '0', 10),
        permissions: info.PERMISSIONS || '0644',
        owner: info.OWNER || username,
        group: info.GROUP || username,
        modified: `${info.DATE || ''} ${info.TIME || ''}`.trim(),
      }));
      return { success: true, entries };
    }
    // Fallback - zkus raw response
    const raw = await this._callAPIRaw('v-list-fs-directory', [username, dirPath, 'json'], false);
    if (raw.ok && raw.body) {
      const trimmed = String(raw.body).trim();
      const jsonStr = trimmed.startsWith('0\n') ? trimmed.slice(2).trim() : (trimmed === '0' ? '' : trimmed);
      
      // Zkus parsovat jako JSON
      if (jsonStr) {
        try {
          const data = JSON.parse(jsonStr);
          const entries = Object.entries(data).map(([name, info]) => ({
            name,
            type: info.TYPE === 'd' ? 'directory' : 'file',
            size: parseInt(info.SIZE || '0', 10),
            permissions: info.PERMISSIONS || '0644',
            owner: info.OWNER || username,
            group: info.GROUP || username,
            modified: `${info.DATE || ''} ${info.TIME || ''}`.trim(),
          }));
          return { success: true, entries };
        } catch { /* ignore JSON parse error */ }
      }
      
      // Pokud JSON selhal, zkus parsovat surový textový formát
      // Formát: d|755|2026-02-10|22:10|owner|group|4096|filename
      // nebo: f|644|2024-03-31|10:41|owner|group|3771|filename
      if (trimmed && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        try {
          const lines = trimmed.split(/\s+/).filter(line => line.trim());
          const entries = [];
          
          for (const line of lines) {
            const parts = line.split('|');
            if (parts.length >= 8) {
              const [typeChar, permissions, date, time, owner, group, sizeStr, ...nameParts] = parts;
              const name = nameParts.join('|'); // Název může obsahovat |
              
              entries.push({
                name: name || parts[parts.length - 1], // Fallback na poslední část
                type: typeChar === 'd' ? 'directory' : 'file',
                size: parseInt(sizeStr || '0', 10),
                permissions: permissions || '0644',
                owner: owner || username,
                group: group || username,
                modified: `${date || ''} ${time || ''}`.trim(),
              });
            }
          }
          
          if (entries.length > 0) {
            return { success: true, entries };
          }
        } catch (parseError) {
          // Ignore parse error, fall through to error return
        }
      }
    }
    
    // Pokud všechno selhalo, vrať chybu bez surového výpisu
    return { success: false, error: 'Nepodařilo se načíst obsah adresáře' };
  }

  /**
   * Přečte obsah souboru
   * @param {string} username - HestiaCP username
   * @param {string} filePath - Cesta k souboru
   * @returns {Promise<{success: boolean, content?: string, error?: string}>}
   */
  async readFile(username, filePath) {
    const raw = await this._callAPIRaw('v-open-fs-file', [username, filePath], false);
    if (raw.ok && raw.body !== null) {
      let content = String(raw.body);
      // Odstraň prefix "0\n" pokud existuje
      if (content.startsWith('0\n')) {
        content = content.slice(2);
      } else if (content.startsWith('0\r\n')) {
        content = content.slice(3);
      }
      return { success: true, content };
    }
    return { success: false, error: raw.error || 'Failed to read file' };
  }

  /**
   * Vytvoří prázdný soubor
   * @param {string} username
   * @param {string} filePath
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async createFile(username, filePath) {
    const result = await this.callAPI('v-add-fs-file', [username, filePath]);
    return result;
  }

  /**
   * Vytvoří adresář
   * @param {string} username
   * @param {string} dirPath
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async createDirectory(username, dirPath) {
    const result = await this.callAPI('v-add-fs-directory', [username, dirPath]);
    return result;
  }

  /**
   * Smaže soubor
   * @param {string} username
   * @param {string} filePath
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteFile(username, filePath) {
    const result = await this.callAPI('v-delete-fs-file', [username, filePath]);
    return result;
  }

  /**
   * Smaže adresář
   * @param {string} username
   * @param {string} dirPath
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteDirectory(username, dirPath) {
    const result = await this.callAPI('v-delete-fs-directory', [username, dirPath]);
    return result;
  }

  /**
   * Přesune/přejmenuje soubor nebo adresář
   * @param {string} username
   * @param {string} fromPath
   * @param {string} toPath
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async moveFile(username, fromPath, toPath) {
    const result = await this.callAPI('v-move-fs-file', [username, fromPath, toPath]);
    return result;
  }

  /**
   * Zkopíruje soubor
   * @param {string} username
   * @param {string} fromPath
   * @param {string} toPath
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async copyFile(username, fromPath, toPath) {
    const result = await this.callAPI('v-copy-fs-file', [username, fromPath, toPath]);
    return result;
  }

  /**
   * Změní oprávnění souboru/adresáře
   * @param {string} username
   * @param {string} filePath
   * @param {string} permissions - Octal string, např. '0755'
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async changePermissions(username, filePath, permissions) {
    const result = await this.callAPI('v-change-fs-file-permission', [username, filePath, permissions]);
    return result;
  }

  /**
   * Interní: volá API a vrací surovou odpověď { ok, body, error } (pro listPackages fallback).
   */
  async _callAPIRaw(command, args = [], useReturnCode = true) {
    try {
      const formData = new URLSearchParams();
      formData.append('access_key', this.accessKey);
      formData.append('secret_key', this.secretKey);
      if (useReturnCode) formData.append('returncode', 'yes');
      formData.append('cmd', command);
      args.forEach((arg, i) => {
        if (arg != null) formData.append(`arg${i + 1}`, String(arg));
      });
      const https = require('https');
      const agent = new https.Agent({ rejectUnauthorized: process.env.NODE_ENV === 'production' });
      let apiUrl = this.url;
      if (!apiUrl.endsWith('/api/') && !apiUrl.endsWith('/api')) {
        apiUrl = apiUrl.endsWith('/') ? `${apiUrl}api/` : `${apiUrl}/api/`;
      }
      // SECURITY: Timeout zabraňuje visícím requestům
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      let response;
      try {
        response = await require('node-fetch')(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
          agent,
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }
      const body = await response.text();
      return { ok: response.ok, body, error: response.ok ? null : (body || 'Request failed') };
    } catch (e) {
      return { ok: false, body: null, error: e.message };
    }
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

      // Zkontroluj jestli uživatel už neexistuje – pak jen potvrdíme účet (pro propojení s profilem)
      if (await this.userExists(user)) {
        console.log(`[HestiaCP] User ${user} already exists – linking to profile`);
        return {
          success: true,
          username: user,
          alreadyExists: true,
          package: packageName
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
