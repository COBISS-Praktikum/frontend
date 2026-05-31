import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Apollo Client Configuration', () => {
  beforeEach(() => {
    // Reset environment variables before each test
    vi.resetModules();
    delete (globalThis as Record<string, unknown>).VITE_API_URL;
  });

  it('should export a default Apollo client instance', async () => {
    const module = await import('@/config/apollo-client');
    expect(module.default).toBeDefined();
    expect(module.default).toHaveProperty('cache');
    expect(module.default).toHaveProperty('link');
  });

  it('should have cache configuration', async () => {
    const module = await import('@/config/apollo-client');
    const client = module.default;
    expect(client.cache).toBeDefined();
    // InMemoryCache should be configured
    expect(client.cache.constructor.name).toContain('InMemoryCache');
  });

  it('should export a properly initialized Apollo client', async () => {
    // Verify client is initialized with essential properties
    const module = await import('@/config/apollo-client');
    const client = module.default;
    expect(client).toBeDefined();
    expect(typeof client).toBe('object');
  });

  it('should have link configuration for network requests', async () => {
    // Verify the client has network layer configuration
    const module = await import('@/config/apollo-client');
    const client = module.default;
    expect(client.link).toBeDefined();
  });
});




