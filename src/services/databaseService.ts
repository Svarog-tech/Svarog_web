// Database Management Service
// API client pro správu databází přes HestiaCP

import { apiCall } from '../lib/api';

export interface Database {
  name: string;
  type: string;
  host: string;
  charset: string;
  users: string[];
}

/**
 * Získá seznam všech databází pro službu
 */
export async function getDatabases(serviceId: number): Promise<Database[]> {
  const response = await apiCall<{ success: boolean; databases: Database[] }>(
    `/hosting-services/${serviceId}/databases`
  );
  return response.databases || [];
}

/**
 * Vytvoří novou databázi
 */
export async function createDatabase(
  serviceId: number,
  database: string,
  dbuser: string,
  password: string
): Promise<void> {
  await apiCall(`/hosting-services/${serviceId}/databases`, {
    method: 'POST',
    body: JSON.stringify({ database, dbuser, password }),
  });
}

/**
 * Smazání databáze
 */
export async function deleteDatabase(
  serviceId: number,
  database: string
): Promise<void> {
  await apiCall(`/hosting-services/${serviceId}/databases/${encodeURIComponent(database)}`, {
    method: 'DELETE',
  });
}
