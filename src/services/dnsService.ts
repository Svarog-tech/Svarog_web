// DNS Management Service
// API client pro správu DNS zón a záznamů přes HestiaCP

import { apiCall } from '../lib/api';

export interface DnsDomain {
  domain: string;
}

export interface DnsRecord {
  id: string;
  name: string;
  type: string;
  value: string;
  priority?: number;
  ttl?: number;
}

/**
 * Získá seznam všech DNS domén pro službu
 */
export async function getDnsDomains(serviceId: number): Promise<DnsDomain[]> {
  const response = await apiCall<{ success: boolean; domains: string[] }>(
    `/hosting-services/${serviceId}/dns/domains`
  );
  return (response.domains || []).map(domain => ({ domain }));
}

/**
 * Získá seznam DNS záznamů pro doménu
 */
export async function getDnsRecords(serviceId: number, domain: string): Promise<DnsRecord[]> {
  const response = await apiCall<{ success: boolean; records: DnsRecord[] }>(
    `/hosting-services/${serviceId}/dns/domains/${encodeURIComponent(domain)}/records`
  );
  return response.records || [];
}

/**
 * Přidá DNS záznam
 */
export async function addDnsRecord(
  serviceId: number,
  domain: string,
  name: string,
  type: string,
  value: string,
  priority?: number,
  ttl?: number
): Promise<void> {
  await apiCall(`/hosting-services/${serviceId}/dns/domains/${encodeURIComponent(domain)}/records`, {
    method: 'POST',
    body: JSON.stringify({ name, type, value, priority, ttl }),
  });
}

/**
 * Smaže DNS záznam
 */
export async function deleteDnsRecord(
  serviceId: number,
  domain: string,
  recordId: string
): Promise<void> {
  await apiCall(
    `/hosting-services/${serviceId}/dns/domains/${encodeURIComponent(domain)}/records/${encodeURIComponent(recordId)}`,
    {
      method: 'DELETE',
    }
  );
}

/**
 * Přidá DNS doménu
 */
export async function addDnsDomain(
  serviceId: number,
  domain: string,
  ip?: string
): Promise<void> {
  await apiCall(`/hosting-services/${serviceId}/dns/domains`, {
    method: 'POST',
    body: JSON.stringify({ domain, ip }),
  });
}

/**
 * Smaže DNS doménu
 */
export async function deleteDnsDomain(
  serviceId: number,
  domain: string
): Promise<void> {
  await apiCall(`/hosting-services/${serviceId}/dns/domains/${encodeURIComponent(domain)}`, {
    method: 'DELETE',
  });
}
