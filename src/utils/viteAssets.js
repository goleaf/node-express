import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const manifestPath = path.join(rootDir, 'public/dist/manifest.json');
const viteDevServerOrigin = process.env.VITE_DEV_SERVER_ORIGIN ?? 'http://localhost:5173';
const isProductionRuntime =
  process.env.NODE_ENV === 'production' || process.env.npm_lifecycle_event === 'start';

let cachedManifest = null;
let cachedManifestMtimeMs = 0;

const readManifest = () => {
  if (!existsSync(manifestPath)) {
    cachedManifest = null;
    cachedManifestMtimeMs = 0;
    return null;
  }

  const manifestStats = statSync(manifestPath);

  if (cachedManifest && cachedManifestMtimeMs === manifestStats.mtimeMs) {
    return cachedManifest;
  }

  cachedManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  cachedManifestMtimeMs = manifestStats.mtimeMs;

  return cachedManifest;
};

const createStylesheetTag = (href) => `<link rel="stylesheet" href="${href}">`;
const createModuleScriptTag = (src) => `<script type="module" src="${src}"></script>`;

const buildDevelopmentTags = (entry) => {
  const normalizedEntry = String(entry).replace(/^\/+/, '');

  return [
    createModuleScriptTag(`${viteDevServerOrigin}/@vite/client`),
    createModuleScriptTag(`${viteDevServerOrigin}/${normalizedEntry}`),
  ].join('\n');
};

const buildProductionTags = (entry) => {
  const manifest = readManifest();

  if (!manifest) {
    return '';
  }

  const manifestEntry =
    manifest[entry] ||
    manifest[path.posix.basename(entry)] ||
    manifest['client/src/main.js'];

  if (!manifestEntry) {
    return '';
  }

  const tags = [];

  for (const cssFile of manifestEntry.css || []) {
    tags.push(createStylesheetTag(`/dist/${cssFile}`));
  }

  tags.push(createModuleScriptTag(`/dist/${manifestEntry.file}`));

  return tags.join('\n');
};

export const createViteAssetsHelper = () => {
  return (entry = 'client/src/main.js') => {
    if (isProductionRuntime) {
      return buildProductionTags(entry);
    }

    return buildDevelopmentTags(entry);
  };
};

export default createViteAssetsHelper;
