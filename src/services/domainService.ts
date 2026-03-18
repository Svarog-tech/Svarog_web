// Domain Management Service
// API client pro správu web domén přes HestiaCP

import { apiCall } from '../lib/api';

export interface WebDomain {
  domain: string;
  ip: string;
  ssl: boolean;
  ssl_cert: string;
  ssl_key: string;
  ssl_ca: string;
  aliases: string;
  document_root: string;
  suspended: boolean;
}

/**
 * Získá seznam všech web domén pro službu
 */
export async function getWebDomains(serviceId: number): Promise<WebDomain[]> {
  const response = await apiCall<{ success: boolean; domains: WebDomain[] }>(
    `/hosting-services/${serviceId}/domains`
  );
  return response.domains || [];
}

/**
 * Získá informace o konkrétní doméně
 */
export async function getWebDomainInfo(serviceId: number, domain: string): Promise<WebDomain> {
  const response = await apiCall<{ success: boolean; domain: WebDomain }>(
    `/hosting-services/${serviceId}/domains/${encodeURIComponent(domain)}`
  );
  return response.domain;
}

// --- Domain availability search (pro veřejnou stránku Domény) ---

export interface DomainSearchResult {
  searchedDomain: string;
  results: { domain: string; available: boolean; error?: string; price?: string }[];
}

const POPULAR_EXTENSIONS = ['.cz', '.com', '.eu', '.sk', '.net', '.org', '.info', '.online', '.store', '.shop'];
const EXTENSION_GROUPS: Record<string, string[]> = {
  popular: POPULAR_EXTENSIONS,
  cesko: ['.cz', '.sk', '.eu'],
  svet: ['.com', '.net', '.org', '.eu', '.info'],
};

export function getExtensionGroups(): Record<string, string[]> {
  return EXTENSION_GROUPS;
}

export function getPopularExtensions(): string[] {
  return [...POPULAR_EXTENSIONS];
}

export function getAllExtensions(): string[] {
  const set = new Set<string>();
  Object.values(EXTENSION_GROUPS).forEach((arr) => arr.forEach((e) => set.add(e)));
  return Array.from(set);
}

/**
 * Kontrola dostupnosti domén přes backend DNS lookup.
 */
export async function searchDomains(
  baseName: string,
  extensions: string[]
): Promise<DomainSearchResult> {
  const clean = baseName.replace(/\./g, '').toLowerCase();
  if (!clean) {
    return { searchedDomain: baseName, results: [] };
  }

  const domains = extensions.map((ext) =>
    `${clean}${ext.startsWith('.') ? ext : '.' + ext}`
  );

  try {
    const response = await fetch('/api/domains/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domains }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Chyba při vyhledávání domén');
    }

    const data = await response.json();
    return { searchedDomain: baseName, results: data.results };
  } catch (error: any) {
    if (error.message === 'Failed to fetch') {
      return {
        searchedDomain: baseName,
        results: domains.map((domain) => ({
          domain,
          available: false,
          error: 'Backend server není dostupný',
        })),
      };
    }
    throw error;
  }
}
