import { z } from 'zod';

/** Canadian provinces and territories — the only shipping destinations Cellvix serves. */
const PROVINCES = [
  { value: 'AB', label: 'Alberta' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland and Labrador' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'NT', label: 'Northwest Territories' },
  { value: 'NU', label: 'Nunavut' },
  { value: 'ON', label: 'Ontario' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'QC', label: 'Quebec' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'YT', label: 'Yukon' },
];

const POSTAL = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;

const addressSchema = z.object({
  contactName: z.string().trim().min(2, 'Enter a contact name.'),
  company: z.string().trim().optional(),
  line1: z.string().trim().min(2, 'Enter a street address.'),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(2, 'Enter a city.'),
  region: z.string().trim().min(2, 'Select a province.'),
  postal: z.string().trim().regex(POSTAL, 'Enter a valid postal code (A1A 1A1).'),
  country: z.string().trim().default('Canada'),
  phone: z.string().trim().min(7, 'Enter a phone number.'),
});

/** Flat-rate placeholder until the client confirms carriers (PROGRESS.md Q5). */
const DELIVERY_METHODS = [
  {
    code: 'ground',
    label: 'Ground',
    detail: '2–4 business days',
    cost: 1895,
    etaDays: 3,
    freeOver: 50_000,
  },
  { code: 'express', label: 'Express', detail: 'Next business day', cost: 3495, etaDays: 1 },
  { code: 'pickup', label: 'Warehouse pickup', detail: 'Ready in 2 hours', cost: 0, etaDays: 0 },
];

const checkoutSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  shippingAddress: addressSchema,
  billingSameAsShipping: z.boolean().default(true),
  billingAddress: addressSchema.optional(),
  deliveryMethod: z.enum(['ground', 'express', 'pickup']),
  paymentMethod: z.enum(['card', 'terms']),
  // A flag, never an amount: how much store credit an order draws is decided
  // server-side from the live balance (PROJECT_INSTRUCTIONS.md §5.3).
  useStoreCredit: z.boolean().default(false),
  poNumber: z.string().trim().max(40).optional(),
  deliveryNotes: z.string().trim().max(500).optional(),
});

/** The checkout sections, in the order the conversational flow opens them. */
const CHECKOUT_STEPS = [
  { key: 'contact', label: 'Contact' },
  { key: 'shipping', label: 'Shipping address' },
  { key: 'delivery', label: 'Delivery method' },
  { key: 'payment', label: 'Payment' },
  { key: 'review', label: 'Review' },
];

/** Placeholder rate — awaiting the client's real tax rules (PROGRESS.md Q4). */
const TAX_RATE = 0.13;

export { PROVINCES, addressSchema, DELIVERY_METHODS, checkoutSchema, CHECKOUT_STEPS, TAX_RATE };
