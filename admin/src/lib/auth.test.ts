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

  it('scopes navigation for business roles', () => {
    const appSource = readFileSync('src/App.tsx', 'utf8');
    const shellSource = readFileSync('src/layouts/AppShell.tsx', 'utf8');

    expect(appSource).toContain('userRoles={user?.roles ?? []}');
    expect(shellSource).toContain("hasRole('Product Manager')");
    expect(shellSource).toContain('visibleNavGroups');
  });

  it('recognizes every backend admin-panel role', () => {
    expect(isAdminRole(['customer'])).toBe(false);
    expect(isAdminRole(['staff'])).toBe(true);
    expect(isAdminRole(['admin'])).toBe(true);
    expect(isAdminRole(['super_admin'])).toBe(true);
    expect(isAdminRole(['Product Manager'])).toBe(true);
    expect(isAdminRole(['Order Manager'])).toBe(true);
    expect(isAdminRole(['Support'])).toBe(true);
  });
});
