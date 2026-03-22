const express = require('express');
const router = express.Router();

module.exports = function({ db, logger, hestiacp, authLimiter, sensitiveOpLimiter, authenticateUser, requireCsrfGuard, setRefreshTokenCookie, clearRefreshTokenCookie, REFRESH_COOKIE_NAME }) {
  const { asyncHandler, AppError } = require('../middleware/errorHandler');
  const authService = require('../services/authService');
  const oauthService = require('../services/oauthService');
  const { sendTicketNotificationEmail } = require('../services/emailService');

  // Docasne uloziste pro OAuth state (prevence CSRF)
  // V produkci by melo byt v Redis/DB, ale pro maly provoz staci in-memory s TTL
  const oauthStates = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of oauthStates) {
      if (now - value.createdAt > 10 * 60 * 1000) { // 10 minut TTL
        oauthStates.delete(key);
      }
    }
  }, 60 * 1000);

  /**
   * Registrace noveho uzivatele
   */
  router.post('/register',
    authLimiter,
    asyncHandler(async (req, res) => {
      logger.request(req, 'User registration attempt');

      const { email, password, firstName, lastName } = req.body;

      // Validace
      if (!email || !password || !firstName || !lastName) {
        throw new AppError('Vsechna pole jsou povinna', 400);
      }

      // SECURITY: Validace email formatu
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new AppError('Neplatny format emailu', 400);
      }

      // SECURITY: Validace minimalni delky hesla
      if (typeof password !== 'string' || password.length < 8) {
        throw new AppError('Heslo musi mit alespon 8 znaku', 400);
      }

      // SECURITY: Validace delky jmen (prevence long input attacks)
      if (typeof firstName !== 'string' || firstName.length > 100 ||
          typeof lastName !== 'string' || lastName.length > 100) {
        throw new AppError('Jmeno a prijmeni nesmi byt delsi nez 100 znaku', 400);
      }

      // SECURITY: Kontrola zda email jiz neexistuje v HestiaCP (prevence duplicit)
      try {
        const hestiaUsers = await hestiacp.listUsers();
        if (hestiaUsers.success && hestiaUsers.users) {
          const emailLower = email.toLowerCase().trim();
          const existsInHestia = hestiaUsers.users.some(
            u => u.email && u.email.toLowerCase().trim() === emailLower
          );
          if (existsInHestia) {
            throw new AppError('Tento email je jiz registrovan v systemu. Kontaktujte podporu pro pristup.', 409);
          }
        }
      } catch (hestiaError) {
        // Pokud HestiaCP neni dostupne, pokracuj v registraci (neblokuj)
        if (hestiaError instanceof AppError) throw hestiaError;
        logger.warn('HestiaCP check during registration failed, continuing', { error: hestiaError.message });
      }

      const result = await authService.register(email, password, firstName, lastName);

      if (result.success) {
        logger.request(req, 'User registered successfully', { userId: result.user.id });

        // Affiliate referral tracking
        try {
          const referralCode = req.body.referred_by || req.cookies?.affiliate_ref;
          if (referralCode && typeof referralCode === 'string') {
            const cleanCode = referralCode.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
            if (cleanCode) {
              const affiliate = await db.queryOne(
                'SELECT id FROM affiliate_accounts WHERE referral_code = ? AND is_active = 1',
                [cleanCode]
              );
              if (affiliate) {
                // Store referred_by on user record
                await db.execute(
                  'UPDATE users SET referred_by = ? WHERE id = ?',
                  [cleanCode, result.user.id]
                );
                // Create referral record
                const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || null;
                await db.execute(
                  'INSERT INTO affiliate_referrals (affiliate_id, referred_user_id, ip_address) VALUES (?, ?, ?)',
                  [affiliate.id, result.user.id, ipAddress]
                );
                // Increment total_referrals
                await db.execute(
                  'UPDATE affiliate_accounts SET total_referrals = total_referrals + 1 WHERE id = ?',
                  [affiliate.id]
                );
                logger.info('Affiliate referral tracked', { userId: result.user.id, affiliateId: affiliate.id, code: cleanCode });
              }
            }
          }
        } catch (refErr) {
          // Don't block registration if referral tracking fails
          logger.warn('Affiliate referral tracking failed', { error: refErr.message, userId: result.user.id });
        }

        // SECURITY: Refresh token do httpOnly cookie, ne do response body
        setRefreshTokenCookie(res, result.refreshToken);
        res.status(201).json({
          success: true,
          user: result.user,
          accessToken: result.accessToken,
          message: result.message
        });
      } else {
        logger.warn('Registration failed', { requestId: req.id, error: result.error });
        throw new AppError(result.error || 'Registrace se nezdarila', 400);
      }
    })
  );

  /**
   * Prihlaseni uzivatele
   */
  router.post('/login',
    authLimiter,
    asyncHandler(async (req, res) => {
      logger.request(req, 'User login attempt');

      const { email, password, mfaCode, recoveryCode } = req.body || {};

      if (!email || !password) {
        throw new AppError('Email a heslo jsou povinne', 400);
      }

      // SECURITY: Validate types to prevent NoSQL-style injection
      if (typeof email !== 'string' || typeof password !== 'string') {
        throw new AppError('Email a heslo musi byt textove retezce', 400);
      }

      const result = await authService.login(email, password, mfaCode, recoveryCode);

      if (result.success) {
        logger.request(req, 'User logged in successfully', { userId: result.user.id });
        // SECURITY: Refresh token do httpOnly cookie
        setRefreshTokenCookie(res, result.refreshToken);
        res.json({
          success: true,
          user: result.user,
          accessToken: result.accessToken,
        });
      } else {
        if (result.mfaRequired) {
          logger.warn('Login MFA required', { requestId: req.id, email });
          return res.status(401).json({
            success: false,
            error: result.error || 'Je vyzadovan overovaci kod',
            mfaRequired: true,
          });
        }
        logger.warn('Login failed', { requestId: req.id, email });
        throw new AppError(result.error || 'Nespravny email nebo heslo', 401);
      }
    })
  );

  /**
   * Refresh access token
   */
  router.post('/refresh',
    requireCsrfGuard,
    asyncHandler(async (req, res) => {
      // SECURITY: Cti refresh token z httpOnly cookie (fallback na body pro zpetnou kompatibilitu)
      const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

      if (!refreshToken) {
        throw new AppError('Refresh token je povinny', 400);
      }

      const result = await authService.refreshAccessToken(refreshToken);

      if (result.success) {
        // SECURITY: Refresh token rotation - uloz novy refresh token do httpOnly cookie
        if (result.refreshToken) {
          setRefreshTokenCookie(res, result.refreshToken);
        }
        res.json({
          success: true,
          accessToken: result.accessToken,
          user: result.user
        });
      } else {
        clearRefreshTokenCookie(res);
        throw new AppError(result.error || 'Neplatny refresh token', 401);
      }
    })
  );

  /**
   * Odhlaseni uzivatele
   */
  router.post('/logout',
    requireCsrfGuard,
    asyncHandler(async (req, res) => {
      // SECURITY: Cti refresh token z httpOnly cookie (fallback na body)
      const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;

      if (refreshToken) {
        await authService.logout(refreshToken);
      }

      // Smaz cookie
      clearRefreshTokenCookie(res);
      res.json({ success: true, message: 'Odhlaseni uspesne' });
    })
  );

  /**
   * Odhlaseni ze vsech zarizeni (invalidace vsech refresh tokenu uzivatele)
   * POST /logout-all
   */
  router.post('/logout-all',
    authenticateUser,
    requireCsrfGuard,
    sensitiveOpLimiter,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const result = await authService.logoutAll(userId);

      if (!result.success) {
        throw new AppError(result.error || 'Odhlaseni ze vsech zarizeni se nezdarilo', 500);
      }

      clearRefreshTokenCookie(res);
      res.json({
        success: true,
        message: `Byl jste odhlasen ze vsech zarizeni (${result.deletedCount || 0} relaci)`
      });
    })
  );

  // ============================================
  // OAuth Endpoints (Google, GitHub)
  // ============================================

  /**
   * Zahajeni OAuth flow - presmeruje na provider
   */
  router.get('/oauth/:provider/start',
    authLimiter,
    asyncHandler(async (req, res) => {
      const { provider } = req.params;
      const { redirect } = req.query;

      if (!['google', 'github'].includes(provider)) {
        throw new AppError(`Nepodporovany OAuth provider: ${provider}`, 400);
      }

      if (!oauthService.isProviderConfigured(provider)) {
        throw new AppError(`OAuth provider ${provider} neni nakonfigurovany. Nastavte ${provider.toUpperCase()}_CLIENT_ID a ${provider.toUpperCase()}_CLIENT_SECRET v .env`, 500);
      }

      // Generuj state token pro CSRF ochranu
      const state = require('crypto').randomBytes(32).toString('hex');
      oauthStates.set(state, {
        provider,
        frontendRedirect: redirect || '/',
        createdAt: Date.now(),
      });

      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const callbackUrl = `${appUrl.replace(/\/+$/, '')}/api/auth/oauth/${provider}/callback`;

      const authorizationUrl = oauthService.getAuthorizationUrl(provider, callbackUrl, state);
      res.redirect(authorizationUrl);
    })
  );

  /**
   * OAuth callback - provider presmeruje sem po autorizaci
   */
  router.get('/oauth/:provider/callback',
    asyncHandler(async (req, res) => {
      const { provider } = req.params;
      const { code, state, error: oauthError } = req.query;

      // Zjisti frontend redirect z ulozeneho state
      const stateData = state ? oauthStates.get(state) : null;
      const frontendRedirect = stateData?.frontendRedirect || '/auth/callback';
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      // Podporovat plnou URL (https://...) i relativni cestu
      let frontendUrl;
      if (/^https?:\/\//i.test(frontendRedirect)) {
        // Frontend posila celou URL - over ze domena odpovida APP_URL
        try {
          const redirectHost = new URL(frontendRedirect).hostname.replace(/^www\./, '');
          const appHost = new URL(appUrl).hostname.replace(/^www\./, '');
          if (redirectHost === appHost) {
            frontendUrl = frontendRedirect;
          } else {
            frontendUrl = `${appUrl.replace(/\/+$/, '')}/auth/callback`;
          }
        } catch {
          frontendUrl = `${appUrl.replace(/\/+$/, '')}/auth/callback`;
        }
      } else {
        frontendUrl = `${appUrl.replace(/\/+$/, '')}${frontendRedirect.startsWith('/') ? frontendRedirect : '/' + frontendRedirect}`;
      }

      // Vycisti state
      if (state) {
        oauthStates.delete(state);
      }

      // Chyba od providera
      if (oauthError) {
        logger.warn('OAuth error from provider', { provider, error: oauthError });
        return res.redirect(`${frontendUrl}?error=${encodeURIComponent(oauthError)}`);
      }

      // Validace
      if (!code || !state || !stateData) {
        logger.warn('OAuth callback missing code or invalid state', { provider, hasCode: !!code, hasState: !!state });
        return res.redirect(`${frontendUrl}?error=${encodeURIComponent('Neplatny OAuth pozadavek')}`);
      }

      if (stateData.provider !== provider) {
        logger.warn('OAuth state provider mismatch', { expected: stateData.provider, got: provider });
        return res.redirect(`${frontendUrl}?error=${encodeURIComponent('Neplatny OAuth pozadavek')}`);
      }

      try {
        const callbackUrl = `${appUrl.replace(/\/+$/, '')}/api/auth/oauth/${provider}/callback`;

        // Vymen code za access token
        const oauthAccessToken = await oauthService.exchangeCodeForToken(provider, code, callbackUrl);

        // Ziskej profil uzivatele
        const profile = await oauthService.getUserProfile(provider, oauthAccessToken);

        // Najdi nebo vytvor uzivatele
        const user = await oauthService.findOrCreateUser(provider, profile);

        // Vydej JWT tokeny
        const accessToken = authService.generateAccessToken(user);
        const refreshToken = authService.generateRefreshToken(user);

        // Uloz refresh token do DB
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        await db.execute(
          `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`,
          [user.id, refreshToken, expiresAt]
        );

        // Nastav refresh token cookie
        setRefreshTokenCookie(res, refreshToken);

        logger.info('OAuth login successful', { provider, userId: user.id, email: user.email });

        // Redirect na frontend s access tokenem v URL fragment (bezpecnejsi nez query string - neodesila se na server)
        res.redirect(`${frontendUrl}#access_token=${accessToken}`);

      } catch (err) {
        logger.error('OAuth callback error', { provider, error: err.message });
        res.redirect(`${frontendUrl}?error=${encodeURIComponent(err.message || 'OAuth prihlaseni se nezdarilo')}`);
      }
    })
  );

  /**
   * Ziskani aktualniho uzivatele
   */
  router.get('/user',
    authenticateUser,
    asyncHandler(async (req, res) => {
      // Nacti plny profil uzivatele z MySQL (users + profiles)
      const fullUser = await db.queryOne(
        `SELECT
           u.id,
           u.email,
           u.email_verified,
           u.mfa_enabled,
           u.provider,
           u.created_at,
           u.updated_at,
           p.first_name,
           p.last_name,
           p.is_admin,
           p.avatar_url
         FROM users u
         LEFT JOIN profiles p ON p.id = u.id
         WHERE u.id = ?`,
        [req.user.id]
      );

      if (!fullUser) {
        throw new AppError('User not found', 404);
      }

      // Response tvar prizpusobeny frontend typum UserProfile / AppUser
      res.json({
        success: true,
        user: {
          id: fullUser.id,
          email: fullUser.email,
          first_name: fullUser.first_name,
          last_name: fullUser.last_name,
          is_admin: !!fullUser.is_admin,
          avatar_url: fullUser.avatar_url,
          email_verified: !!fullUser.email_verified,
          created_at: fullUser.created_at,
          updated_at: fullUser.updated_at,
          two_factor_enabled: !!fullUser.mfa_enabled
        }
      });
    })
  );

  /**
   * Aktualizace profilu prihlaseneho uzivatele (first_name, last_name, avatar_url)
   * PUT /user
   * body: { first_name?, last_name?, avatar_url? }
   */
  router.put('/user',
    authenticateUser,
    asyncHandler(async (req, res) => {
      const { first_name, last_name, avatar_url } = req.body || {};
      const userId = req.user.id;

      const fields = [];
      const values = [];

      if (typeof first_name === 'string') {
        fields.push('first_name = ?');
        values.push(first_name.trim());
      }
      if (typeof last_name === 'string') {
        fields.push('last_name = ?');
        values.push(last_name.trim());
      }
      if (typeof avatar_url === 'string') {
        // SECURITY: Validace avatar URL - povoleny jen http(s) protokoly (prevence javascript: XSS)
        const trimmedUrl = avatar_url.trim();
        if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
          throw new AppError('Avatar URL must start with http:// or https://', 400);
        }
        fields.push('avatar_url = ?');
        values.push(trimmedUrl);
      }

      if (fields.length === 0) {
        throw new AppError('No valid fields to update', 400);
      }

      fields.push('updated_at = NOW()');
      values.push(userId);

      await db.execute(
        `UPDATE profiles SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      res.json({ success: true });
    })
  );

  /**
   * Resetovani hesla - zadost
   */
  router.post('/reset-password-request',
    authLimiter,
    asyncHandler(async (req, res) => {
      const { email } = req.body;

      if (!email) {
        throw new AppError('Email je povinny', 400);
      }

      const result = await authService.requestPasswordReset(email);
      res.json(result);
    })
  );

  /**
   * Resetovani hesla - zmena hesla
   */
  router.post('/reset-password',
    authLimiter,
    asyncHandler(async (req, res) => {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        throw new AppError('Token a nove heslo jsou povinne', 400);
      }

      const result = await authService.resetPassword(token, newPassword);

      if (result.success) {
        res.json(result);
      } else {
        throw new AppError(result.error || 'Resetovani hesla se nezdarilo', 400);
      }
    })
  );

  /**
   * Overeni emailu pomoci tokenu
   */
  router.post('/verify-email',
    authLimiter,
    asyncHandler(async (req, res) => {
      const { token } = req.body || {};

      if (!token) {
        throw new AppError('Verifikacni token je povinny', 400);
      }

      const result = await authService.verifyEmail(token);

      if (result.success) {
        res.json(result);
      } else {
        throw new AppError(result.error || 'Overeni emailu se nezdarilo', 400);
      }
    })
  );

  /**
   * Zaslat znovu overovaci email (pouze prihlaseny uzivatel)
   */
  router.post('/resend-verification',
    authenticateUser,
    authLimiter,
    asyncHandler(async (req, res) => {
      const email = req.user.email;

      if (!email) {
        throw new AppError('Uzivatel nema nastaveny email', 400);
      }

      try {
        await authService.createEmailVerificationForUser(req.user.id, email);
      } catch (error) {
        logger.errorRequest(req, error, { context: 'resend_verification' });
        throw new AppError('Odeslani overovaciho emailu se nezdarilo', 500);
      }

      res.json({
        success: true,
        message: 'Pokud email jeste neni overen, byl odeslan novy overovaci email',
      });
    })
  );

  /**
   * MFA: Zacatek nastaveni (vytvoreni secretu a recovery kodu)
   */
  router.post('/mfa/setup',
    sensitiveOpLimiter,
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const email = req.user.email;

      const setup = await authService.startMfaSetup(userId, email);

      res.json({
        success: true,
        ...setup,
      });
    })
  );

  /**
   * MFA: Potvrzeni nastaveni (overeni TOTP kodu)
   */
  router.post('/mfa/verify',
    sensitiveOpLimiter,
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const { code } = req.body || {};

      if (!code) {
        throw new AppError('Overovaci kod je povinny', 400);
      }

      const result = await authService.confirmMfaSetup(userId, String(code));

      if (result.success) {
        res.json(result);
      } else {
        throw new AppError(result.error || 'Overeni kodu se nezdarilo', 400);
      }
    })
  );

  /**
   * MFA: Vypnuti (vyzaduje heslo)
   */
  router.post('/mfa/disable',
    sensitiveOpLimiter,
    authenticateUser,
    asyncHandler(async (req, res) => {
      const userId = req.user.id;
      const { password } = req.body || {};

      if (!password) {
        throw new AppError('Heslo je povinne', 400);
      }

      const result = await authService.disableMfa(userId, password);

      if (result.success) {
        res.json(result);
      } else {
        throw new AppError(result.error || 'Vypnuti 2FA se nezdarilo', 400);
      }
    })
  );

  /**
   * Zmena hesla prihlaseneho uzivatele
   */
  router.post('/change-password',
    sensitiveOpLimiter,
    authenticateUser,
    asyncHandler(async (req, res) => {
      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword) {
        throw new AppError('Stare i nove heslo jsou povinne', 400);
      }

      const result = await authService.changePassword(req.user.id, oldPassword, newPassword);

      if (result.success) {
        res.json(result);
      } else {
        throw new AppError(result.error || 'Zmena hesla se nezdarila', 400);
      }
    })
  );

  return router;
};
