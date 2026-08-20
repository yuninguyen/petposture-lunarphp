import { describe, it, expect, beforeEach } from 'vitest';
import { getToken, setToken, isAdminRole } from './auth';

describe('auth token storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no token is stored', () => {
    expect(getToken()).toBeNull();
  });

  it('stores and retrieves a token', () => {
    setToken('abc123');
    expect(getToken()).toBe('abc123');
  });

  it('clears the token when set to null', () => {
    setToken('abc123');
    setToken(null);
    expect(getToken()).toBeNull();
  });

  it('recognizes admin, super_admin, and staff as admin roles', () => {
    expect(isAdminRole(['customer'])).toBe(false);
    expect(isAdminRole(['staff'])).toBe(true);
    expect(isAdminRole(['admin'])).toBe(true);
    expect(isAdminRole(['super_admin'])).toBe(true);
  });
});
