/**
 * OAuth Service – Google a GitHub přihlášení
 *
 * Flow:
 * 1. GET /api/auth/oauth/:provider/start → redirect na Google/GitHub authorization URL
 * 2. Provider redirectuje zpět na GET /api/auth/oauth/:provider/callback
 * 3. Backend vymění code za access token, získá profil uživatele
 * 4. Najde/vytvoří uživatele v DB, vydá JWT tokeny
 * 5. Redirect na frontend /auth/callback s access tokenem
 */

const { v4: uuidv4 } = require('uuid');
const db = require('./databaseService');
const fetch = require('node-fetch');
require('dotenv').config();

// ============================================
// PROVIDER KONFIGURACE
// ============================================

const providers = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    scopes: ['openid', 'email', 'profile'],
  },
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    userEmailsUrl: 'https://api.github.com/user/emails',
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    scopes: ['user:email'],
  },
};

/**
 * Zkontroluje, zda je provider nakonfigurovaný
 */
function isProviderConfigured(provider) {
  const config = providers[provider];
  return !!(config && config.clientId && config.clientSecret);
}

/**
 * Vrátí authorization URL pro daný provider
 */
function getAuthorizationUrl(provider, redirectUri, state) {
  const config = providers[provider];
  if (!config) {
    throw new Error(`Neznámý OAuth provider: ${provider}`);
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    state: state,
    response_type: 'code',
  });

  if (provider === 'google') {
    params.set('scope', config.scopes.join(' '));
    params.set('access_type', 'offline');
    params.set('prompt', 'select_account');
  } else if (provider === 'github') {
    params.set('scope', config.scopes.join(' '));
  }

  return `${config.authUrl}?${params.toString()}`;
}

/**
 * Vymění authorization code za access token
 */
async function exchangeCodeForToken(provider, code, redirectUri) {
  const config = providers[provider];

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code: code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  // GitHub vyžaduje Accept: application/json
  if (provider === 'github') {
    headers['Accept'] = 'application/json';
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers,
    body: body.toString(),
  });

  const data = provider === 'github'
    ? await response.json()
    : await response.json();

  if (data.error) {
    throw new Error(`OAuth token error: ${data.error_description || data.error}`);
  }

  return data.access_token;
}

/**
 * Získá profil uživatele z providera
 */
async function getUserProfile(provider, accessToken) {
  const config = providers[provider];

  const response = await fetch(config.userInfoUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      // GitHub API vyžaduje User-Agent
      ...(provider === 'github' ? { 'User-Agent': 'Alatyr-Hosting' } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user profile from ${provider}`);
  }

  const profile = await response.json();

  if (provider === 'google') {
    return {
      email: profile.email,
      firstName: profile.given_name || '',
      lastName: profile.family_name || '',
      avatarUrl: profile.picture || null,
      providerId: profile.id,
    };
  }

  if (provider === 'github') {
    let email = profile.email;

    // GitHub může mít email jako null (privátní) – fetchni z /user/emails
    if (!email && config.userEmailsUrl) {
      const emailsResponse = await fetch(config.userEmailsUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'User-Agent': 'Alatyr-Hosting',
        },
      });

      if (emailsResponse.ok) {
        const emails = await emailsResponse.json();
        // Preferuj primární a ověřený email
        const primary = emails.find(e => e.primary && e.verified);
        const verified = emails.find(e => e.verified);
        email = primary?.email || verified?.email || emails[0]?.email || null;
      }
    }

    if (!email) {
      throw new Error('GitHub účet nemá přístupnou emailovou adresu. Nastavte veřejný email v GitHub profilu.');
    }

    // GitHub nemá first/last name, jen display name
    const nameParts = (profile.name || '').split(' ');
    return {
      email: email,
      firstName: nameParts[0] || profile.login || '',
      lastName: nameParts.slice(1).join(' ') || '',
      avatarUrl: profile.avatar_url || null,
      providerId: String(profile.id),
    };
  }

  throw new Error(`Neznámý provider: ${provider}`);
}

/**
 * Najde nebo vytvoří uživatele na základě OAuth profilu
 * Vrací user objekt z DB
 */
async function findOrCreateUser(provider, profile) {
  // Zkus najít uživatele podle emailu
  let user = await db.queryOne(
    `SELECT u.id, u.email, u.email_verified, u.provider,
            p.first_name, p.last_name, p.is_admin, p.avatar_url
     FROM users u
     LEFT JOIN profiles p ON p.id = u.id
     WHERE u.email = ?`,
    [profile.email]
  );

  if (user) {
    // Uživatel existuje – aktualizuj provider info a avatar (pokud nemá)
    if (!user.avatar_url && profile.avatarUrl) {
      await db.execute(
        'UPDATE profiles SET avatar_url = ? WHERE id = ?',
        [profile.avatarUrl, user.id]
      );
      user.avatar_url = profile.avatarUrl;
    }

    // Ověř email automaticky (přihlásil se přes OAuth = email je ověřený)
    if (!user.email_verified) {
      await db.execute(
        'UPDATE users SET email_verified = TRUE WHERE id = ?',
        [user.id]
      );
      user.email_verified = true;
    }

    // Aktualizuj last_login
    await db.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
    await db.execute('UPDATE profiles SET last_login = NOW() WHERE id = ?', [user.id]);

    return user;
  }

  // Uživatel neexistuje – vytvoř nový
  const userId = uuidv4();

  await db.transaction(async (connection) => {
    await connection.execute(
      `INSERT INTO users (id, email, password_hash, email_verified, provider)
       VALUES (?, ?, '', TRUE, ?)`,
      [userId, profile.email, provider]
    );

    await connection.execute(
      `UPDATE profiles SET first_name = ?, last_name = ?, avatar_url = ? WHERE id = ?`,
      [profile.firstName || '', profile.lastName || '', profile.avatarUrl || null, userId]
    );
  });

  // Načti vytvořeného uživatele
  user = await db.queryOne(
    `SELECT u.id, u.email, u.email_verified, u.provider,
            p.first_name, p.last_name, p.is_admin, p.avatar_url
     FROM users u
     LEFT JOIN profiles p ON p.id = u.id
     WHERE u.id = ?`,
    [userId]
  );

  return user;
}

module.exports = {
  providers,
  isProviderConfigured,
  getAuthorizationUrl,
  exchangeCodeForToken,
  getUserProfile,
  findOrCreateUser,
};
