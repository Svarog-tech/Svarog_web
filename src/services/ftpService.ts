// FTP Management Service
// API client pro správu FTP účtů přes HestiaCP

import { apiCall } from '../lib/api';

export interface FtpAccount {
  id: string;
  username: string;
  path: string;
  suspended: boolean;
}

export interface FtpListResponse {
  success: boolean;
  domain?: string;
  accounts: FtpAccount[];
}

/**
 * Získá seznam FTP účtů pro službu (pro danou doménu)
 */
export async function getFtpAccounts(
  serviceId: number,
  domain?: string
): Promise<{ domain: string; accounts: FtpAccount[] }> {
  const query = domain ? `?domain=${encodeURIComponent(domain)}` : '';
  const response = await apiCall<FtpListResponse>(
    `/hosting-services/${serviceId}/ftp${query}`
  );
  return {
    domain: response.domain || '',
    accounts: response.accounts || [],
  };
}

/**
 * Vytvoří nový FTP účet
 */
export async function createFtpAccount(
  serviceId: number,
  username: string,
  password: string,
  path?: string,
  domain?: string
): Promise<void> {
  await apiCall(`/hosting-services/${serviceId}/ftp`, {
    method: 'POST',
    body: JSON.stringify({ domain, username, password, path: path || 'public_html' }),
  });
}

/**
 * Smazání FTP účtu
 */
export async function deleteFtpAccount(
  serviceId: number,
  domain: string,
  ftpId: string
): Promise<void> {
  await apiCall(
    `/hosting-services/${serviceId}/ftp/${encodeURIComponent(domain)}/${encodeURIComponent(ftpId)}`,
    {
      method: 'DELETE',
    }
  );
}

/**
 * Změna hesla FTP účtu
 */
export async function changeFtpPassword(
  serviceId: number,
  domain: string,
  ftpId: string,
  password: string
): Promise<void> {
  await apiCall(
    `/hosting-services/${serviceId}/ftp/${encodeURIComponent(domain)}/${encodeURIComponent(ftpId)}/password`,
    {
      method: 'PUT',
      body: JSON.stringify({ password }),
    }
  );
}
