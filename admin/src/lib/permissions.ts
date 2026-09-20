import { useQuery } from '@tanstack/react-query';
import { fetchJson } from './api';

export async function fetchAbilities(): Promise<string[]> {
  const res = await fetchJson<{ data: { abilities: string[] } }>('/admin/session');
  return res.data.abilities;
}

/**
 * React Query hook exposing the current user's real backend permissions.
 * Additive only (Phase 6c) — existing role-array checks in adminNavigation.tsx
 * and App.tsx are untouched; call sites migrate to `can()` incrementally.
 */
export function useAbilities() {
  return useQuery({
    queryKey: ['admin-session-abilities'],
    queryFn: fetchAbilities,
    staleTime: 5 * 60 * 1000,
  });
}

export function can(abilities: string[] | undefined, ability: string): boolean {
  return Boolean(abilities?.includes(ability));
}
