import { fetchJson } from '@/lib/api';

export interface ActivityLogActor {
  id: number;
  name: string;
  email: string;
}

export interface ActivityLogEntry {
  id: number;
  actor: ActivityLogActor | null;
  event: string;
  subject_type: string | null;
  subject_id: number | null;
  description: string;
  properties: Record<string, unknown>;
  created_at: string;
}

export interface ActivityLogMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface ActivityLogResponse {
  data: ActivityLogEntry[];
  meta: ActivityLogMeta;
}

export interface ActivityLogParams {
  causer_id?: number | string | null;
  subject_type?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  page?: number | null;
  per_page?: number | null;
}

export async function fetchActivityLogs(
  params: ActivityLogParams = {}
): Promise<ActivityLogResponse> {
  const query = new URLSearchParams();

  if (params.causer_id !== undefined && params.causer_id !== null && String(params.causer_id).trim() !== '') {
    const parsed = Number(params.causer_id);
    if (!Number.isNaN(parsed) && Number.isInteger(parsed) && parsed > 0) {
      query.set('causer_id', String(parsed));
    }
  }

  if (params.subject_type && params.subject_type.trim() !== '' && params.subject_type.toLowerCase() !== 'all') {
    query.set('subject_type', params.subject_type.trim());
  }

  if (params.date_from && params.date_from.trim() !== '') {
    query.set('date_from', params.date_from.trim());
  }

  if (params.date_to && params.date_to.trim() !== '') {
    query.set('date_to', params.date_to.trim());
  }

  if (params.page && Number(params.page) > 1) {
    query.set('page', String(params.page));
  }

  if (params.per_page && Number(params.per_page) > 0) {
    query.set('per_page', String(params.per_page));
  }

  const qs = query.toString();
  return fetchJson<ActivityLogResponse>(`/admin/system/activity-logs${qs ? `?${qs}` : ''}`);
}
