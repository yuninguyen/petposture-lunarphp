import { z } from 'zod';
import type { SystemUserPayload } from './api';

export const SYSTEM_USER_ROLES = [
  'super_admin',
  'admin',
  'staff',
  'Product Manager',
  'Order Manager',
  'Support',
] as const;

export type SystemUserRole = (typeof SYSTEM_USER_ROLES)[number];

export interface SystemUserFormValues {
  name: string;
  email: string;
  password?: string;
  roles: string[];
  is_active: boolean;
}

export const createSystemUserSchema = z.object({
  name: z.string().trim().min(1, 'system_users.validation.name_required'),
  email: z.string().trim().min(1, 'system_users.validation.email_required').email('system_users.validation.email_invalid'),
  password: z.string().min(8, 'system_users.validation.password_min'),
  roles: z.array(z.string()).min(1, 'system_users.validation.roles_required'),
  is_active: z.boolean().default(true),
});

export const editSystemUserSchema = z.object({
  name: z.string().trim().min(1, 'system_users.validation.name_required'),
  email: z.string().trim().min(1, 'system_users.validation.email_required').email('system_users.validation.email_invalid'),
  password: z
    .string()
    .optional()
    .refine((val) => !val || val.length >= 8, {
      message: 'system_users.validation.password_min',
    }),
  roles: z.array(z.string()).min(1, 'system_users.validation.roles_required'),
  is_active: z.boolean().default(true),
});

export function buildSystemUserPayload(
  values: SystemUserFormValues,
  isEditing: boolean
): SystemUserPayload {
  const payload: SystemUserPayload = {
    name: values.name.trim(),
    email: values.email.trim(),
    roles: values.roles,
    is_active: values.is_active,
  };

  const trimmedPassword = values.password?.trim();
  if (!isEditing && trimmedPassword) {
    payload.password = trimmedPassword;
  } else if (isEditing && trimmedPassword && trimmedPassword.length > 0) {
    payload.password = trimmedPassword;
  }

  return payload;
}
