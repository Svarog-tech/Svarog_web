// Backup Management Service
// API client pro správu záloh přes HestiaCP

import { apiCall } from '../lib/api';

export interface Backup {
  id: string;
  date: string;
  size: number;
  status: string;
}

/**
 * Získá seznam záloh pro službu
 */
export async function getBackups(serviceId: number): Promise<Backup[]> {
  const response = await apiCall<{ success: boolean; backups: Backup[] }>(
    `/hosting-services/${serviceId}/backups`
  );
  return response.backups || [];
}

/**
 * Vytvoří novou zálohu
 */
export async function createBackup(
  serviceId: number,
  notify?: boolean
): Promise<void> {
  await apiCall(`/hosting-services/${serviceId}/backups/create`, {
    method: 'POST',
    body: JSON.stringify({ notify: notify || false }),
  });
}

/**
 * Obnoví zálohu
 */
export async function restoreBackup(
  serviceId: number,
  backupId: string
): Promise<void> {
  await apiCall(
    `/hosting-services/${serviceId}/backups/${encodeURIComponent(backupId)}/restore`,
    {
      method: 'POST',
    }
  );
}

/**
 * Smaže zálohu
 */
export async function deleteBackup(
  serviceId: number,
  backupId: string
): Promise<void> {
  await apiCall(
    `/hosting-services/${serviceId}/backups/${encodeURIComponent(backupId)}`,
    {
      method: 'DELETE',
    }
  );
}

/**
 * Formátuje velikost zálohy
 */
export function formatBackupSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
