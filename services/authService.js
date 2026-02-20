// Authentication Service pro backend
// Nahrazuje Supabase Auth s vlastním JWT systémem

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const { v4: uuidv4 } = require('uuid');
const db = require('./databaseService');
const { sendPasswordResetEmail, sendEmailVerificationEmail, sendPasswordChangedEmail } = require('./emailService');
const hestiacp = require('./hestiacpService');
require('dotenv').config();

// SECURITY: Hash recovery code with SHA-256 (fast enough, codes have sufficient entropy)
function hashRecoveryCode(code) {
  return crypto.createHash('sha256').update(String(code).trim().toLowerCase()).digest('hex');
}

// SECURITY: JWT secrets MUSÍ být nastaveny v environment variables
// V produkci musí být silné, náhodné řetězce (min. 32 znaků)
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

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
 * SECURITY: Centrální validace síly hesla
 * Vrací { valid: true } nebo { valid: false, error: string }
 */
function validatePasswordStrength(password) {
  if (!password || password.length < 8) {
    return { valid: false, error: 'Heslo musí mít alespoň 8 znaků' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'Heslo může mít maximálně 128 znaků' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Heslo musí obsahovat alespoň jedno velké písmeno' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Heslo musí obsahovat alespoň jedno malé písmeno' };
  }
  if (!/\d/.test(password)) {
    return { valid: false, error: 'Heslo musí obsahovat alespoň jednu číslici' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, error: 'Heslo musí obsahovat alespoň jeden speciální znak (!@#$%...)' };
  }
  return { valid: true };
}

/**
 * Registrace nového uživatele
 */
async function register(email, password, firstName, lastName) {
  try {
    // SECURITY: Validace síly hesla
    const pwCheck = validatePasswordStrength(password);
    if (!pwCheck.valid) {
      return { success: false, error: pwCheck.error };
    }

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
        const pkg = hestiaResult.package || process.env.HESTIACP_DEFAULT_PACKAGE || 'default';

        if (hestiaResult.alreadyExists) {
          await db.execute(
            `UPDATE profiles 
             SET hestia_username = ?, hestia_package = ?, hestia_created = TRUE
             WHERE id = ?`,
            [hestiaResult.username, pkg, userId]
          );
          console.log(`[Auth] ✅ HestiaCP account linked (already existed): ${hestiaResult.username}`);
        } else {
          const encryptedPassword = await bcrypt.hash(hestiaResult.password, 10);
          await db.execute(
            `UPDATE profiles 
             SET hestia_username = ?, hestia_password_encrypted = ?, hestia_package = ?,
                 hestia_created = TRUE, hestia_created_at = NOW()
             WHERE id = ?`,
            [hestiaResult.username, encryptedPassword, pkg, userId]
          );
          console.log(`[Auth] ✅ HestiaCP account created: ${hestiaResult.username}`);
        }
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

    // Vytvoř email verification token a pošli ověřovací email (best-effort, neblokuje login)
    try {
      await createEmailVerificationForUser(user.id, user.email);
    } catch (verificationError) {
      console.error('[Auth] Email verification creation error (non-critical):', verificationError);
    }

    // Generuj tokeny
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Ulož refresh token do databáze
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 dní (konzistentní s cookie maxAge)

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
 * Vytvoří (nebo obnoví) email verification token pro uživatele a odešle email
 */
async function createEmailVerificationForUser(userId, email) {
  // Pokud není email, nic neděláme
  if (!email) {
    return;
  }

  // Pokud je už email ověřen, neděláme nic
  const existing = await db.queryOne(
    'SELECT email_verified FROM users WHERE id = ?',
    [userId]
  );

  if (!existing) {
    return;
  }

  if (existing.email_verified) {
    return;
  }

  const token = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 1); // 24 hodin

  await db.execute(
    `UPDATE users 
     SET email_verification_token = ?, email_verification_expires = ?
     WHERE id = ?`,
    [token, expiresAt, userId]
  );

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const verifyUrl = `${appUrl.replace(/\/+$/, '')}/verify-email?token=${token}`;

  await sendEmailVerificationEmail(email, verifyUrl);
}

/**
 * Ověření emailu pomocí verifikačního tokenu
 */
async function verifyEmail(token) {
  try {
    if (!token) {
      return {
        success: false,
        error: 'Chybí verifikační token',
      };
    }

    const user = await db.queryOne(
      `SELECT id, email_verified 
       FROM users 
       WHERE email_verification_token = ? 
         AND email_verification_expires > NOW()`,
      [token]
    );

    if (!user) {
      return {
        success: false,
        error: 'Neplatný nebo expirovaný verifikační token',
      };
    }

    if (user.email_verified) {
      // Už bylo ověřeno – jen vyčisti token
      await db.execute(
        `UPDATE users 
         SET email_verification_token = NULL,
             email_verification_expires = NULL
         WHERE id = ?`,
        [user.id]
      );

      return {
        success: true,
        message: 'Email byl již dříve ověřen',
      };
    }

    await db.execute(
      `UPDATE users 
       SET email_verified = TRUE,
           email_verification_token = NULL,
           email_verification_expires = NULL
       WHERE id = ?`,
      [user.id]
    );

    return {
      success: true,
      message: 'Email byl úspěšně ověřen',
    };
  } catch (error) {
    console.error('Email verification error:', error);
    return {
      success: false,
      error: 'Ověření emailu se nezdařilo',
    };
  }
}

/**
 * Přihlášení uživatele
 * Pokud má uživatel zapnuté MFA, vyžaduje mfaCode nebo recoveryCode.
 */
async function login(email, password, mfaCode, recoveryCode) {
  try {
    // Načti uživatele
    const user = await db.queryOne(
      `SELECT u.id, u.email, u.password_hash, u.email_verified, u.provider, u.created_at,
              u.failed_logins, u.locked_until,
              u.mfa_enabled, u.mfa_secret, u.mfa_recovery_codes,
              p.first_name, p.last_name, p.is_admin, p.avatar_url
       FROM users u
       LEFT JOIN profiles p ON p.id = u.id
       WHERE u.email = ?`,
      [email]
    );

    if (!user) {
      // Detailní log pouze na serveru (frontend dostane obecnou hlášku)
      console.warn('[Auth] Login failed: user not found', { email });
      return {
        success: false,
        error: 'Nesprávný email nebo heslo',
      };
    }

    // Zkontroluj, zda není účet zamčený
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      console.warn('[Auth] Login blocked: account locked', {
        email,
        userId: user.id,
        locked_until: user.locked_until,
      });
      return {
        success: false,
        error: 'Účet je dočasně zablokován kvůli opakovaným neúspěšným pokusům. Zkuste to prosím později.',
      };
    }

    // Ověř heslo
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      // Nevracíme hash ani heslo, jen info že nesouhlasí
      console.warn('[Auth] Login failed: invalid password', { email, userId: user.id });

      const failed = typeof user.failed_logins === 'number' ? user.failed_logins + 1 : 1;
      let lockedUntil = null;

      // Po 5 neúspěšných pokusech zamkni účet na 15 minut
      if (failed >= 5) {
        lockedUntil = new Date();
        lockedUntil.setMinutes(lockedUntil.getMinutes() + 15);
      }

      await db.execute(
        'UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?',
        [failed, lockedUntil, user.id]
      );

      return {
        success: false,
        error: 'Nesprávný email nebo heslo',
      };
    }

    // MFA: Pokud je zapnuté, ověř kód nebo recovery kód
    if (user.mfa_enabled) {
      // Bez kódu není možné pokračovat
      if (!mfaCode && !recoveryCode) {
        return {
          success: false,
          error: 'Je vyžadován ověřovací kód z aplikace nebo záložní kód',
          mfaRequired: true,
        };
      }

      const secret = user.mfa_secret;
      if (!secret) {
        console.warn('[Auth] MFA enabled but no secret found', { userId: user.id });
        return {
          success: false,
          error: 'Nastavení dvoufaktorového ověření je neplatné. Zkuste ho prosím vypnout a znovu zapnout.',
          mfaRequired: true,
        };
      }

      let mfaOk = false;

      // Ověř TOTP kód
      if (mfaCode && typeof mfaCode === 'string') {
        mfaOk = speakeasy.totp.verify({
          secret,
          encoding: 'base32',
          token: mfaCode,
          window: 1,
        });
      }

      // Pokud TOTP nevyšlo a máme recovery code, zkus ho (porovnání přes SHA-256 hash)
      if (!mfaOk && recoveryCode && typeof recoveryCode === 'string') {
        try {
          const stored = user.mfa_recovery_codes
            ? JSON.parse(user.mfa_recovery_codes)
            : [];

          const inputHash = hashRecoveryCode(recoveryCode);
          const remaining = Array.isArray(stored)
            ? stored.filter(storedHash => storedHash !== inputHash)
            : [];

          if (Array.isArray(stored) && remaining.length !== stored.length) {
            mfaOk = true;
            // Ulož zbylé kódy (použitý se odstraní)
            await db.execute(
              'UPDATE users SET mfa_recovery_codes = ? WHERE id = ?',
              [JSON.stringify(remaining), user.id]
            );
          }
        } catch (parseError) {
          console.error('[Auth] Failed to parse MFA recovery codes:', parseError);
        }
      }

      if (!mfaOk) {
        return {
          success: false,
          error: 'Neplatný ověřovací kód',
          mfaRequired: true,
        };
      }
    }

    // Přihlášení úspěšné – vynuluj failed_logins a locked_until
    await db.execute(
      'UPDATE users SET failed_logins = 0, locked_until = NULL, last_login = NOW() WHERE id = ?',
      [user.id]
    );

    // Aktualizuj last_login v profiles
    await db.execute(
      'UPDATE profiles SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    // Pokud uživatel nemá HestiaCP účet, zkus ho vytvořit (asynchronně)
    const profile = await db.queryOne(
      'SELECT hestia_created, hestia_username FROM profiles WHERE id = ?',
      [user.id]
    );

    // Pokud HestiaCP účet ještě nebyl úspěšně vytvořen, zkusíme to znovu (asynchronně)
    if (!profile.hestia_created) {
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
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 dní (konzistentní s cookie maxAge)

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

    // SECURITY: Refresh token rotation – smaž starý token a vydej nový
    // Zabraňuje opakovanému použití ukradeného refresh tokenu
    await db.execute('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);

    // Generuj nový access token
    const accessToken = generateAccessToken(user);

    // Generuj nový refresh token (rotation)
    const newRefreshToken = generateRefreshToken(user);
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7); // 7 dní (konzistentní s cookie maxAge)

    await db.execute(
      `INSERT INTO refresh_tokens (user_id, token, expires_at)
       VALUES (?, ?, ?)`,
      [user.id, newRefreshToken, newExpiresAt]
    );

    return {
      success: true,
      accessToken,
      refreshToken: newRefreshToken,
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
 * Odhlášení ze všech zařízení (smaž všechny refresh tokeny uživatele)
 */
async function logoutAll(userId) {
  try {
    if (!userId) {
      return { success: false, error: 'userId je povinný' };
    }
    const result = await db.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
    return { success: true, deletedCount: result.affectedRows };
  } catch (error) {
    console.error('LogoutAll error:', error);
    return { success: false, error: 'Odhlášení ze všech zařízení se nezdařilo' };
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

    // SECURITY: Reset token se NIKDY neposílá v API odpovědi - pouze emailem
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const resetUrl = `${appUrl.replace(/\/+$/, '')}/reset-password?token=${resetToken}`;

    try {
      await sendPasswordResetEmail(email, resetUrl);
    } catch (emailError) {
      console.error('Password reset email send error:', emailError);
      // Neprozrazujeme, jestli email selhal – odpověď je stejná
    }

    return {
      success: true,
      message: 'Pokud email existuje, byl odeslán odkaz pro resetování hesla',
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
    const pwCheck = validatePasswordStrength(newPassword);
    if (!pwCheck.valid) {
      return { success: false, error: pwCheck.error };
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

    // SECURITY: Invalidace všech sessions po resetu hesla
    await db.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [user.id]);

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
    const pwCheck = validatePasswordStrength(newPassword);
    if (!pwCheck.valid) {
      return { success: false, error: pwCheck.error };
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
    const pwCheck = validatePasswordStrength(newPassword);
    if (!pwCheck.valid) {
      return { success: false, error: pwCheck.error };
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

    // SECURITY: Invalidace všech sessions — po změně hesla musí být uživatel odhlášen odevšud
    await db.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);

    // Bezpečnostní notifikace o změně hesla (async, neblokuje odpověď)
    const userRow = await db.queryOne('SELECT email FROM users WHERE id = ?', [userId]);
    if (userRow?.email) {
      sendPasswordChangedEmail(userRow.email).catch(err =>
        console.error('[Auth] Failed to send password changed email:', err)
      );
    }

    return {
      success: true,
      message: 'Heslo bylo úspěšně změněno. Budete odhlášeni ze všech zařízení.',
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
 * Vytvoří nebo obnoví MFA secret a recovery kódy pro uživatele
 * Vrací otpauth URL, secret a recovery kódy (zobrazit jen jednou!)
 */
async function startMfaSetup(userId, email) {
  const secret = speakeasy.generateSecret({
    length: 20,
    name: `Alatyr Hosting (${email || userId})`,
    issuer: 'Alatyr Hosting',
  });

  // Vygeneruj recovery kódy (8 kódů) a ulož jejich SHA-256 hashe
  const recoveryCodes = Array.from({ length: 8 }).map(() =>
    uuidv4().split('-')[0] // krátký kód
  );

  // SECURITY: Do DB ukládáme pouze hashe, plaintext se zobrazí uživateli jen jednou
  const hashedCodes = recoveryCodes.map(code => hashRecoveryCode(code));

  await db.execute(
    `UPDATE users
     SET mfa_secret = ?, mfa_enabled = 0, mfa_recovery_codes = ?, mfa_confirmed_at = NULL
     WHERE id = ?`,
    [secret.base32, JSON.stringify(hashedCodes), userId]
  );

  return {
    otpauthUrl: secret.otpauth_url,
    secret: secret.base32,
    recoveryCodes, // plaintext – zobrazí se uživateli jen jednou
  };
}

/**
 * Potvrdí MFA nastavení ověřením TOTP kódu
 */
async function confirmMfaSetup(userId, code) {
  const user = await db.queryOne(
    'SELECT mfa_secret FROM users WHERE id = ?',
    [userId]
  );

  if (!user || !user.mfa_secret) {
    return {
      success: false,
      error: 'MFA není připraveno k ověření',
    };
  }

  const ok = speakeasy.totp.verify({
    secret: user.mfa_secret,
    encoding: 'base32',
    token: code,
    window: 1,
  });

  if (!ok) {
    return {
      success: false,
      error: 'Neplatný ověřovací kód',
    };
  }

  await db.execute(
    `UPDATE users 
     SET mfa_enabled = 1, mfa_confirmed_at = NOW()
     WHERE id = ?`,
    [userId]
  );

  return {
    success: true,
    message: 'Dvoufaktorové ověření bylo úspěšně zapnuto',
  };
}

/**
 * Vypne MFA pro uživatele (vyžaduje správné heslo)
 */
async function disableMfa(userId, password) {
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

  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    return {
      success: false,
      error: 'Nesprávné heslo',
    };
  }

  await db.execute(
    `UPDATE users 
     SET mfa_enabled = 0, mfa_secret = NULL, mfa_recovery_codes = NULL, mfa_confirmed_at = NULL
     WHERE id = ?`,
    [userId]
  );

  return {
    success: true,
    message: 'Dvoufaktorové ověření bylo vypnuto',
  };
}

/**
 * Pomocná funkce pro asynchronní vytvoření HestiaCP účtu
 */
async function createHestiaCPAccountAsync(userId, email) {
  try {
    // Vyčisti případný starý neplatný username před novým pokusem
    await db.execute(
      `UPDATE profiles 
       SET hestia_username = NULL, 
           hestia_error = NULL 
       WHERE id = ? AND hestia_created = FALSE`,
      [userId]
    );

    console.log(`[Auth] Creating HestiaCP account for user: ${email}`);
    
    const hestiaResult = await hestiacp.createUser({
      email: email,
      package: process.env.HESTIACP_DEFAULT_PACKAGE || 'default'
    });

    if (hestiaResult.success) {
      const pkg = hestiaResult.package || process.env.HESTIACP_DEFAULT_PACKAGE || 'default';

      if (hestiaResult.alreadyExists) {
        // Účet v HestiaCP už existoval – ulož jen username a package, heslo neměníme
        await db.execute(
          `UPDATE profiles 
           SET hestia_username = ?, 
               hestia_package = ?,
               hestia_created = TRUE,
               hestia_error = NULL
           WHERE id = ?`,
          [hestiaResult.username, pkg, userId]
        );
        console.log(`[Auth] ✅ HestiaCP account linked (already existed): ${hestiaResult.username}`);
      } else {
        // Nový účet – ulož včetně šifrovaného hesla
        const encryptedPassword = await bcrypt.hash(hestiaResult.password, 10);
        await db.execute(
          `UPDATE profiles 
           SET hestia_username = ?, 
               hestia_password_encrypted = ?,
               hestia_package = ?,
               hestia_created = TRUE,
               hestia_created_at = NOW(),
               hestia_error = NULL
           WHERE id = ?`,
          [hestiaResult.username, encryptedPassword, pkg, userId]
        );
        console.log(`[Auth] ✅ HestiaCP account created: ${hestiaResult.username}`);
      }
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

/**
 * SECURITY: Periodické čištění expirovaných refresh tokenů
 * Zabraňuje hromadění neplatných tokenů v databázi
 */
async function cleanupExpiredTokens() {
  try {
    const result = await db.execute(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW()'
    );
    if (result.affectedRows > 0) {
      console.log(`[Auth] Cleaned up ${result.affectedRows} expired refresh tokens`);
    }
  } catch (error) {
    console.error('[Auth] Failed to cleanup expired tokens:', error.message);
  }
}

// Spouštěj cleanup každou hodinu
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);
// A jednou při startu (po 10 sekundách, aby DB pool byl ready)
setTimeout(cleanupExpiredTokens, 10000);

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  register,
  login,
  refreshAccessToken,
  logout,
  logoutAll,
  getUserFromToken,
  requestPasswordReset,
  resetPassword,
  resetPasswordByUserId,
  changePassword,
  createHestiaCPAccountAsync,
  cleanupExpiredTokens,
  createEmailVerificationForUser,
  verifyEmail,
  startMfaSetup,
  confirmMfaSetup,
  disableMfa,
};
