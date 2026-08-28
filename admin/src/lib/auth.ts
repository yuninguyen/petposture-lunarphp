import { fetchJson } from './api';

const ADMIN_ROLES = ['super_admin', 'admin', 'staff'];

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

export function isAdminRole(roles: string[]): boolean {
  return roles.some((role) => ADMIN_ROLES.includes(role));
}

export async function login(email: string, password: string): Promise<{ user: AdminUser }> {
  const res = await fetchJson<{ data: { user: AdminUser } }>('/login', {
    method: 'POST',
    body: { email, password },
  });
  return res.data;
}

export async function fetchCurrentUser(): Promise<AdminUser> {
  const res = await fetchJson<{ data: AdminUser }>('/me');
  return res.data;
}

export async function logout(): Promise<void> {
  await fetchJson('/logout', { method: 'POST' });
}
