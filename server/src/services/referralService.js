import crypto from 'node:crypto';

import User from '../models/User.js';
import Invoice from '../models/Invoice.js';
import CreditTransaction from '../models/CreditTransaction.js';
import Settings from '../models/Settings.js';
import ApiError from '../utils/ApiError.js';
import { likeRegex } from '../utils/regex.js';
import * as storeCreditService from './storeCreditService.js';

/**
 * Referral commission (ERP rework §6.13, phase 10).
 *
 * A referring business earns a percentage of what the accounts it referred
 * actually **pay**, credited as store credit.
 *
 * This file pays real money on an automatic trigger, so it is written to be
 * boring and defensive. Five rules hold it together:
 *
 * **1. Earned on payment, never on order.** An unpaid invoice has earned nobody
 * anything. The trigger is `recordPayment`, and the basis is the payment
 * amount, not the invoice total — an instalment earns on the instalment.
 *
 * **2. The rate is snapshotted, never looked up.** Each accrual stores the
 * percent in force when it was earned, exactly as an order line snapshots
 * price. Changing the rate tomorrow must not silently restate what was earned
 * yesterday (§6.13).
 *
 * **3. One level only.** A referrer earns on their own referrals and never on
 * their referrals' referrals. There is no recursion in this file, and that is
 * deliberate rather than accidental.
 *
 * **4. Accrual is idempotent.** Commission is keyed on the invoice number plus
 * the index of the payment row within it, so replaying a payment — a retry, a
 * double-submit — cannot pay twice.
 *
 * **5. Money that comes back takes its commission with it.** A refund or a void
 * writes an offsetting entry. Commission on money that was returned is money
 * leaking out of the business.
 *
 * Nothing here writes a balance: every movement goes through
 * `storeCreditService.creditReferral()`, because that service is the only place
 * a store-credit balance moves (PROJECT_INSTRUCTIONS.md).
 */

// Unambiguous alphabet: no O/0, no I/1/L. A referral code gets read down a
// phone line and typed by somebody who did not choose it.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

function randomCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

/**
 * Mints the code on an approved account, if it has none.
 *
 * Called from `approveUser`, because §6.13 puts code generation at approval
 * rather than signup: a pending business might never be approved, and a code
 * that can refer people before its own account is trusted is worth abusing.
 *
 * Retries on collision rather than trusting randomness — a unique index that
 * throws in production is not a plan.
 */
export async function ensureReferralCode(user) {
  if (user.referralCode) return user.referralCode;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomCode();
    // eslint-disable-next-line no-await-in-loop
    const taken = await User.exists({ referralCode: code });
    if (taken) continue;

    user.referralCode = code;
    return code;
  }

  // Five collisions against a 31^8 space means something is wrong with the
  // randomness, not with luck. Fail loudly rather than minting a duplicate.
  throw ApiError.badRequest('Could not allocate a referral code.', 'REFERRAL_CODE_EXHAUSTED');
}

/**
 * Resolves a referral code typed at registration into the referrer it names.
 *
 * Returns `null` for an absent code — referral is optional and a blank field
 * must never block a signup. An *unrecognised* code is refused rather than
 * ignored: somebody typing a code believes it will be honoured, and silently
 * dropping it costs a real referrer real money.
 *
 * Self-referral cannot occur here and is not checked: the referrer must already
 * exist and be approved, while the account being registered does not exist yet.
 * The cycle §6.13 warns about needs two accounts and one level, and one level
 * cannot contain a cycle.
 */
export async function resolveReferralCode(code) {
  const trimmed = String(code ?? '').trim().toUpperCase();
  if (!trimmed) return null;

  const referrer = await User.findOne({ referralCode: trimmed })
    .select('_id businessName status')
    .lean();

  if (!referrer) {
    throw ApiError.badRequest(
      'That referral code was not recognised. Check it, or leave the field empty.',
      'REFERRAL_CODE_NOT_FOUND',
    );
  }

  // A suspended or rejected referrer must not keep earning.
  if (referrer.status !== 'approved') {
    throw ApiError.badRequest(
      'That referral code is not active.',
      'REFERRAL_CODE_INACTIVE',
    );
  }

  return referrer._id;
}

/** The rate in force right now, as a percentage (5 means 5%). */
export async function currentPercent() {
  const settings = await Settings.load();
  return settings?.financial?.referralPercent ?? 5;
}

export async function setPercent(percent) {
  const value = Number(percent);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw ApiError.badRequest('Enter a rate between 0 and 100.', 'INVALID_PERCENT');
  }

  await Settings.updateOne(
    { key: 'singleton' },
    { $set: { 'financial.referralPercent': value } },
    { upsert: true },
  );

  // Said plainly in the response because it is the question an operator asks
  // straight after changing it.
  return { percent: value, retroactive: false };
}

/**
 * Accrues commission for one payment on one invoice.
 *
 * Called after a payment row is appended. `paymentIndex` is the row's position
 * in `invoice.payments`, which together with the invoice number uniquely
 * identifies the instalment — an invoice paid in three parts earns three times,
 * and each one has to be separately reversible.
 *
 * **Never throws into the caller.** Recording a payment is the operator's
 * action and the commission is a side effect of it; a failure here must not
 * roll back a payment that genuinely happened. It returns `null` and logs
 * instead, the same reasoning `mailer.js` applies to order confirmation email.
 */
export async function accrueForPayment(invoice, paymentIndex) {
  try {
    const payment = invoice.payments?.[paymentIndex];
    if (!payment) return null;

    // A void is forgiveness, not money — it must not earn anybody a commission.
    if (payment.method === 'void') return null;
    if (!(payment.amount > 0)) return null;

    const buyer = await User.findById(invoice.user).select('referredBy businessName').lean();
    if (!buyer?.referredBy) return null;

    // One level only (§6.13): commission is paid to the direct referrer, and
    // this function never looks at `referrer.referredBy`.
    const referrer = await User.findById(buyer.referredBy).select('_id status').lean();
    if (!referrer) return null;
    if (referrer.status !== 'approved') return null;

    // Belt and braces against a self-referral that somehow reached the data.
    if (String(referrer._id) === String(invoice.user)) return null;

    // Idempotence: this exact instalment may only ever earn once.
    const existing = await CreditTransaction.findOne({
      type: 'referral',
      'referral.invoiceNumber': invoice.number,
      'referral.paymentIndex': paymentIndex,
    }).lean();
    if (existing) return null;

    const percent = await currentPercent();
    if (!(percent > 0)) return null;

    // Integer cents throughout. Rounded once, here, and the rounded figure is
    // what the ledger stores — so a reversal subtracts exactly what was added
    // rather than recomputing and drifting by a cent.
    const amount = Math.round((payment.amount * percent) / 100);
    if (amount <= 0) return null;

    const { entry } = await storeCreditService.creditReferral({
      referrerId: referrer._id,
      amount,
      note: `Referral commission from ${buyer.businessName}`,
      referral: {
        from: invoice.user,
        fromName: buyer.businessName,
        invoiceNumber: invoice.number,
        paymentIndex,
        percent,
        basis: payment.amount,
      },
    });

    return entry;
  } catch (error) {
    // A commission that failed to post is a business problem to investigate,
    // never a reason to fail the payment that triggered it.
    console.error(`  Referral: accrual for ${invoice?.number} failed — ${error.message}`);
    return null;
  }
}

/**
 * Reverses commission already paid on an invoice.
 *
 * `paymentIndex` reverses one instalment; omitting it reverses every accrual on
 * the invoice, which is what a void needs.
 *
 * Reversal is itself idempotent: an accrual that already carries a reversal is
 * skipped, so voiding an invoice twice does not claw back twice.
 */
export async function reverseForInvoice(invoiceNumber, paymentIndex = null) {
  try {
    const filter = { type: 'referral', 'referral.invoiceNumber': invoiceNumber };
    if (paymentIndex !== null) filter['referral.paymentIndex'] = paymentIndex;
    // Positive rows only: a reversal is itself a `referral` row and must not be
    // reversed in turn.
    filter.amount = { $gt: 0 };

    const accruals = await CreditTransaction.find(filter).lean();
    if (accruals.length === 0) return { reversed: 0 };

    let reversed = 0;

    for (const accrual of accruals) {
      // eslint-disable-next-line no-await-in-loop
      const already = await CreditTransaction.exists({
        type: 'referral',
        'referral.reverses': accrual._id,
      });
      if (already) continue;

      // eslint-disable-next-line no-await-in-loop
      await storeCreditService.creditReferral({
        referrerId: accrual.user,
        amount: -accrual.amount,
        note: `Referral commission reversed — ${invoiceNumber}`,
        referral: {
          from: accrual.referral?.from,
          fromName: accrual.referral?.fromName,
          invoiceNumber,
          paymentIndex: accrual.referral?.paymentIndex,
          percent: accrual.referral?.percent,
          basis: accrual.referral?.basis,
          reverses: accrual._id,
        },
      });

      reversed += 1;
    }

    return { reversed };
  } catch (error) {
    console.error(`  Referral: reversal for ${invoiceNumber} failed — ${error.message}`);
    return { reversed: 0 };
  }
}

/**
 * Reverses commission for a refunded order.
 *
 * An order's refund is matched to its invoice, then handled exactly like a
 * void: the commission that money earned goes back with it.
 *
 * `Invoice` carries no order number — it references the order by id — so the
 * caller passes the order's `_id`.
 */
export async function reverseForOrder(orderId) {
  const invoice = await Invoice.findOne({ order: orderId }).select('number').lean();
  if (!invoice) return { reversed: 0 };
  return reverseForInvoice(invoice.number);
}

// ---- the admin screen -------------------------------------------------------

/**
 * The referrals table: one row per referrer→referred pair.
 *
 * Figures come from the **ledger**, never from a running total on the user:
 * `storeCredit` is one number covering refunds, grants and top-ups too, and
 * cannot answer "how much has this pairing earned". Summing the rows can.
 */
export async function listReferrals({ search, from, to } = {}) {
  const referred = await User.find({ referredBy: { $ne: null } })
    .select('businessName contactName email status createdAt referredBy')
    .sort({ createdAt: -1 })
    .lean();

  const referrerIds = [...new Set(referred.map((row) => String(row.referredBy)))];
  const referrers = await User.find({ _id: { $in: referrerIds } })
    .select('businessName referralCode status')
    .lean();
  const byId = new Map(referrers.map((row) => [String(row._id), row]));

  // Every referral movement in one read, then grouped in memory — the ledger is
  // small next to the orders collection and this keeps the period filter and
  // the pairing arithmetic in one place.
  const ledgerFilter = { type: 'referral' };
  if (from || to) {
    ledgerFilter.createdAt = {};
    if (from) ledgerFilter.createdAt.$gte = new Date(`${from}T00:00:00`);
    if (to) {
      const end = new Date(`${to}T00:00:00`);
      end.setHours(23, 59, 59, 999);
      ledgerFilter.createdAt.$lte = end;
    }
  }
  const ledger = await CreditTransaction.find(ledgerFilter).lean();

  // Accruals and reversals are tracked separately as well as netted.
  //
  // The net alone cannot answer "has any commission been clawed back": an
  // accrual of $100 and a reversal of $100 net to zero and look identical to
  // nothing having happened. The gross figures are what the reversal notice on
  // the screen reads, so money that went back out is stated rather than
  // silently absorbed into a total that merely moved.
  const stats = new Map();
  for (const row of ledger) {
    const key = `${String(row.user)}:${String(row.referral?.from ?? '')}`;
    const current = stats.get(key) ?? { earned: 0, accrued: 0, reversed: 0, payments: 0, lastAt: null };
    current.earned += row.amount;

    if (row.amount > 0) {
      current.accrued += row.amount;
      // Reversals are not payments: counting them would inflate "payments
      // counted" for a pairing whose money came back.
      current.payments += 1;
      if (!current.lastAt || row.createdAt > current.lastAt) current.lastAt = row.createdAt;
    } else {
      current.reversed += row.amount;
      // A reversed accrual is no longer a payment that earned anything, so it
      // stops being counted — otherwise a fully clawed-back pairing still reads
      // as though it had paid out.
      current.payments = Math.max(current.payments - 1, 0);
    }

    stats.set(key, current);
  }

  let rows = referred.map((account) => {
    const referrer = byId.get(String(account.referredBy));
    const stat = stats.get(`${String(account.referredBy)}:${String(account._id)}`) ?? {
      earned: 0,
      accrued: 0,
      reversed: 0,
      payments: 0,
      lastAt: null,
    };

    return {
      id: account._id.toString(),
      referrer: {
        id: String(account.referredBy),
        businessName: referrer?.businessName ?? 'Unknown',
        referralCode: referrer?.referralCode ?? null,
      },
      referred: {
        id: account._id.toString(),
        businessName: account.businessName,
        contactName: account.contactName,
        email: account.email,
        // A pending referral has earned nothing yet and cannot until it is
        // approved and starts paying invoices — the screen shows it so the
        // operator can see the pipeline, not only the payouts.
        status: account.status,
      },
      joinedAt: account.createdAt,
      paymentsCounted: stat.payments,
      // Net of reversals — the column shows what this pairing has actually kept.
      commissionEarned: stat.earned,
      // Gross, so the screen can say a reversal happened rather than leaving it
      // to be inferred from a net that merely moved.
      commissionAccrued: stat.accrued,
      commissionReversed: stat.reversed,
      lastPayoutAt: stat.lastAt,
    };
  });

  if (search) {
    const rx = likeRegex(search);
    rows = rows.filter(
      (row) =>
        rx.test(row.referrer.businessName) ||
        rx.test(row.referred.businessName) ||
        rx.test(row.referred.email ?? ''),
    );
  }

  const totals = {
    // "Active" means a referrer with at least one referral that has earned
    // something — a code handed out and never used is not an active referrer.
    activeReferrers: new Set(
      rows.filter((row) => row.paymentsCounted > 0).map((row) => row.referrer.id),
    ).size,
    referredAccounts: rows.length,
    // Summed from the gross figures, not from each row's net. Netting first
    // would report zero reversals for a pairing that accrued $100 and had all
    // $100 clawed back — the two cancel, and "nothing was reversed" is exactly
    // the wrong thing to say about that.
    creditIssued: rows.reduce((sum, row) => sum + row.commissionAccrued, 0),
    creditReversed: rows.reduce((sum, row) => sum + row.commissionReversed, 0),
    // What referrers have actually kept.
    creditNet: rows.reduce((sum, row) => sum + row.commissionEarned, 0),
    // Referred accounts that exist but have not yet earned anything: signed up,
    // not yet paying. This is the "Pending" tile.
    pending: rows.filter((row) => row.paymentsCounted === 0).length,
  };

  return { referrals: rows, totals, percent: await currentPercent() };
}

export default {
  accrueForPayment,
  currentPercent,
  ensureReferralCode,
  listReferrals,
  resolveReferralCode,
  reverseForInvoice,
  reverseForOrder,
  setPercent,
};
