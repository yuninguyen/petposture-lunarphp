import { fetchJson } from './api';

const TOKEN_KEY = 'petposture_admin_token';
const ADMIN_ROLES = ['super_admin', 'admin', 'staff'];

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function isAdminRole(roles: string[]): boolean {
  return roles.some((role) => ADMIN_ROLES.includes(role));
}

export async function login(email: string, password: string): Promise<{ user: AdminUser; token: string }> {
  const res = await fetchJson<{ data: { user: AdminUser; token: string } }>('/login', {
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
  setToken(null);
}
