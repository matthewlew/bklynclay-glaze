import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Injects a content hash into dist/sw.js's CACHE placeholder so the cache
// name (and therefore install/activate) changes on every deploy with
// different output, instead of relying on a manually-bumped version string.
function swCacheHashPlugin() {
  let outDir = 'dist';
  return {
    name: 'sw-cache-hash',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const swPath = join(outDir, 'sw.js');
      let swSource;
      try {
        swSource = readFileSync(swPath, 'utf8');
      } catch {
        return; // sw.js not present (e.g. not yet copied from public/) — nothing to do
      }

      const hash = createHash('sha256');
      for (const file of walk(outDir).sort()) {
        if (file === swPath) continue; // exclude sw.js itself to avoid self-reference
        hash.update(relative(outDir, file));
        hash.update(readFileSync(file));
      }
      const buildHash = hash.digest('hex').slice(0, 12);

      writeFileSync(swPath, swSource.replace('__BUILD_HASH__', `bklynclay-${buildHash}`));
    },
  };
}

function walk(dir) {
  let out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    out = statSync(full).isDirectory() ? out.concat(walk(full)) : out.concat([full]);
  }
  return out;
}

export default defineConfig({
  base: './',
  build: {
    target: 'esnext'
  },
  preview: {
    port: 4173
  },
  plugins: [swCacheHashPlugin()],
});
