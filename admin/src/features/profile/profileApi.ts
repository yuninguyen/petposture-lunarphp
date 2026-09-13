import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api';

export interface SystemActivityItem {
  id: number;
  description: string;
  subject_type: string | null;
  created_at: string | null;
  created_at_human: string | null;
}

export interface ProfileData {
  id: number;
  name: string;
  email: string;
  role_labels: string[];
  joined_at: string | null;
  last_login_at: string | null;
  recent_activity: {
    scope: string;
    label: string;
    items: SystemActivityItem[];
  };
}

export interface ProfileUpdatePayload {
  name: string;
  email: string;
}

export interface PasswordUpdatePayload {
  current_password: string;
  password: string;
  password_confirmation: string;
}

export async function fetchProfile(): Promise<{ data: ProfileData }> {
  return fetchJson<{ data: ProfileData }>('/admin/profile');
}

export async function updateProfile(payload: ProfileUpdatePayload): Promise<{ data: ProfileData }> {
  return fetchJson<{ data: ProfileData }>('/admin/profile', {
    method: 'PUT',
    body: payload as unknown as Record<string, unknown>,
  });
}

export async function updatePassword(payload: PasswordUpdatePayload): Promise<{ message: string }> {
  return fetchJson<{ message: string }>('/admin/profile/password', {
    method: 'PUT',
    body: payload as unknown as Record<string, unknown>,
  });
}

export function useProfile() {
  return useQuery({
    queryKey: ['admin-profile'],
    queryFn: fetchProfile,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(['admin-profile'], data);
      queryClient.invalidateQueries({ queryKey: ['admin-profile'] });
    },
  });
}

export function useUpdatePassword() {
  return useMutation({
    mutationFn: updatePassword,
  });
}
