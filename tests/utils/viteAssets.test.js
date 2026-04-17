import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const originalNodeEnv = process.env.NODE_ENV;
const originalLifecycle = process.env.npm_lifecycle_event;
const originalViteOrigin = process.env.VITE_DEV_SERVER_ORIGIN;

const importHelper = async ({
  nodeEnv,
  lifecycleEvent,
  viteOrigin = 'http://localhost:5173',
  fsBehavior = {},
} = {}) => {
  jest.resetModules();

  process.env.NODE_ENV = nodeEnv;
  process.env.npm_lifecycle_event = lifecycleEvent;
  process.env.VITE_DEV_SERVER_ORIGIN = viteOrigin;

  await jest.unstable_mockModule('node:fs', () => ({
    existsSync: jest.fn(() => fsBehavior.existsSync ?? false),
    readFileSync: jest.fn(() => fsBehavior.readFileSync ?? '{}'),
    statSync: jest.fn(() => ({ mtimeMs: fsBehavior.mtimeMs ?? 1 })),
  }));

  return import('../../src/utils/viteAssets.js');
};

describe('createViteAssetsHelper', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.npm_lifecycle_event = originalLifecycle;
    process.env.VITE_DEV_SERVER_ORIGIN = originalViteOrigin;
  });

  it('returns development tags when not in production runtime', async () => {
    const { createViteAssetsHelper } = await importHelper({
      nodeEnv: 'development',
      lifecycleEvent: 'dev',
      viteOrigin: 'http://localhost:5173',
    });

    const tags = createViteAssetsHelper()();

    expect(tags).toContain('http://localhost:5173/@vite/client');
    expect(tags).toContain('http://localhost:5173/client/src/main.js');
    expect(tags).not.toContain('/dist/assets/');
  });

  it('returns manifest-backed production tags when started via npm start', async () => {
    const manifest = JSON.stringify({
      'client/src/main.js': {
        file: 'assets/app-prod.js',
        css: ['assets/app-prod.css'],
      },
    });

    const { createViteAssetsHelper } = await importHelper({
      nodeEnv: '',
      lifecycleEvent: 'start',
      fsBehavior: {
        existsSync: true,
        readFileSync: manifest,
        mtimeMs: 42,
      },
    });

    const tags = createViteAssetsHelper()();

    expect(tags).toContain('<link rel="stylesheet" href="/dist/assets/app-prod.css">');
    expect(tags).toContain('<script type="module" src="/dist/assets/app-prod.js"></script>');
    expect(tags).not.toContain('localhost:5173');
  });
});
