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
   * Seznam všech HestiaCP uživatelů s jejich statistikami.
   * Volá v-list-users json.
   */
  async listUsers() {
    const parseUsersObject = (data) => {
      if (!data || typeof data !== 'object') return null;
      return Object.entries(data).map(([username, info]) => ({
        username,
        email: info.CONTACT || '',
        package: info.PACKAGE || 'default',
        web_domains: parseInt(info.U_WEB_DOMAINS || '0', 10),
        dns_domains: parseInt(info.U_DNS_DOMAINS || '0', 10),
        mail_domains: parseInt(info.U_MAIL_DOMAINS || '0', 10),
        databases: parseInt(info.U_DATABASES || '0', 10),
        disk_used_mb: parseInt(info.U_DISK || '0', 10),
        disk_quota_mb: info.DISK_QUOTA === 'unlimited' ? 'unlimited' : parseInt(info.DISK_QUOTA || '0', 10),
        bandwidth_used_mb: parseInt(info.U_BANDWIDTH || '0', 10),
        bandwidth_limit_mb: info.BANDWIDTH === 'unlimited' ? 'unlimited' : parseInt(info.BANDWIDTH || '0', 10),
        suspended: info.SUSPENDED === 'yes',
        ip_addresses: info.IP_OWNED || '',
        creation_date: info.DATE || '',
      }));
    };

    const result = await this.callAPI('v-list-users', ['json'], { returnCode: false });
    if (result.success && result.data) {
      const users = parseUsersObject(result.data);
      if (users) return { success: true, users };
    }
    const raw = await this._callAPIRaw('v-list-users', ['json'], false);
    if (raw.ok && raw.body) {
      const trimmed = String(raw.body).trim();
      const jsonStr = trimmed.startsWith('0\n') ? trimmed.slice(2).trim() : (trimmed === '0' ? '' : trimmed);
      if (jsonStr) {
        try {
          const users = parseUsersObject(JSON.parse(jsonStr));
          if (users) return { success: true, users };
        } catch { /* ignore */ }
      }
    }
    return { success: false, error: result.error || 'Failed to list HestiaCP users' };
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
   * SECURITY: Bezpečný zápis obsahu do souboru.
   * Validuje base64 obsah a shell-safe quotuje cestu. Veškerá sanitizace je zde,
   * volající nemusí řešit shell escaping.
   * @param {string} username - HestiaCP username
   * @param {string} filePath - Cílová cesta k souboru (již sanitizovaná)
   * @param {Buffer} contentBuffer - Obsah souboru jako Buffer
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async writeFileContent(username, filePath, contentBuffer) {
    // SECURITY: Validace username — pouze alfanumerické + underscore/dash
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return { success: false, error: 'Invalid username format' };
    }

    // SECURITY: Validace filePath — nesmí obsahovat null bytes nebo ..
    if (filePath.includes('\0') || filePath.includes('..')) {
      return { success: false, error: 'Invalid file path' };
    }

    // Base64 encode
    const base64 = contentBuffer.toString('base64');

    // SECURITY: Validace base64 — smí obsahovat POUZE [A-Za-z0-9+/=]
    // Tato validace zaručuje že obsah nemůže být zneužit pro shell injection
    if (!/^[A-Za-z0-9+/=]*$/.test(base64)) {
      return { success: false, error: 'Internal encoding error' };
    }

    // SECURITY: Shell-safe path quoting — single quotes + escape apostrofů uvnitř
    const shellSafePath = "'" + filePath.replace(/'/g, "'\\''") + "'";

    // SECURITY: printf + validated base64 + quoted path
    // base64 je bezpečný (jen [A-Za-z0-9+/=]), cesta je single-quote quotovaná
    const result = await this.callAPI('v-run-cmd', [
      username,
      `printf '%s' '${base64}' | base64 -d > ${shellSafePath}`
    ]);

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

  // ============================================
  // EMAIL MANAGEMENT
  // ============================================

  /**
   * Seznam email domén pro uživatele
   * @param {string} username - HestiaCP username
   * @returns {Promise<{success: boolean, domains?: string[], error?: string}>}
   */
  async listMailDomains(username) {
    try {
      const result = await this.callAPI('v-list-mail-domains', [username, 'json'], { returnCode: false });
      if (result.success && result.data && typeof result.data === 'object') {
        const domains = Object.keys(result.data).filter(Boolean).sort();
        return { success: true, domains };
      }
      // Fallback
      const raw = await this._callAPIRaw('v-list-mail-domains', [username, 'json'], false);
      if (raw.ok && raw.body) {
        const trimmed = String(raw.body).trim();
        const jsonStr = trimmed.startsWith('0\n') ? trimmed.slice(2).trim() : (trimmed === '0' ? '' : trimmed);
        if (jsonStr) {
          try {
            const data = JSON.parse(jsonStr);
            const domains = Object.keys(data).filter(Boolean).sort();
            return { success: true, domains };
          } catch { /* ignore */ }
        }
      }
      return { success: false, error: 'Failed to list mail domains' };
    } catch (error) {
      console.error('[HestiaCP] Error listing mail domains:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Seznam email účtů pro doménu
   * @param {string} username - HestiaCP username
   * @param {string} domain - Email doména
   * @returns {Promise<{success: boolean, accounts?: Array, error?: string}>}
   */
  async listMailAccounts(username, domain) {
    try {
      const result = await this.callAPI('v-list-mail-accounts', [username, domain, 'json'], { returnCode: false });
      if (result.success && result.data && typeof result.data === 'object') {
        const accounts = Object.entries(result.data).map(([email, info]) => ({
          email: email.includes('@') ? email : `${email}@${domain}`,
          quota_used: parseInt(info.U_DISK || '0', 10),
          quota_limit: parseInt(info.QUOTA || '0', 10),
          suspended: info.SUSPENDED === 'yes',
        }));
        return { success: true, accounts };
      }
      // Fallback
      const raw = await this._callAPIRaw('v-list-mail-accounts', [username, domain, 'json'], false);
      if (raw.ok && raw.body) {
        const trimmed = String(raw.body).trim();
        const jsonStr = trimmed.startsWith('0\n') ? trimmed.slice(2).trim() : (trimmed === '0' ? '' : trimmed);
        if (jsonStr) {
          try {
            const data = JSON.parse(jsonStr);
            const accounts = Object.entries(data).map(([email, info]) => ({
              email: email.includes('@') ? email : `${email}@${domain}`,
              quota_used: parseInt(info.U_DISK || '0', 10),
              quota_limit: parseInt(info.QUOTA || '0', 10),
              suspended: info.SUSPENDED === 'yes',
            }));
            return { success: true, accounts };
          } catch { /* ignore */ }
        }
      }
      return { success: false, error: 'Failed to list mail accounts' };
    } catch (error) {
      console.error('[HestiaCP] Error listing mail accounts:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Vytvoření email účtu
   * @param {string} username - HestiaCP username
   * @param {string} domain - Email doména
   * @param {string} email - Email adresa (bez @domain)
   * @param {string} password - Heslo
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async createMailAccount(username, domain, email, password) {
    try {
      // Odstraň @domain pokud je v emailu
      const emailLocal = email.includes('@') ? email.split('@')[0] : email;
      
      const result = await this.callAPI('v-add-mail-account', [username, domain, emailLocal, password]);
      return result;
    } catch (error) {
      console.error('[HestiaCP] Error creating mail account:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Smazání email účtu
   * @param {string} username - HestiaCP username
   * @param {string} domain - Email doména
   * @param {string} email - Email adresa (bez @domain)
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteMailAccount(username, domain, email) {
    try {
      // Odstraň @domain pokud je v emailu
      const emailLocal = email.includes('@') ? email.split('@')[0] : email;
      
      const result = await this.callAPI('v-delete-mail-account', [username, domain, emailLocal]);
      return result;
    } catch (error) {
      console.error('[HestiaCP] Error deleting mail account:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Změna hesla email účtu
   * @param {string} username - HestiaCP username
   * @param {string} domain - Email doména
   * @param {string} email - Email adresa (bez @domain)
   * @param {string} password - Nové heslo
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async changeMailAccountPassword(username, domain, email, password) {
    try {
      // Odstraň @domain pokud je v emailu
      const emailLocal = email.includes('@') ? email.split('@')[0] : email;
      
      const result = await this.callAPI('v-change-mail-account-password', [username, domain, emailLocal, password]);
      return result;
    } catch (error) {
      console.error('[HestiaCP] Error changing mail account password:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Quota email účtu
   * @param {string} username - HestiaCP username
   * @param {string} domain - Email doména
   * @param {string} email - Email adresa (bez @domain)
   * @returns {Promise<{success: boolean, quota?: Object, error?: string}>}
   */
  async getMailAccountQuota(username, domain, email) {
    try {
      const emailLocal = email.includes('@') ? email.split('@')[0] : email;
      
      const result = await this.callAPI('v-list-mail-account-quota', [username, domain, emailLocal, 'json'], { returnCode: false });
      if (result.success && result.data) {
        return {
          success: true,
          quota: {
            used: parseInt(result.data.U_DISK || '0', 10),
            limit: parseInt(result.data.QUOTA || '0', 10),
          }
        };
      }
      return { success: false, error: 'Failed to get mail account quota' };
    } catch (error) {
      console.error('[HestiaCP] Error getting mail account quota:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // DOMAIN MANAGEMENT
  // ============================================

  /**
   * Seznam web domén pro uživatele
   * @param {string} username - HestiaCP username
   * @returns {Promise<{success: boolean, domains?: Array, error?: string}>}
   */
  async listWebDomains(username) {
    try {
      const result = await this.callAPI('v-list-web-domains', [username, 'json'], { returnCode: false });
      if (result.success && result.data && typeof result.data === 'object') {
        const domains = Object.entries(result.data).map(([domain, info]) => ({
          domain,
          ip: info.IP || '',
          ssl: info.SSL === 'yes',
          ssl_cert: info.SSL_CERT || '',
          ssl_key: info.SSL_KEY || '',
          ssl_ca: info.SSL_CA || '',
          aliases: info.ALIAS || '',
          document_root: info.DOCUMENT_ROOT || '',
          suspended: info.SUSPENDED === 'yes',
        }));
        return { success: true, domains };
      }
      // Fallback
      const raw = await this._callAPIRaw('v-list-web-domains', [username, 'json'], false);
      if (raw.ok && raw.body) {
        const trimmed = String(raw.body).trim();
        const jsonStr = trimmed.startsWith('0\n') ? trimmed.slice(2).trim() : (trimmed === '0' ? '' : trimmed);
        if (jsonStr) {
          try {
            const data = JSON.parse(jsonStr);
            const domains = Object.entries(data).map(([domain, info]) => ({
              domain,
              ip: info.IP || '',
              ssl: info.SSL === 'yes',
              ssl_cert: info.SSL_CERT || '',
              ssl_key: info.SSL_KEY || '',
              ssl_ca: info.SSL_CA || '',
              aliases: info.ALIAS || '',
              document_root: info.DOCUMENT_ROOT || '',
              suspended: info.SUSPENDED === 'yes',
            }));
            return { success: true, domains };
          } catch { /* ignore */ }
        }
      }
      return { success: false, error: 'Failed to list web domains' };
    } catch (error) {
      console.error('[HestiaCP] Error listing web domains:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Informace o web doméně
   * @param {string} username - HestiaCP username
   * @param {string} domain - Doména
   * @returns {Promise<{success: boolean, domain?: Object, error?: string}>}
   */
  async getWebDomainInfo(username, domain) {
    try {
      const result = await this.callAPI('v-list-web-domain', [username, domain, 'json'], { returnCode: false });
      if (result.success && result.data && typeof result.data === 'object') {
        const domainData = result.data[domain] || Object.values(result.data)[0];
        if (domainData) {
          return {
            success: true,
            domain: {
              domain,
              ip: domainData.IP || '',
              ssl: domainData.SSL === 'yes',
              ssl_cert: domainData.SSL_CERT || '',
              ssl_key: domainData.SSL_KEY || '',
              ssl_ca: domainData.SSL_CA || '',
              aliases: domainData.ALIAS || '',
              document_root: domainData.DOCUMENT_ROOT || '',
              suspended: domainData.SUSPENDED === 'yes',
            }
          };
        }
      }
      return { success: false, error: 'Failed to get web domain info' };
    } catch (error) {
      console.error('[HestiaCP] Error getting web domain info:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // DATABASE MANAGEMENT
  // ============================================

  /**
   * Seznam databází pro uživatele
   * @param {string} username - HestiaCP username
   * @returns {Promise<{success: boolean, databases?: Array, error?: string}>}
   */
  async listDatabases(username) {
    try {
      const result = await this.callAPI('v-list-database', [username, 'json'], { returnCode: false });
      if (result.success && result.data && typeof result.data === 'object') {
        const databases = Object.entries(result.data).map(([dbname, info]) => ({
          name: dbname,
          type: info.TYPE || 'mysql',
          host: info.HOST || 'localhost',
          charset: info.CHARSET || 'utf8mb4',
          users: info.USER || [],
        }));
        return { success: true, databases };
      }
      // Fallback
      const raw = await this._callAPIRaw('v-list-database', [username, 'json'], false);
      if (raw.ok && raw.body) {
        const trimmed = String(raw.body).trim();
        const jsonStr = trimmed.startsWith('0\n') ? trimmed.slice(2).trim() : (trimmed === '0' ? '' : trimmed);
        if (jsonStr) {
          try {
            const data = JSON.parse(jsonStr);
            const databases = Object.entries(data).map(([dbname, info]) => ({
              name: dbname,
              type: info.TYPE || 'mysql',
              host: info.HOST || 'localhost',
              charset: info.CHARSET || 'utf8mb4',
              users: info.USER || [],
            }));
            return { success: true, databases };
          } catch { /* ignore */ }
        }
      }
      return { success: false, error: 'Failed to list databases' };
    } catch (error) {
      console.error('[HestiaCP] Error listing databases:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Vytvoření databáze
   * @param {string} username - HestiaCP username
   * @param {string} database - Název databáze
   * @param {string} dbuser - DB uživatel
   * @param {string} password - Heslo
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async createDatabase(username, database, dbuser, password) {
    try {
      const result = await this.callAPI('v-add-database', [username, database, dbuser, password]);
      return result;
    } catch (error) {
      console.error('[HestiaCP] Error creating database:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Smazání databáze
   * @param {string} username - HestiaCP username
   * @param {string} database - Název databáze
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteDatabase(username, database) {
    try {
      const result = await this.callAPI('v-delete-database', [username, database]);
      return result;
    } catch (error) {
      console.error('[HestiaCP] Error deleting database:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // DNS Management
  // ============================================

  /**
   * Seznam DNS domén pro uživatele
   * @param {string} username - HestiaCP username
   * @returns {Promise<{success: boolean, domains?: string[], error?: string}>}
   */
  async listDnsDomains(username) {
    try {
      const result = await this.callAPI('v-list-dns-domains', [username, 'json'], { returnCode: false });
      
      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Parsování JSON odpovědi
      let domains = [];
      try {
        const data = JSON.parse(result.data);
        if (data && typeof data === 'object') {
          domains = Object.keys(data);
        }
      } catch (parseError) {
        console.error('[HestiaCP] Error parsing DNS domains:', parseError);
        return { success: false, error: 'Failed to parse DNS domains response' };
      }

      return { success: true, domains };
    } catch (error) {
      console.error('[HestiaCP] Error listing DNS domains:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Seznam DNS záznamů pro doménu
   * @param {string} username - HestiaCP username
   * @param {string} domain - DNS doména
   * @returns {Promise<{success: boolean, records?: Array, error?: string}>}
   */
  async listDnsRecords(username, domain) {
    try {
      const result = await this.callAPI('v-list-dns-records', [username, domain, 'json'], { returnCode: false });
      
      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Parsování JSON odpovědi
      let records = [];
      try {
        const data = JSON.parse(result.data);
        if (data && typeof data === 'object') {
          // HestiaCP vrací objekt s ID jako klíče
          records = Object.values(data).map((record, index) => ({
            id: Object.keys(data)[index],
            ...record
          }));
        }
      } catch (parseError) {
        console.error('[HestiaCP] Error parsing DNS records:', parseError);
        return { success: false, error: 'Failed to parse DNS records response' };
      }

      return { success: true, records };
    } catch (error) {
      console.error('[HestiaCP] Error listing DNS records:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Přidání DNS záznamu
   * @param {string} username - HestiaCP username
   * @param {string} domain - DNS doména
   * @param {string} name - Název záznamu (např. 'www', '@', 'mail')
   * @param {string} type - Typ záznamu (A, AAAA, CNAME, MX, TXT, NS, etc.)
   * @param {string} value - Hodnota záznamu
   * @param {number} priority - Priorita (pro MX záznamy)
   * @param {number} ttl - TTL v sekundách (volitelné)
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async addDnsRecord(username, domain, name, type, value, priority = null, ttl = null) {
    try {
      const args = [username, domain, name, type, value];
      if (priority !== null) args.push(priority);
      if (ttl !== null) args.push(ttl);
      
      const result = await this.callAPI('v-add-dns-record', args);
      return result;
    } catch (error) {
      console.error('[HestiaCP] Error adding DNS record:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Smazání DNS záznamu
   * @param {string} username - HestiaCP username
   * @param {string} domain - DNS doména
   * @param {string} recordId - ID záznamu
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteDnsRecord(username, domain, recordId) {
    try {
      const result = await this.callAPI('v-delete-dns-record', [username, domain, recordId]);
      return result;
    } catch (error) {
      console.error('[HestiaCP] Error deleting DNS record:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Přidání DNS domény
   * @param {string} username - HestiaCP username
   * @param {string} domain - DNS doména
   * @param {string} ip - IP adresa (volitelné)
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async addDnsDomain(username, domain, ip = null) {
    try {
      const args = [username, domain];
      if (ip) args.push(ip);
      
      const result = await this.callAPI('v-add-dns-domain', args);
      return result;
    } catch (error) {
      console.error('[HestiaCP] Error adding DNS domain:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Smazání DNS domény
   * @param {string} username - HestiaCP username
   * @param {string} domain - DNS doména
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteDnsDomain(username, domain) {
    try {
      const result = await this.callAPI('v-delete-dns-domain', [username, domain]);
      return result;
    } catch (error) {
      console.error('[HestiaCP] Error deleting DNS domain:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // FTP Management
  // ============================================

  /**
   * Seznam FTP účtů pro web doménu
   * @param {string} username - HestiaCP username
   * @param {string} domain - Web doména
   * @returns {Promise<{success: boolean, accounts?: Array, error?: string}>}
   */
  async listWebDomainFtp(username, domain) {
    try {
      const result = await this.callAPI('v-list-web-domain-ftp', [username, domain, 'json'], { returnCode: false });
      if (!result.success) {
        return { success: false, error: result.error };
      }
      let accounts = [];
      try {
        const data = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
        if (data && typeof data === 'object') {
          accounts = Object.entries(data).map(([ftpUser, info]) => ({
            id: ftpUser,
            username: ftpUser,
            path: (info && info.PATH) ? info.PATH : '',
            suspended: (info && info.SUSPENDED) === 'yes',
          }));
        }
      } catch (parseError) {
        console.error('[HestiaCP] Error parsing FTP list:', parseError);
        return { success: false, error: 'Failed to parse FTP accounts response' };
      }
      return { success: true, accounts };
    } catch (error) {
      console.error('[HestiaCP] Error listing FTP accounts:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Přidání FTP účtu k web doméně
   * @param {string} username - HestiaCP username
   * @param {string} domain - Web doména
   * @param {string} ftpUser - FTP uživatelské jméno
   * @param {string} ftpPass - Heslo
   * @param {string} path - Cesta (např. public_html)
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async addWebDomainFtp(username, domain, ftpUser, ftpPass, path) {
    try {
      const args = [username, domain, ftpUser, ftpPass];
      if (path) args.push(path);
      const result = await this.callAPI('v-add-web-domain-ftp', args);
      return result;
    } catch (error) {
      console.error('[HestiaCP] Error adding FTP account:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Smazání FTP účtu
   * @param {string} username - HestiaCP username
   * @param {string} domain - Web doména
   * @param {string} ftpUser - FTP uživatelské jméno
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteWebDomainFtp(username, domain, ftpUser) {
    try {
      const result = await this.callAPI('v-delete-web-domain-ftp', [username, domain, ftpUser]);
      return result;
    } catch (error) {
      console.error('[HestiaCP] Error deleting FTP account:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Změna hesla FTP účtu
   * @param {string} username - HestiaCP username
   * @param {string} domain - Web doména
   * @param {string} ftpUser - FTP uživatelské jméno
   * @param {string} ftpPass - Nové heslo
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async changeWebDomainFtpPassword(username, domain, ftpUser, ftpPass) {
    try {
      const result = await this.callAPI('v-change-web-domain-ftp-password', [username, domain, ftpUser, ftpPass]);
      return result;
    } catch (error) {
      console.error('[HestiaCP] Error changing FTP password:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // Backup Management
  // ============================================

  /**
   * Seznam záloh pro uživatele
   * @param {string} username - HestiaCP username
   * @returns {Promise<{success: boolean, backups?: Array, error?: string}>}
   */
  async listBackups(username) {
    try {
      const result = await this.callAPI('v-list-user-backups', [username, 'json'], { returnCode: false });
      if (!result.success) {
        return { success: false, error: result.error };
      }
      let backups = [];
      try {
        const data = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
        if (data && typeof data === 'object') {
          backups = Object.entries(data).map(([backupId, info]) => ({
            id: backupId,
            date: (info && info.DATE) ? info.DATE : '',
            size: (info && info.SIZE) ? parseInt(info.SIZE) : 0,
            status: (info && info.STATUS) ? info.STATUS : 'unknown',
          }));
        }
      } catch (parseError) {
        console.error('[HestiaCP] Error parsing backups list:', parseError);
        return { success: false, error: 'Failed to parse backups response' };
      }
      return { success: true, backups };
    } catch (error) {
      console.error('[HestiaCP] Error listing backups:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Vytvoření zálohy uživatele
   * @param {string} username - HestiaCP username
   * @param {boolean} notify - Poslat notifikaci (volitelné)
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async createBackup(username, notify = false) {
    try {
      const args = [username];
      if (notify) args.push('notify');
      const result = await this.callAPI('v-backup-user', args);
      return result;
    } catch (error) {
      console.error('[HestiaCP] Error creating backup:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obnovení zálohy
   * @param {string} username - HestiaCP username
   * @param {string} backupId - ID zálohy
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async restoreBackup(username, backupId) {
    try {
      const result = await this.callAPI('v-restore-user-backup', [username, backupId]);
      return result;
    } catch (error) {
      console.error('[HestiaCP] Error restoring backup:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Smazání zálohy
   * @param {string} username - HestiaCP username
   * @param {string} backupId - ID zálohy
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteBackup(username, backupId) {
    try {
      const result = await this.callAPI('v-delete-user-backup', [username, backupId]);
      return result;
    } catch (error) {
      console.error('[HestiaCP] Error deleting backup:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // Cron Jobs Management
  // ============================================

  /**
   * Seznam cron jobů pro uživatele
   * @param {string} username - HestiaCP username
   * @returns {Promise<{success: boolean, cronJobs?: Array, error?: string}>}
   */
  async listCronJobs(username) {
    try {
      const result = await this.callAPI('v-list-cron-job', [username, 'json'], { returnCode: false });
      if (!result.success) {
        return { success: false, error: result.error };
      }
      let cronJobs = [];
      try {
        const data = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
        if (data && typeof data === 'object') {
          cronJobs = Object.entries(data).map(([jobId, info]) => ({
            id: jobId,
            min: (info && info.MIN) ? info.MIN : '*',
            hour: (info && info.HOUR) ? info.HOUR : '*',
            day: (info && info.DAY) ? info.DAY : '*',
            month: (info && info.MONTH) ? info.MONTH : '*',
            weekday: (info && info.WEEKDAY) ? info.WEEKDAY : '*',
            command: (info && info.CMD) ? info.CMD : '',
            suspended: (info && info.SUSPENDED) ? info.SUSPENDED === 'yes' : false,
          }));
        }
      } catch (parseError) {
        console.error('[HestiaCP] Error parsing cron jobs list:', parseError);
        return { success: false, error: 'Failed to parse cron jobs response' };
      }
      return { success: true, cronJobs };
    } catch (error) {
      console.error('[HestiaCP] Error listing cron jobs:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Přidání cron jobu
   * @param {string} username - HestiaCP username
   * @param {string} min - Minuta (0-59 nebo *)
   * @param {string} hour - Hodina (0-23 nebo *)
   * @param {string} day - Den v měsíci (1-31 nebo *)
   * @param {string} month - Měsíc (1-12 nebo *)
   * @param {string} weekday - Den v týdnu (0-7 nebo *)
   * @param {string} command - Příkaz k provedení
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async addCronJob(username, min, hour, day, month, weekday, command) {
    try {
      const result = await this.callAPI('v-add-cron-job', [username, min, hour, day, month, weekday, command]);
      return result;
    } catch (error) {
      console.error('[HestiaCP] Error adding cron job:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Smazání cron jobu
   * @param {string} username - HestiaCP username
   * @param {string} jobId - ID cron jobu
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteCronJob(username, jobId) {
    try {
      const result = await this.callAPI('v-delete-cron-job', [username, jobId]);
      return result;
    } catch (error) {
      console.error('[HestiaCP] Error deleting cron job:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Pozastavení/obnovení cron jobu
   * @param {string} username - HestiaCP username
   * @param {string} jobId - ID cron jobu
   * @param {boolean} suspend - true pro pozastavení, false pro obnovení
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async suspendCronJob(username, jobId, suspend) {
    try {
      const result = await this.callAPI(suspend ? 'v-suspend-cron-job' : 'v-unsuspend-cron-job', [username, jobId]);
      return result;
    } catch (error) {
      console.error('[HestiaCP] Error suspending/unsuspending cron job:', error);
      return { success: false, error: error.message };
    }
  }
}

// Singleton instance
const hestiacp = new HestiaCP();

module.exports = hestiacp;
