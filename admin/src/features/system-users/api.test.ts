import { describe, expect, it } from 'vitest';
import {
  normalizeSystemUserResponse,
  normalizeSystemUsersResponse,
  type SystemUser,
} from './api';

const mockUser: SystemUser = {
  id: 1,
  name: 'Admin User',
  email: 'admin@example.com',
  is_active: true,
  roles: ['super_admin'],
  last_login_at: '2026-09-14T10:00:00.000Z',
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-14T10:00:00.000Z',
};

describe('system users API normalization', () => {
  it('normalizes wrapped and unwrapped list responses', () => {
    expect(normalizeSystemUsersResponse({ data: [mockUser] })).toEqual([mockUser]);
    expect(normalizeSystemUsersResponse([mockUser])).toEqual([mockUser]);
  });

  it('normalizes wrapped and unwrapped item responses', () => {
    expect(normalizeSystemUserResponse({ data: mockUser })).toEqual(mockUser);
    expect(normalizeSystemUserResponse(mockUser)).toEqual(mockUser);
  });
});
