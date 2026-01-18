// Authentication Service pro backend
// Nahrazuje Supabase Auth s vlastním JWT systémem

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('./databaseService');
const hestiacp = require('./hestiacpService');
require('dotenv').config();

// SECURITY: JWT secrets MUSÍ být nastaveny v environment variables
// V produkci musí být silné, náhodné řetězce (min. 32 znaků)
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

// Kritická kontrola - aplikace nesmí běžet bez secrets
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('❌ SECURITY ERROR: JWT_SECRET musí být nastaven v .env a mít alespoň 32 znaků!');
  console.error('   Generuj pomocí: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

if (!JWT_REFRESH_SECRET || JWT_REFRESH_SECRET.length < 32) {
  console.error('❌ SECURITY ERROR: REFRESH_TOKEN_SECRET nebo JWT_REFRESH_SECRET musí být nastaven v .env a mít alespoň 32 znaků!');
  console.error('   Generuj pomocí: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

/**
 * Generuje JWT access token
 */
function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      is_admin: user.is_admin || false,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Generuje JWT refresh token
 */
function generateRefreshToken(user) {
  return jwt.sign(
    {
      id: user.id,
      type: 'refresh',
    },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );
}

/**
 * Ověří JWT token
 */
function verifyToken(token, isRefresh = false) {
  try {
    const secret = isRefresh ? JWT_REFRESH_SECRET : JWT_SECRET;
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
}

/**
 * Registrace nového uživatele
 */
async function register(email, password, firstName, lastName) {
  try {
    // Zkontroluj, jestli uživatel už existuje
    const existingUser = await db.queryOne(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser) {
      return {
        success: false,
        error: 'Email již existuje',
      };
    }

    // Hash hesla
    const passwordHash = await bcrypt.hash(password, 10);

    // Generuj UUID
    const userId = uuidv4();

    // Vytvoř uživatele v databázi (transaction)
    await db.transaction(async (connection) => {
      // Vytvoř uživatele
      await connection.execute(
        `INSERT INTO users (id, email, password_hash, email_verified, provider)
         VALUES (?, ?, ?, FALSE, 'email')`,
        [userId, email, passwordHash]
      );

      // Profil se vytvoří automaticky přes trigger
      // Ale můžeme aktualizovat first_name a last_name
      await connection.execute(
        `UPDATE profiles SET first_name = ?, last_name = ? WHERE id = ?`,
        [firstName || '', lastName || '', userId]
      );
    });

    // Vytvoř HestiaCP účet (asynchronně, neblokuje registraci)
    // Pouze vytvoří uživatele bez domény - doména se přidá při objednávce
    let hestiaResult = null;
    try {
      console.log(`[Auth] Creating HestiaCP account for user: ${email}`);
      
      // Vytvoř jen uživatele v HestiaCP (bez domény)
      hestiaResult = await hestiacp.createUser({
        email: email,
        package: process.env.HESTIACP_DEFAULT_PACKAGE || 'default'
      });

      if (hestiaResult.success) {
        // Šifruj heslo před uložením do databáze
        const encryptedPassword = await bcrypt.hash(hestiaResult.password, 10);

        // Ulož HestiaCP údaje do profilu
        await db.execute(
          `UPDATE profiles 
           SET hestia_username = ?, 
               hestia_password_encrypted = ?,
               hestia_package = ?,
               hestia_created = TRUE,
               hestia_created_at = NOW()
           WHERE id = ?`,
          [
            hestiaResult.username,
            encryptedPassword,
            hestiaResult.package || process.env.HESTIACP_DEFAULT_PACKAGE || 'default',
            userId
          ]
        );

        console.log(`[Auth] ✅ HestiaCP account created: ${hestiaResult.username}`);
      } else {
        // Pokud se nepodařilo vytvořit HestiaCP účet, ulož chybu
        console.error(`[Auth] ❌ Failed to create HestiaCP account: ${hestiaResult.error}`);
        await db.execute(
          `UPDATE profiles 
           SET hestia_created = FALSE,
               hestia_error = ?
           WHERE id = ?`,
          [hestiaResult.error || 'Unknown error', userId]
        );
      }
    } catch (hestiaError) {
      // Pokud HestiaCP selže, registrace pokračuje
      // Uživatel se může přihlásit, ale HestiaCP účet bude muset vytvořit admin
      console.error('[Auth] ❌ HestiaCP account creation error (non-critical):', hestiaError);
      await db.execute(
        `UPDATE profiles 
         SET hestia_created = FALSE,
             hestia_error = ?
         WHERE id = ?`,
        [hestiaError.message || 'HestiaCP service unavailable', userId]
      );
    }

    // Načti uživatele
    const user = await db.queryOne(
      `SELECT u.id, u.email, u.email_verified, u.provider, u.created_at,
              p.first_name, p.last_name, p.is_admin, p.avatar_url
       FROM users u
       LEFT JOIN profiles p ON p.id = u.id
       WHERE u.id = ?`,
      [userId]
    );

    // Generuj tokeny
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Ulož refresh token do databáze
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 dní

    await db.execute(
      `INSERT INTO refresh_tokens (user_id, token, expires_at)
       VALUES (?, ?, ?)`,
      [userId, refreshToken, expiresAt]
    );

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_admin: user.is_admin || false,
        avatar_url: user.avatar_url,
        email_verified: user.email_verified,
      },
      accessToken,
      refreshToken,
      message: 'Registrace úspěšná! Zkontrolujte svůj email pro potvrzení.',
    };
  } catch (error) {
    console.error('Registration error:', error);
    return {
      success: false,
      error: 'Registrace se nezdařila',
    };
  }
}

/**
 * Přihlášení uživatele
 */
async function login(email, password) {
  try {
    // Načti uživatele
    const user = await db.queryOne(
      `SELECT u.id, u.email, u.password_hash, u.email_verified, u.provider, u.created_at,
              p.first_name, p.last_name, p.is_admin, p.avatar_url
       FROM users u
       LEFT JOIN profiles p ON p.id = u.id
       WHERE u.email = ?`,
      [email]
    );

    if (!user) {
      return {
        success: false,
        error: 'Nesprávný email nebo heslo',
      };
    }

    // Ověř heslo
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      return {
        success: false,
        error: 'Nesprávný email nebo heslo',
      };
    }

    // Aktualizuj last_login
    await db.execute(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    await db.execute(
      'UPDATE profiles SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    // Pokud uživatel nemá HestiaCP účet, zkus ho vytvořit (asynchronně)
    const profile = await db.queryOne(
      'SELECT hestia_created, hestia_username FROM profiles WHERE id = ?',
      [user.id]
    );

    if (!profile.hestia_created && !profile.hestia_username) {
      // Vytvoř HestiaCP účet asynchronně (neblokuje přihlášení)
      createHestiaCPAccountAsync(user.id, user.email).catch(error => {
        console.error(`[Auth] Failed to create HestiaCP account for user ${user.id}:`, error);
      });
    }

    // Generuj tokeny
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Ulož refresh token do databáze
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 dní

    await db.execute(
      `INSERT INTO refresh_tokens (user_id, token, expires_at)
       VALUES (?, ?, ?)`,
      [user.id, refreshToken, expiresAt]
    );

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_admin: user.is_admin || false,
        avatar_url: user.avatar_url,
        email_verified: user.email_verified,
      },
      accessToken,
      refreshToken,
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      error: 'Přihlášení se nezdařilo',
    };
  }
}

/**
 * Refresh access token pomocí refresh tokenu
 */
async function refreshAccessToken(refreshToken) {
  try {
    // Ověř refresh token
    const decoded = verifyToken(refreshToken, true);

    if (!decoded || decoded.type !== 'refresh') {
      return {
        success: false,
        error: 'Neplatný refresh token',
      };
    }

    // Zkontroluj, jestli token existuje v databázi
    const tokenRecord = await db.queryOne(
      `SELECT user_id, expires_at FROM refresh_tokens WHERE token = ?`,
      [refreshToken]
    );

    if (!tokenRecord) {
      return {
        success: false,
        error: 'Refresh token nenalezen',
      };
    }

    // Zkontroluj expiraci
    if (new Date(tokenRecord.expires_at) < new Date()) {
      // Smaž expirovaný token
      await db.execute('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
      return {
        success: false,
        error: 'Refresh token vypršel',
      };
    }

    // Načti uživatele
    const user = await db.queryOne(
      `SELECT u.id, u.email, u.email_verified, u.provider,
              p.first_name, p.last_name, p.is_admin, p.avatar_url
       FROM users u
       LEFT JOIN profiles p ON p.id = u.id
       WHERE u.id = ?`,
      [decoded.id]
    );

    if (!user) {
      return {
        success: false,
        error: 'Uživatel nenalezen',
      };
    }

    // Generuj nový access token
    const accessToken = generateAccessToken(user);

    return {
      success: true,
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_admin: user.is_admin || false,
        avatar_url: user.avatar_url,
        email_verified: user.email_verified,
      },
    };
  } catch (error) {
    console.error('Refresh token error:', error);
    return {
      success: false,
      error: 'Obnovení tokenu se nezdařilo',
    };
  }
}

/**
 * Odhlášení uživatele (smaž refresh token)
 */
async function logout(refreshToken) {
  try {
    if (refreshToken) {
      await db.execute('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    }
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, error: 'Odhlášení se nezdařilo' };
  }
}

/**
 * Získání uživatele z tokenu
 */
async function getUserFromToken(accessToken) {
  try {
    const decoded = verifyToken(accessToken);

    if (!decoded) {
      return null;
    }

    const user = await db.queryOne(
      `SELECT u.id, u.email, u.email_verified, u.provider,
              p.first_name, p.last_name, p.is_admin, p.avatar_url
       FROM users u
       LEFT JOIN profiles p ON p.id = u.id
       WHERE u.id = ?`,
      [decoded.id]
    );

    return user;
  } catch (error) {
    console.error('Get user from token error:', error);
    return null;
  }
}

/**
 * Resetování hesla - vytvoří token
 */
async function requestPasswordReset(email) {
  try {
    const user = await db.queryOne('SELECT id FROM users WHERE email = ?', [email]);

    if (!user) {
      // Pro bezpečnost nevracíme chybu, pokud email neexistuje
      return {
        success: true,
        message: 'Pokud email existuje, byl odeslán odkaz pro resetování hesla',
      };
    }

    // Generuj reset token
    const resetToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hodina

    await db.execute(
      `UPDATE users 
       SET reset_password_token = ?, reset_password_expires = ?
       WHERE id = ?`,
      [resetToken, expiresAt, user.id]
    );

    // TODO: Odeslat email s reset tokenem
    // const resetUrl = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
    // await sendPasswordResetEmail(email, resetUrl);

    return {
      success: true,
      message: 'Pokud email existuje, byl odeslán odkaz pro resetování hesla',
      resetToken, // V development módu pro testování
    };
  } catch (error) {
    console.error('Password reset request error:', error);
    return {
      success: false,
      error: 'Zaslání emailu se nezdařilo',
    };
  }
}

/**
 * Resetování hesla - změna hesla pomocí tokenu
 */
async function resetPassword(token, newPassword) {
  try {
    // SECURITY: Validace síly nového hesla
    if (!newPassword || newPassword.length < 8) {
      return {
        success: false,
        error: 'Heslo musí mít alespoň 8 znaků',
      };
    }
    if (!/[A-Z]/.test(newPassword)) {
      return {
        success: false,
        error: 'Heslo musí obsahovat alespoň jedno velké písmeno',
      };
    }
    if (!/[a-z]/.test(newPassword)) {
      return {
        success: false,
        error: 'Heslo musí obsahovat alespoň jedno malé písmeno',
      };
    }
    if (!/\d/.test(newPassword)) {
      return {
        success: false,
        error: 'Heslo musí obsahovat alespoň jednu číslici',
      };
    }

    const user = await db.queryOne(
      `SELECT id FROM users 
       WHERE reset_password_token = ? 
       AND reset_password_expires > NOW()`,
      [token]
    );

    if (!user) {
      return {
        success: false,
        error: 'Neplatný nebo expirovaný reset token',
      };
    }

    // Hash nového hesla
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Aktualizuj heslo a vymaž token
    await db.execute(
      `UPDATE users 
       SET password_hash = ?, 
           reset_password_token = NULL, 
           reset_password_expires = NULL
       WHERE id = ?`,
      [passwordHash, user.id]
    );

    return {
      success: true,
      message: 'Heslo bylo úspěšně změněno',
    };
  } catch (error) {
    console.error('Password reset error:', error);
    return {
      success: false,
      error: 'Změna hesla se nezdařila',
    };
  }
}

/**
 * Resetování hesla bez ověření starého hesla (např. po reset tokenu)
 */
async function resetPasswordByUserId(userId, newPassword) {
  try {
    // SECURITY: Validace síly nového hesla
    if (!newPassword || newPassword.length < 8) {
      return {
        success: false,
        error: 'Heslo musí mít alespoň 8 znaků',
      };
    }
    if (!/[A-Z]/.test(newPassword)) {
      return {
        success: false,
        error: 'Heslo musí obsahovat alespoň jedno velké písmeno',
      };
    }
    if (!/[a-z]/.test(newPassword)) {
      return {
        success: false,
        error: 'Heslo musí obsahovat alespoň jedno malé písmeno',
      };
    }
    if (!/\d/.test(newPassword)) {
      return {
        success: false,
        error: 'Heslo musí obsahovat alespoň jednu číslici',
      };
    }

    // Hash nového hesla
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Aktualizuj heslo
    await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [
      passwordHash,
      userId,
    ]);

    return {
      success: true,
      message: 'Heslo bylo úspěšně změněno',
    };
  } catch (error) {
    console.error('Reset password by user ID error:', error);
    return {
      success: false,
      error: 'Změna hesla se nezdařila',
    };
  }
}

/**
 * Změna hesla přihlášeného uživatele
 */
async function changePassword(userId, oldPassword, newPassword) {
  try {
    // SECURITY: Validace síly nového hesla
    if (!newPassword || newPassword.length < 8) {
      return {
        success: false,
        error: 'Nové heslo musí mít alespoň 8 znaků',
      };
    }
    if (!/[A-Z]/.test(newPassword)) {
      return {
        success: false,
        error: 'Nové heslo musí obsahovat alespoň jedno velké písmeno',
      };
    }
    if (!/[a-z]/.test(newPassword)) {
      return {
        success: false,
        error: 'Nové heslo musí obsahovat alespoň jedno malé písmeno',
      };
    }
    if (!/\d/.test(newPassword)) {
      return {
        success: false,
        error: 'Nové heslo musí obsahovat alespoň jednu číslici',
      };
    }

    // Načti uživatele
    const user = await db.queryOne(
      'SELECT password_hash FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return {
        success: false,
        error: 'Uživatel nenalezen',
      };
    }

    // Ověř staré heslo
    const passwordValid = await bcrypt.compare(oldPassword, user.password_hash);

    if (!passwordValid) {
      return {
        success: false,
        error: 'Nesprávné současné heslo',
      };
    }

    // SECURITY: Zkontroluj, že nové heslo není stejné jako staré
    const samePassword = await bcrypt.compare(newPassword, user.password_hash);
    if (samePassword) {
      return {
        success: false,
        error: 'Nové heslo musí být jiné než současné heslo',
      };
    }

    // Hash nového hesla
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Aktualizuj heslo
    await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [
      passwordHash,
      userId,
    ]);

    return {
      success: true,
      message: 'Heslo bylo úspěšně změněno',
    };
  } catch (error) {
    console.error('Change password error:', error);
    return {
      success: false,
      error: 'Změna hesla se nezdařila',
    };
  }
}

/**
 * Pomocná funkce pro asynchronní vytvoření HestiaCP účtu
 */
async function createHestiaCPAccountAsync(userId, email) {
  try {
    console.log(`[Auth] Creating HestiaCP account for user: ${email}`);
    
    const hestiaResult = await hestiacp.createUser({
      email: email,
      package: process.env.HESTIACP_DEFAULT_PACKAGE || 'default'
    });

    if (hestiaResult.success) {
      // Šifruj heslo před uložením do databáze
      const encryptedPassword = await bcrypt.hash(hestiaResult.password, 10);

      // Ulož HestiaCP údaje do profilu
      await db.execute(
        `UPDATE profiles 
         SET hestia_username = ?, 
             hestia_password_encrypted = ?,
             hestia_package = ?,
             hestia_created = TRUE,
             hestia_created_at = NOW(),
             hestia_error = NULL
         WHERE id = ?`,
        [
          hestiaResult.username,
          encryptedPassword,
          hestiaResult.package || process.env.HESTIACP_DEFAULT_PACKAGE || 'default',
          userId
        ]
      );

      console.log(`[Auth] ✅ HestiaCP account created: ${hestiaResult.username}`);
    } else {
      console.error(`[Auth] ❌ Failed to create HestiaCP account: ${hestiaResult.error}`);
      await db.execute(
        `UPDATE profiles 
         SET hestia_created = FALSE,
             hestia_error = ?
         WHERE id = ?`,
        [hestiaResult.error || 'Unknown error', userId]
      );
    }
  } catch (error) {
    console.error('[Auth] ❌ HestiaCP account creation error:', error);
    await db.execute(
      `UPDATE profiles 
       SET hestia_created = FALSE,
           hestia_error = ?
       WHERE id = ?`,
      [error.message || 'HestiaCP service unavailable', userId]
    );
  }
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  register,
  login,
  refreshAccessToken,
  logout,
  getUserFromToken,
  requestPasswordReset,
  resetPassword,
  resetPasswordByUserId,
  changePassword,
  createHestiaCPAccountAsync,
};
