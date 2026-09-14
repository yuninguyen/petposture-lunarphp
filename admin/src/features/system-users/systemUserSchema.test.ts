import { describe, expect, it } from 'vitest';
import {
  buildSystemUserPayload,
  createSystemUserSchema,
  editSystemUserSchema,
} from './systemUserSchema';

describe('system user schema validation', () => {
  it('validates create schema successfully with valid data', () => {
    const valid = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'password123',
      roles: ['staff', 'Support'],
      is_active: true,
    };
    const result = createSystemUserSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects create schema when password is shorter than 8 characters', () => {
    const invalid = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'short',
      roles: ['staff'],
      is_active: true,
    };
    const result = createSystemUserSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects create schema when roles array is empty', () => {
    const invalid = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'password123',
      roles: [],
      is_active: true,
    };
    const result = createSystemUserSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('validates edit schema when password is empty', () => {
    const valid = {
      name: 'John Doe',
      email: 'john@example.com',
      password: '',
      roles: ['admin'],
      is_active: true,
    };
    const result = editSystemUserSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('builds correct payload for creation and editing', () => {
    const createPayload = buildSystemUserPayload(
      {
        name: '  Jane Doe  ',
        email: '  jane@example.com ',
        password: 'password123',
        roles: ['staff'],
        is_active: true,
      },
      false
    );
    expect(createPayload).toEqual({
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'password123',
      roles: ['staff'],
      is_active: true,
    });

    const editPayload = buildSystemUserPayload(
      {
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: '',
        roles: ['staff'],
        is_active: false,
      },
      true
    );
    expect(editPayload).toEqual({
      name: 'Jane Doe',
      email: 'jane@example.com',
      roles: ['staff'],
      is_active: false,
    });
  });
});
