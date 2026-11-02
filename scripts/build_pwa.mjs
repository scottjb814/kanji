// Run after assembling all static assets and generating KANJIDIC2.
// Include dictionary bytes so scheduled data refreshes invalidate the cache.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function buildPwa(directory) {
  const root = resolve(directory);
  const hash = createHash('sha256');
  function walk(dir) {
    for (const item of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const path = join(dir, item.name);
      if (item.isDirectory()) walk(path);
      else if (path !== join(root, 'sw.js')) {
        hash.update(relative(root, path).replaceAll('\\', '/') + '\0');
        hash.update(readFileSync(path));
      }
    }
  }
  walk(root);
  const path = join(root, 'sw.js');
  const source = readFileSync(path, 'utf8');
  if (!source.includes('__PWA_VERSION__')) throw new Error('Expected unversioned service-worker source');
  writeFileSync(path, source.replace('__PWA_VERSION__', hash.digest('hex').slice(0, 20)));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildPwa(process.argv[2] || '_site');
}
