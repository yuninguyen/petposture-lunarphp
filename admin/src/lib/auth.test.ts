import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isAdminRole } from './auth';

describe('session authentication', () => {
  it('does not persist bearer tokens in browser storage', () => {
    const source = readFileSync('src/lib/auth.ts', 'utf8');

    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('petposture_admin_token');
    expect(source).not.toContain('Authorization');
  });

  it('recognizes admin, super_admin, and staff as admin roles', () => {
    expect(isAdminRole(['customer'])).toBe(false);
    expect(isAdminRole(['staff'])).toBe(true);
    expect(isAdminRole(['admin'])).toBe(true);
    expect(isAdminRole(['super_admin'])).toBe(true);
  });
});
