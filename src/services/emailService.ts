// Email Management Service
// API client pro správu email účtů přes HestiaCP

import { apiCall } from '../lib/api';

export interface EmailAccount {
  id: string;
  email: string;
  domain: string;
  quota_used: number;
  quota_limit: number;
  quota_percent: number;
  suspended: boolean;
}

export interface EmailQuota {
  used: number;
  limit: number;
}

/**
 * Získá seznam všech email účtů pro službu
 */
export async function getEmailAccounts(serviceId: number): Promise<EmailAccount[]> {
  const response = await apiCall<{ success: boolean; emails: EmailAccount[] }>(
    `/hosting-services/${serviceId}/emails`
  );
  return response.emails || [];
}

/**
 * Vytvoří nový email účet
 */
export async function createEmailAccount(
  serviceId: number,
  domain: string,
  email: string,
  password: string
): Promise<void> {
  await apiCall(`/hosting-services/${serviceId}/emails`, {
    method: 'POST',
    body: JSON.stringify({ domain, email, password }),
  });
}

/**
 * Smazání email účtu
 */
export async function deleteEmailAccount(
  serviceId: number,
  emailId: string
): Promise<void> {
  await apiCall(`/hosting-services/${serviceId}/emails/${encodeURIComponent(emailId)}`, {
    method: 'DELETE',
  });
}

/**
 * Změna hesla email účtu
 */
export async function changeEmailPassword(
  serviceId: number,
  emailId: string,
  password: string
): Promise<void> {
  await apiCall(`/hosting-services/${serviceId}/emails/${encodeURIComponent(emailId)}/password`, {
    method: 'PUT',
    body: JSON.stringify({ password }),
  });
}

/**
 * Získá quota email účtu
 */
export async function getEmailQuota(
  serviceId: number,
  emailId: string
): Promise<EmailQuota> {
  const response = await apiCall<{ success: boolean; quota: EmailQuota }>(
    `/hosting-services/${serviceId}/emails/${encodeURIComponent(emailId)}/quota`
  );
  return response.quota;
}
