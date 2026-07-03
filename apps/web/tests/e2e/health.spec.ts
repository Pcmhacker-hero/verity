import { test, expect } from '@playwright/test';

test.describe('Health Endpoints', () => {
  test('/api/health returns ok', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body.status).toBe('healthy');
    expect(body.environment).toBeDefined();
    expect(body.version).toBeDefined();
    expect(body.uptime).toBeDefined();
  });

  test('/api/health/ready returns ok', async ({ request }) => {
    const response = await request.get('/api/health/ready');
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body.status).toBe('ready');
  });
});
