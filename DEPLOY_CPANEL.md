# Deploying Cellvix to cPanel — clean deploy

A single pass, from an empty application root to a working site. Written
against the real host: `cellvix.ca` on WHC — LiteSpeed, Node 20, cPanel 134.

Follow it in order. Every step was run on that host, and section G maps each
error that can appear to the step that fixes it.

The production server is **one** service: Express serves the API under `/api`
and the built React app underneath it (`server/src/app.js`). One origin, one
port — that is what keeps the session cookie `sameSite: 'lax'` instead of the
strictly weaker `sameSite: 'none'` a split deployment would force.

MongoDB is **Atlas**. cPanel has no MongoDB.

---

## What is specific to this host

Three facts. The bundle handles the first two for you; the third is yours.

1. **The Node runner `require()`s the startup file.** LiteSpeed's `lsnode.js`
   (and Passenger) start an app with `require()`, which cannot load an ESM
   graph that resolves asynchronously — it throws `ERR_REQUIRE_ASYNC_MODULE`
   and nothing binds a port.

   The server is **CommonJS** (`server/package.json` sets
   `"type": "commonjs"`), so `require()` of it succeeds outright and the
   startup file is **`server/src/index.js`** itself. No shim is involved.

2. **cPanel installs only the application root's `package.json`,** ignoring
   `workspaces`. A root file that delegates to a `server` workspace installs
   *nothing*. The deployment `package.json` is flat — every dependency at the
   top level. Node resolves the server's bare imports by walking up from
   `server/src/`, so one `node_modules` at the root serves the whole app.

3. **Atlas blocks the server's IP** until you allow it, which shows up as a
   503, not as a database error.

---

## A. Clear the old deployment

> **Read before deleting.** `~/cellvix.ca/` is the domain's document root, so
> it holds files that are not part of this app:
>
> - **`.htaccess`** may carry mail, SSL or redirect rules the host put there.
>   **Download a copy first** — deleting it can break things beyond this app.
> - **`wp-content`** belongs to any WordPress install still using this domain.
>   Download it if you are not certain it is dead.
> - **`node_modules`** is a symlink the Node Selector owns.
>
> Deleting is not reversible from here.

1. cPanel → **Setup Node.js App** → open the app → **DESTROY**.
   Do this *first*, so the panel is not holding references to files you remove.
2. File Manager → `~/cellvix.ca/` → select all → **Delete**.
3. Confirm it is empty, including hidden files (File Manager →
   **Settings** → *Show Hidden Files*).

---

## B. Build and bundle, on your machine

```bash
npm run build
node deploy/bundle.mjs
```

`deploy/out/` is now exactly what belongs on the server:

```
deploy/out/
├── package.json          <- flat, all dependencies
├── server/               <- src/index.js is the startup file
├── shared/               <- REQUIRED at this level
└── client/dist/          <- prebuilt
```

The script refuses to run without `client/dist`, and fails if
`deploy/package.json` has fallen behind `server/package.json`.

**`shared/` ships, and its position is fixed.** The server imports it at
runtime by relative path (`server/src/routes/index.js` →
`../../../shared/schemas/auth.js`), so it must sit one level above `server/`.

Zip the **contents** of `deploy/out/` — not the folder itself.

---

## C. Generate secrets and allow the server's IP

### C1. Secrets

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run twice — one for `JWT_SECRET`, one for `SECRETS_KEY`.

`JWT_SECRET` must not contain `dev-only`; `server/src/config/env.js` refuses to
boot in production if it does. Set `SECRETS_KEY` explicitly: left empty it is
derived from `JWT_SECRET`, and rotating `JWT_SECRET` later would then make
every stored provider credential undecryptable.

### C2. Atlas IP access

In cPanel → **Terminal**:

```bash
curl -s ifconfig.me
```

Atlas → your cluster → **Network Access** → **Add IP Address** → paste it →
wait about a minute for it to go active.

Ask the host whether that outbound IP is static. If it rotates, the site dies
with a connection error and nothing in the app will have changed.

---

## D. Upload

File Manager → `~/cellvix.ca/` → **Upload** the zip → **Extract** there.

Verify the layout before continuing:

```bash
ls ~/cellvix.ca
```

Expect exactly: `client  package.json  server  shared`

If you see a nested folder instead, the zip contained its parent directory —
move the contents up one level.

---

## E. Create the Node.js app

cPanel → **Software** → **Setup Node.js App** → **Create Application**.

| Field | Value |
|---|---|
| Node.js version | 20 or higher |
| Application mode | **Production** |
| Application root | `cellvix.ca` |
| Application URL | your domain |
| Application startup file | **`server/src/index.js`** |

Leave the port alone. The host assigns it and passes it in the environment;
`server/src/index.js` reads `env.PORT`. A hardcoded port binds a socket the web
server is not proxying to, and every request 502s.

### E1. Environment variables

Add these in the Node Selector UI, below the startup-file field:

| Variable | Value |
|---|---|
| `MONGODB_URI` | your Atlas URI, pointing at the **production** database — never the one you develop against |
| `JWT_SECRET` | the first string from C1 |
| `SECRETS_KEY` | the second string from C1 |
| `CLIENT_ORIGIN` | `https://cellvix.ca` |
| `PUBLIC_ORIGIN` | `https://cellvix.ca` |
| `COOKIE_NAME` | `cellvix_session` |
| `JWT_EXPIRES_IN` | `7d` |
| `MOCK_PAYMENT_DECLINE` | `false` |
| `SMTP_URL` | see E2 |
| `MAIL_FROM` | `Cellvix <admin@cellvix.ca>` |

`NODE_ENV` comes from Application mode = Production. Do not add it by hand.

Use `https://` with no trailing slash — CORS matches it literally.

Do **not** set `VITE_API_URL`. It is a build-time variable, and the client
already falls back to `/api`, same-origin, which is what this deployment needs.

Never upload a `.env` file — it holds live credentials, and the Node Selector's
variables do the same job without a readable file in the document root.

### E2. Mail

From cPanel's Mail Client Manual Settings (`mail.cellvix.ca`, SMTP port 465,
secure SSL/TLS):

```
SMTP_URL=smtps://admin%40cellvix.ca:PASSWORD@mail.cellvix.ca:465
```

**Percent-encode the username and password** — they are URL components. The
mailbox name is a full address, so its `@` must be written `%40` or the URL
parses against the wrong host. In the password: `@`→`%40` · `:`→`%3A` ·
`/`→`%2F` · `#`→`%23` · `?`→`%3F` · `%`→`%25`

Port 465 is implicit TLS; `server/src/services/mailer.js` derives `secure` from
the port, so 465 and 587 both work. With no `SMTP_URL`, mail is written to
`server/.mail/` and never sent — the order completes either way, so a mail
failure can never fail a checkout.

---

## F. Install, secure, start

### F1. Install dependencies

Click **Run NPM Install**, or in Terminal:

```bash
source /home/brezfr82/nodevenv/cellvix.ca/20/bin/activate && cd /home/brezfr82/cellvix.ca
npm install --omit=dev
```

Expect **about 116 packages**. `audited 1 package` means the wrong
`package.json` is in place — it must list `dependencies` and have no
`workspaces` key.

Verify:

```bash
ls node_modules/dotenv/package.json
```

### F2. HTTPS — required, not optional

cPanel → **SSL/TLS Status** → run AutoSSL, then force HTTPS redirection.

`server/src/services/authService.js` sets the session cookie with
`secure: env.isProd`. Over plain HTTP in production the browser silently
discards it: **login appears to succeed and the next request is anonymous.**

### F3. Start

**Restart** in the Node Selector, then:

```bash
tail -20 ~/cellvix.ca/stderr.log
```

A good boot ends with:

```
MongoDB connected: ...mongodb.net/cellvix
Cellvix API listening on port ...
```

### F4. Seed content — once

```bash
npm run seed:content
npm run seed:expense-categories
```

> **Never run `npm run seed` against production.** It wipes taxonomy,
> products, users, orders and invoices. The deployment `package.json`
> deliberately omits it.

### F5. Verify

```bash
curl -o /dev/null -w "%{http_code}\n" https://cellvix.ca/             # 200 html
curl -o /dev/null -w "%{http_code}\n" https://cellvix.ca/api/products # 200 json
curl -o /dev/null -w "%{http_code}\n" https://cellvix.ca/shop         # 200 html
curl -s https://cellvix.ca/api/nope                                   # 404 JSON, not HTML
```

Then in a browser:

- log in as an approved buyer, then **reload** — the session must survive (F2)
- confirm a non-approved user sees no prices
- open `https://cellvix.ca/shop` in a fresh tab, not by in-app navigation
- place a test order and confirm the invoice email arrives (E2)

---

## G. Troubleshooting

Always start with `tail -40 ~/cellvix.ca/stderr.log`. Every boot failure exits
non-zero with a named error.

| Log says | Fix |
|---|---|
| `require is not defined in ES module scope` (or `ERR_REQUIRE_ASYNC_MODULE`) | `server/package.json` did not upload, or lost `"type": "commonjs"` — the deployment root says `"type": "module"`, so without that override Node reads the whole server as ESM (B, D) |
| `ERR_MODULE_NOT_FOUND: Cannot find package 'dotenv'` | dependencies not installed; `package.json` is not flat (F1) |
| `npm install` prints `audited 1 package` | same — the root `package.json` has no `dependencies` |
| `Could not connect to any servers in your MongoDB Atlas cluster` | server IP not allowed in Atlas (C2) |
| `Invalid environment configuration` + a named field | that variable is missing (E1) |
| `Refusing to start: JWT_SECRET is still the development placeholder` | `JWT_SECRET` contains `dev-only` (C1) |
| `Cannot find module '../../../shared/…'` | `shared/` missing or not at the app root (B, D) |
| Nothing in the log, 502 on every request | app crashed at boot, or a port was hardcoded |
| API works, pages 404 | `client/dist` missing or misplaced (D) |
| Login succeeds, next request anonymous | not on HTTPS (F2) |
| Mail silently lands in `server/.mail/` | `SMTP_URL` unset or not percent-encoded (E2) |

### On the 503

A 503 means the web server reached the Node app and the app was not running.
It is **always** a boot failure — read `stderr.log` rather than guessing. In
particular it is not a sign that `client/dist` is in the wrong place: that
produces a 404 from a running app, which looks entirely different.

---

## H. Redeploying later

```bash
npm run build
node deploy/bundle.mjs
```

Upload the changed files, then **Restart** in the Node Selector — the host does
not pick up changes on its own. Re-run `npm install --omit=dev` only when a
dependency changed.

Vite fingerprints asset filenames and they are served with a one-year
`max-age`, while `index.html` is served uncached, so a redeploy invalidates
correctly with no cache purge.

---

## Note on modules

The server is **CommonJS** (`server/package.json` sets `"type": "commonjs"`),
so the host's `require()`-based runner loads `server/src/index.js` directly and
`ERR_REQUIRE_ASYNC_MODULE` cannot occur. There is no startup shim.

Two `package.json` files carry that, and both have to reach the server: the
deployment root's says `"type": "module"`, and `server/package.json` overrides
it for everything beneath `server/`. If the second one goes missing, Node reads
the whole server as ESM and the boot fails with exactly the error the shim used
to exist to avoid.

`shared/` is CommonJS too, so the server can `require()` it. It is **not**
duplicated: the file names are unchanged, and `shared/package.json` marks the
folder `"type": "commonjs"` while the repo root stays `"type": "module"`. The
Vite client still imports it as `@shared/...` — `build.commonjsOptions` covers
the production build, and a small dev-only plugin in `client/vite.config.js`
converts it for the dev server, which does not run that plugin over aliased
sources outside `node_modules`.
