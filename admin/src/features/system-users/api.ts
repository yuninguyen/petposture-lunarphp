import { fetchJson } from '@/lib/api';

export interface SystemUser {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  roles: string[];
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SystemUserPayload {
  name: string;
  email: string;
  password?: string;
  roles: string[];
  is_active?: boolean;
}

export type SystemUserResponse = SystemUser | { data: SystemUser };
export type SystemUsersResponse = SystemUser[] | { data: SystemUser[] };

export function normalizeSystemUsersResponse(response: SystemUsersResponse): SystemUser[] {
  return Array.isArray(response) ? response : response.data;
}

export function normalizeSystemUserResponse(response: SystemUserResponse): SystemUser {
  return 'data' in response ? response.data : response;
}

export async function fetchSystemUsers(): Promise<SystemUser[]> {
  return normalizeSystemUsersResponse(await fetchJson<SystemUsersResponse>('/admin/system/users'));
}

export async function createSystemUser(payload: SystemUserPayload): Promise<SystemUser> {
  return normalizeSystemUserResponse(
    await fetchJson<SystemUserResponse>('/admin/system/users', {
      method: 'POST',
      body: { ...payload },
    })
  );
}

export async function updateSystemUser(
  id: number,
  payload: Partial<SystemUserPayload>
): Promise<SystemUser> {
  return normalizeSystemUserResponse(
    await fetchJson<SystemUserResponse>(`/admin/system/users/${id}`, {
      method: 'PUT',
      body: { ...payload },
    })
  );
}

export async function deleteSystemUser(id: number): Promise<void> {
  await fetchJson(`/admin/system/users/${id}`, { method: 'DELETE' });
}
