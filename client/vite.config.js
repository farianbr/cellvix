import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const sharedDir = path.resolve(root, '..', 'shared');

const toPosix = (value) => value.replace(/\\/g, '/');

/**
 * Makes `shared/` importable as ESM by the dev server.
 *
 * `shared/` is CommonJS because the Express server `require()`s it. The
 * production build converts it through `build.commonjsOptions` below, but the
 * dev server does not apply that plugin to aliased sources outside
 * `node_modules`: it would serve the raw `exports.x = …` assignments, which
 * declare no ESM binding, so every `import { X } from '@shared/…'` would arrive
 * as `undefined`.
 *
 * The rewrite is mechanical — run the CommonJS body against a local `module`
 * object, then re-export each name the conversion emitted. These modules hold
 * only zod schemas and constants, so evaluating one has no side effects.
 */
function sharedCommonJsPlugin() {
  const sharedPosix = toPosix(sharedDir);

  return {
    name: 'cellvix-shared-commonjs',
    apply: 'serve',
    transform(code, id) {
      const file = toPosix(id.split('?')[0]);
      if (!file.startsWith(sharedPosix) || !file.endsWith('.js')) return null;

      const names = [...code.matchAll(/^exports\.([A-Za-z_$][\w$]*)\s*=/gm)].map((m) => m[1]);
      const unique = [...new Set(names)];
      if (unique.length === 0) return null;

      // Every `require()` has to become a static ESM import, or the browser
      // hits an undefined `require` at runtime. This covers both a sibling
      // module (`./checkout.js`) and a bare package (`zod`).
      //
      // The namespace and its `default` are merged rather than one being
      // preferred: Vite's optimized `zod` exposes `z` on the namespace but not
      // on `default`, while a plain CommonJS package puts everything on
      // `default`. Spreading both means a destructured `require` finds its key
      // either way.
      const imports = [];
      const bindings = [];
      let index = 0;
      const body = code.replace(/require\((['"])([^'"]+)\1\)/g, (_match, _quote, spec) => {
        const local = `__cjsDep${index}`;
        index += 1;
        imports.push(`import * as ${local}Ns from '${spec}';`);
        bindings.push(
          `const ${local} = Object.assign({}, ${local}Ns.default, ${local}Ns);`,
        );
        return local;
      });

      const named = unique
        .filter((name) => name !== 'default')
        .map((name) => `export const ${name} = __module.exports.${name};`);

      return {
        code: [
          ...imports,
          ...bindings,
          'const __module = { exports: {} };',
          '{',
          '  const module = __module;',
          '  const exports = __module.exports;',
          body,
          '}',
          ...named,
          unique.includes('default') ? 'export default __module.exports.default;' : '',
        ].join('\n'),
        map: null,
      };
    },
  };
}

export default defineConfig({
  plugins: [sharedCommonJsPlugin(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
      '@shared': path.resolve(root, '..', 'shared'),
    },
  },
  build: {
    /**
     * `shared/` is CommonJS and lives outside `node_modules` — the only place
     * @rollup/plugin-commonjs converts by default. Without this the build fails
     * with `"X" is not exported by "../shared/…"`.
     */
    commonjsOptions: {
      include: [/shared[/\\]/, /node_modules/],
    },
    rollupOptions: {
      output: {
        /**
         * Split the heavy third-party libraries into their own chunks.
         *
         * They change far less often than our code, so a deploy invalidates the
         * app chunk while the browser keeps the ~400 KB of vendor code it
         * already has. Route-level splitting lives in App.jsx.
         */
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router'],
          'vendor-motion': ['motion'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Same-origin in dev so the httpOnly auth cookie is sent without CORS credentials games.
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
