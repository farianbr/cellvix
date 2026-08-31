/**
 * Assembles the cPanel upload folder into `deploy/out/`.
 *
 * What lands there is exactly what belongs on the server — nothing is filtered
 * again at upload time, so the exclusions live here rather than in a person's
 * memory of which folders were safe.
 *
 * Run from the repo root, after `npm run build`:
 *
 *     node deploy/bundle.mjs
 *
 * Then zip the CONTENTS of deploy/out/ and extract into the cPanel app root.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const OUT = path.join(here, 'out');

/**
 * Never copied, at any depth.
 *
 * `node_modules` because cPanel installs its own (and these are Windows
 * binaries). `.env` because it holds live Atlas credentials — the server reads
 * its configuration from the Node Selector UI instead. `.mail` because it is a
 * local outbox of messages that were never sent.
 */
const SKIP = new Set(['node_modules', '.env', '.mail', '.git', '.DS_Store', 'Thumbs.db']);

async function copyDir(from, to) {
  await fs.mkdir(to, { recursive: true });
  for (const entry of await fs.readdir(from, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) await copyDir(src, dest);
    else await fs.copyFile(src, dest);
  }
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function countFiles(dir) {
  let total = 0;
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) total += await countFiles(path.join(dir, entry.name));
    else total += 1;
  }
  return total;
}

// A stale `client/dist` is the failure this script exists to prevent: the API
// would come up fine and every page would 404, which reads as a routing bug.
const dist = path.join(ROOT, 'client', 'dist');
if (!(await exists(path.join(dist, 'index.html')))) {
  console.error('\n  client/dist/index.html is missing. Run `npm run build` first.\n');
  process.exit(1);
}

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true });

// `shared/` is required by the server at RUNTIME through relative paths
// (`server/src/routes/index.js` -> '../../../shared/schemas/auth.js'), so it
// ships, and it has to stay one level above `server/`.
//
// Its own `package.json` travels with it and is what marks the folder
// `"type": "commonjs"` — the deployment root package.json says `"module"`, and
// without that per-folder marker Node would read every shared file as ESM and
// `require()` of one would throw.
await copyDir(path.join(ROOT, 'server'), path.join(OUT, 'server'));
await copyDir(path.join(ROOT, 'shared'), path.join(OUT, 'shared'));

// Only `dist` from the client. No src, no vite.config.js, no package.json —
// the client is not a workspace on the server.
await copyDir(dist, path.join(OUT, 'client', 'dist'));

/**
 * The deployment root package.json, not the repo's own.
 *
 * It is FLAT — no `workspaces`, and every server dependency listed at the top
 * level — because cPanel's Node Selector runs `npm install` in the application
 * root and installs nothing it does not find there. Node resolves the server's
 * bare imports (`express`, `dotenv`) by walking up from `server/src/`, so a
 * single `node_modules` at the root serves the whole app.
 */
await fs.copyFile(path.join(here, 'package.json'), path.join(OUT, 'package.json'));

// No separate startup shim: the host's Node runner `require()`s
// `server/src/index.js` directly. That works because the server is CommonJS
// (`server/package.json` sets `"type": "commonjs"`), so the require resolves
// synchronously and `ERR_REQUIRE_ASYNC_MODULE` cannot occur.

/**
 * The deployment package.json duplicates server/package.json's dependency
 * list, so it can drift the moment a package is added to the server workspace.
 * A missing entry there is a module-not-found crash on the host and a 503 with
 * no obvious cause, so the two are compared here rather than trusted.
 */
const serverPkg = JSON.parse(
  await fs.readFile(path.join(ROOT, 'server', 'package.json'), 'utf8'),
);
const deployPkg = JSON.parse(await fs.readFile(path.join(here, 'package.json'), 'utf8'));
const missing = Object.keys(serverPkg.dependencies ?? {}).filter(
  (name) => !(name in (deployPkg.dependencies ?? {})),
);
if (missing.length) {
  console.error(
    `\n  deploy/package.json is missing ${missing.join(', ')} — ` +
      'add them there to match server/package.json, then re-run.\n',
  );
  process.exit(1);
}

// No package-lock.json: the repo's lockfile describes the two-workspace tree
// and would pull the client's dependencies back in. cPanel generates a fresh
// one during `npm install --omit=dev`.

console.log(`\n  Bundle ready: ${path.relative(ROOT, OUT)}  (${await countFiles(OUT)} files)`);
console.log('\n  Zip the CONTENTS of that folder and extract into the cPanel app root.');
console.log('  Then follow DEPLOY_CPANEL.md from section C.\n');
