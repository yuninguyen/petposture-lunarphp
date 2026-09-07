import { afterEach, describe, expect, it } from 'vitest';
import { getApiBaseUrl } from './api';

describe('getApiBaseUrl', () => {
  const originalInternal = process.env.INTERNAL_API_URL;
  const originalPublic = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    process.env.INTERNAL_API_URL = originalInternal;
    process.env.NEXT_PUBLIC_API_URL = originalPublic;
  });

  it('uses the internal API URL for server-side requests', () => {
    process.env.INTERNAL_API_URL = 'http://127.0.0.1:8001/';
    process.env.NEXT_PUBLIC_API_URL = 'https://api.petposture.com/';

    expect(getApiBaseUrl()).toBe('http://127.0.0.1:8001');
  });
});
