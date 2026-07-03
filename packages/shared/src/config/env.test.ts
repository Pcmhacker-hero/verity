import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configSchema } from './env.js';

describe('Environment Configuration Schema', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should parse valid environment variables and apply defaults', () => {
    const rawEnv = {
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
      BETTER_AUTH_SECRET: 'supersecret',
      NODE_ENV: 'test'
    };
    
    const parsed = configSchema.parse(rawEnv);
    expect(parsed.NODE_ENV).toBe('test');
    expect(parsed.DATABASE_URL).toBe('postgres://user:pass@localhost:5432/db');
    expect(parsed.SERVICE_NAME).toBe('verity'); // default applied
    expect(parsed.ALERT_API_LATENCY_WARNING_MS).toBe(500); // default applied
  });

  it('should fail if DATABASE_URL is missing', () => {
    const rawEnv = {
      NODE_ENV: 'test'
    };
    
    expect(() => configSchema.parse(rawEnv)).toThrowError(/DATABASE_URL/);
  });
});
