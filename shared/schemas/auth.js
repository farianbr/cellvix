const { z } = require('zod');

/** Shared by the server's validate() middleware and the client's React Hook Form resolvers. */

const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters.')
  .regex(/[A-Za-z]/, 'Include a letter.')
  .regex(/[0-9]/, 'Include a number.');

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
  remember: z.boolean().optional().default(false),
});

const registerSchema = z.object({
  businessName: z.string().trim().min(2, 'Enter your business name.'),
  contactName: z.string().trim().min(2, 'Enter a contact name.'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  phone: z.string().trim().min(7, 'Enter a phone number.'),
  password: passwordSchema,
  businessType: z.string().trim().optional(),
  website: z.string().trim().optional(),
  taxId: z.string().trim().optional(),
  // A referral code from an existing account (ERP rework §6.13). Optional, and
  // uppercased here so the buyer can type it however it was written down. An
  // unrecognised code is refused server-side rather than ignored — silently
  // dropping it costs a real referrer real money.
  referralCode: z
    .string()
    .trim()
    .toUpperCase()
    .max(16)
    .optional()
    .or(z.literal('')),
  address: z
    .object({
      line1: z.string().trim().min(2, 'Enter a street address.'),
      city: z.string().trim().min(2, 'Enter a city.'),
      region: z.string().trim().min(2, 'Select a province.'),
      postal: z
        .string()
        .trim()
        .regex(/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, 'Enter a valid postal code.'),
    })
    .optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
});

// --- CommonJS exports -------------------------------------------------
exports.passwordSchema = passwordSchema;
exports.loginSchema = loginSchema;
exports.registerSchema = registerSchema;
exports.forgotPasswordSchema = forgotPasswordSchema;
