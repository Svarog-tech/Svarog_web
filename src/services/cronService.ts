// Cron Jobs Management Service
// API client pro správu cron jobů přes HestiaCP

import { apiCall } from '../lib/api';

export interface CronJob {
  id: string;
  min: string;
  hour: string;
  day: string;
  month: string;
  weekday: string;
  command: string;
  suspended: boolean;
}

/**
 * Získá seznam cron jobů pro službu
 */
export async function getCronJobs(serviceId: number): Promise<CronJob[]> {
  const response = await apiCall<{ success: boolean; cronJobs: CronJob[] }>(
    `/hosting-services/${serviceId}/cron`
  );
  return response.cronJobs || [];
}

/**
 * Vytvoří nový cron job
 */
export async function createCronJob(
  serviceId: number,
  min: string,
  hour: string,
  day: string,
  month: string,
  weekday: string,
  command: string
): Promise<void> {
  await apiCall(`/hosting-services/${serviceId}/cron`, {
    method: 'POST',
    body: JSON.stringify({ min, hour, day, month, weekday, command }),
  });
}

/**
 * Smaže cron job
 */
export async function deleteCronJob(
  serviceId: number,
  jobId: string
): Promise<void> {
  await apiCall(
    `/hosting-services/${serviceId}/cron/${encodeURIComponent(jobId)}`,
    {
      method: 'DELETE',
    }
  );
}

/**
 * Pozastaví nebo obnoví cron job
 */
export async function suspendCronJob(
  serviceId: number,
  jobId: string,
  suspend: boolean
): Promise<void> {
  await apiCall(
    `/hosting-services/${serviceId}/cron/${encodeURIComponent(jobId)}/suspend`,
    {
      method: 'PUT',
      body: JSON.stringify({ suspend }),
    }
  );
}

/**
 * Formátuje cron schedule do čitelného formátu
 */
export function formatCronSchedule(job: CronJob): string {
  return `${job.min} ${job.hour} ${job.day} ${job.month} ${job.weekday}`;
}

/**
 * Validuje cron schedule
 */
export function validateCronSchedule(
  min: string,
  hour: string,
  day: string,
  month: string,
  weekday: string
): { valid: boolean; error?: string } {
  if (min !== '*' && (isNaN(Number(min)) || Number(min) < 0 || Number(min) > 59)) {
    return { valid: false, error: 'Minuta musí být * nebo číslo 0-59' };
  }
  if (hour !== '*' && (isNaN(Number(hour)) || Number(hour) < 0 || Number(hour) > 23)) {
    return { valid: false, error: 'Hodina musí být * nebo číslo 0-23' };
  }
  if (day !== '*' && (isNaN(Number(day)) || Number(day) < 1 || Number(day) > 31)) {
    return { valid: false, error: 'Den musí být * nebo číslo 1-31' };
  }
  if (month !== '*' && (isNaN(Number(month)) || Number(month) < 1 || Number(month) > 12)) {
    return { valid: false, error: 'Měsíc musí být * nebo číslo 1-12' };
  }
  if (weekday !== '*' && (isNaN(Number(weekday)) || Number(weekday) < 0 || Number(weekday) > 7)) {
    return { valid: false, error: 'Den v týdnu musí být * nebo číslo 0-7' };
  }
  return { valid: true };
}
