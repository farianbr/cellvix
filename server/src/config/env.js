import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

// One .env at the repo root serves both workspaces.
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '..', '..', '..', '.env') });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  // Required: there is no in-memory fallback (PROJECT_INSTRUCTIONS.md §8).
  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI is required — there is no in-memory fallback')
    .refine((uri) => uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://'), {
      message: 'MONGODB_URI must start with mongodb:// or mongodb+srv://',
    }),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  COOKIE_NAME: z.string().default('cellvix_session'),

  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),

  // Opt-in: makes the MOCK gateway decline every charge, so the payment-failure
  // page can be exercised end to end. Off by default — see services/payment.js.
  // ---- outbound mail ------------------------------------------------
  // Optional. With no SMTP_URL the mailer writes each message to server/.mail
  // and logs it instead of sending — the order still completes either way, so
  // a missing mail server can never fail a checkout.
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('Cellvix <billing@cellvix.ca>'),
  // Where a link in an email should point. Defaults to the first CLIENT_ORIGIN.
  PUBLIC_ORIGIN: z.string().optional(),

  MOCK_PAYMENT_DECLINE: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((value) => value === 'true' || value === '1'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Crash loudly and specifically — a half-configured server is worse than none.
  console.error('\n  Invalid environment configuration:\n');
  for (const issue of parsed.error.issues) {
    console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('\n  Copy .env.example to .env and fill it in.\n');
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  origins: parsed.data.CLIENT_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean),
  publicOrigin:
    parsed.data.PUBLIC_ORIGIN ||
    parsed.data.CLIENT_ORIGIN.split(',')[0].trim(),
};

if (env.isProd && env.JWT_SECRET.includes('dev-only')) {
  console.error('\n  Refusing to start: JWT_SECRET is still the development placeholder.\n');
  process.exit(1);
}

export default env;
