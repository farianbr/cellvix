# `deploy/` — cPanel upload artefacts

Nothing in this folder runs locally and nothing here is uploaded *from* this
path. It holds the files that differ between the repo and the server.

- **`package.json`** — the root `package.json` as it must exist **on the
  server**. It is **flat**: no `workspaces`, and every server dependency listed
  at the top level. cPanel's Node Selector runs `npm install` in the
  application root and installs nothing it does not find there, so a root file
  that delegates to a `server` workspace installs *nothing* and the app boots
  into `Cannot find package 'dotenv'`. Node resolves the server's bare imports
  by walking up from `server/src/`, so one `node_modules` at the root serves
  the whole app.

  Keep its `dependencies` in step with `server/package.json` — `bundle.mjs`
  fails the build if it drifts.

  Do not run `npm install` against this file from inside `deploy/`.

There is no startup shim. LiteSpeed and Passenger start an app with
`require()`, and the server is CommonJS (`server/package.json` sets
`"type": "commonjs"`), so the host is pointed straight at
**`server/src/index.js`** and the require resolves synchronously.

- **`bundle.mjs`** — assembles the complete upload folder. Run it from the
  repo root:

  ```bash
  npm run build          # client/dist must exist first
  node deploy/bundle.mjs
  ```

  It writes `deploy/out/`, which is exactly what goes on the server. Zip that
  folder's **contents** (not the folder itself) and extract into the cPanel
  app root.

The full procedure — environment variables, Node Selector fields, SSL, mail,
seeding, troubleshooting — is in [../DEPLOY_CPANEL.md](../DEPLOY_CPANEL.md).
