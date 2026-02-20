/**
 * Základní URL pro canonical a OG (produkce: VITE_APP_BASE_URL nebo window.location.origin).
 */
export const getBaseUrl = (): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_BASE_URL) {
    return (import.meta.env.VITE_APP_BASE_URL as string).replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:3000';
};
