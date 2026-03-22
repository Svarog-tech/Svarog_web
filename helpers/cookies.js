// SECURITY: Helper pro nastavení httpOnly refresh token cookie
const REFRESH_COOKIE_NAME = 'refresh_token';

function setRefreshTokenCookie(res, token, maxAgeMs) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: maxAgeMs || 7 * 24 * 60 * 60 * 1000, // 7 dní default
  });
}

function clearRefreshTokenCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
  });
}

module.exports = { REFRESH_COOKIE_NAME, setRefreshTokenCookie, clearRefreshTokenCookie };
