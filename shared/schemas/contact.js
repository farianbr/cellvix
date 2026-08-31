const { z } = require('zod');

const CONTACT_TOPICS = [
  { value: 'account', label: 'Trade account or approval' },
  { value: 'order', label: 'An existing order' },
  { value: 'stock', label: 'Stock or availability' },
  { value: 'warranty', label: 'Warranty or return' },
  { value: 'other', label: 'Something else' },
];

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(80),
  business: z.string().trim().max(120).optional(),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  phone: z.string().trim().max(40).optional(),
  topic: z.enum(['account', 'order', 'stock', 'warranty', 'other']).default('other'),
  orderNumber: z.string().trim().max(40).optional(),
  message: z.string().trim().min(10, 'Tell us a little more — at least 10 characters.').max(2000),
});

// --- CommonJS exports -------------------------------------------------
exports.CONTACT_TOPICS = CONTACT_TOPICS;
exports.contactSchema = contactSchema;
