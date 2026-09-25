import { fetchJson } from '@/lib/api';

export interface RoleItem {
  id: number;
  name: string;
  editable: boolean;
  permissions: string[];
}

export interface PermissionGroup {
  key: string;
  label: string;
  abilities: string[];
}

export interface RolesResponse {
  data: RoleItem[];
  permission_groups: PermissionGroup[] | Record<string, string[]>;
}

export async function fetchRoles(): Promise<RolesResponse> {
  return fetchJson<RolesResponse>('/admin/system/roles');
}

export async function updateRolePermissions(
  roleId: number,
  permissions: string[]
): Promise<RoleItem> {
  const response = await fetchJson<{ data: RoleItem }>(`/admin/system/roles/${roleId}`, {
    method: 'PUT',
    body: { permissions },
  });
  return response.data;
}
