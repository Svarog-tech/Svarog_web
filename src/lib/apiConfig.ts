/**
 * Sdílená konfigurace API URL – jediné místo pro definici.
 * Importuj toto v auth.ts i api.ts pro konzistentní URL.
 *
 * Chování:
 * - pokud je nastaveno VITE_API_URL → použij ho
 * - jinak relativní /api (v dev prostředí proxy přes Vite, v produkci stejná doména)
 */
const resolveApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (envUrl) {
    return envUrl;
  }
  return '/api';
};

export const API_BASE_URL = resolveApiBaseUrl();

/** Base URL bez /api (pro webhook, proxy, download) */
export const API_ROOT_URL =
  API_BASE_URL.replace(/\/api\/?$/, '') ||
  (typeof window !== 'undefined' ? window.location.origin : '');
