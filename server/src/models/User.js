import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, default: 'Shipping' },
    contactName: String,
    company: String,
    line1: { type: String, required: true },
    line2: String,
    city: { type: String, required: true },
    region: { type: String, required: true }, // Canadian province / territory
    postal: { type: String, required: true },
    country: { type: String, default: 'Canada' },
    phone: String,
    isDefaultShipping: { type: Boolean, default: false },
    isDefaultBilling: { type: Boolean, default: false },
  },
  { _id: true },
);

const paymentMethodSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['card', 'ach', 'terms'], default: 'card' },
    brand: String,
    last4: String,
    expMonth: Number,
    expYear: Number,
    isDefault: { type: Boolean, default: false },
  },
  { _id: true },
);

const userSchema = new mongoose.Schema(
  {
    /**
     * **The account's identity is the person, not the company.**
     *
     * `contactName` is required and is what every screen shows; `businessName`
     * is an optional detail a buyer can fill in later. It was the other way
     * round, which meant a sole trader with no registered company name could
     * not open an account at all, and every screen greeted a person by their
     * paperwork.
     *
     * Nothing reads `businessName` directly for display any more — use
     * `displayName` below, which falls back to the person and then to the email
     * so a heading can never render blank.
     */
    businessName: { type: String, trim: true },
    contactName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    phone: String,

    // Account type, not a permission set.
    //
    // The brief's "one login per business, no team roles" governs BUYERS: a
    // customer company has exactly one login, and that has not changed. 'staff'
    // is a Cellvix-side employee (ERP rework §7.6) — our people, never a
    // buyer's colleague. The two populations never mix.
    role: { type: String, enum: ['buyer', 'staff', 'admin'], default: 'buyer' },

    // Which permission set a staff member holds. Required for 'staff' and
    // meaningless for everyone else: 'admin' bypasses the role system outright
    // and a buyer never reaches it.
    //
    // A staff account with no staffRole has NO admin access at all. Access is
    // granted, never inherited — an unassigned employee is a locked door.
    staffRole: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null },

    /**
     * Which of OUR businesses this staff account works in (§6.14).
     *
     * **Not to be confused with `businessName` / `businessType` above**, which
     * describe the CUSTOMER's own company — a buyer's shop, its industry. This
     * references a `Business` document, meaning one of the businesses the
     * tenant operates, and it is what scopes a staff member's view.
     */
    business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', default: null },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'suspended'],
      default: 'pending',
      index: true,
    },

    taxId: String,
    resellerCert: String,
    website: String,
    businessType: String,

    // All money in integer cents.
    //
    // Two different things, deliberately named apart: creditLimit/balance are
    // the LINE OF CREDIT — what Cellvix lends this business and what it
    // currently owes. storeCredit is money the business already holds with us
    // (refunds, top-ups, admin allocations). See models/CreditTransaction.js.
    creditLimit: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    storeCredit: { type: Number, default: 0, min: 0 },
    terms: { type: String, enum: ['prepaid', 'net15', 'net30', 'net60'], default: 'prepaid' },

    addresses: [addressSchema],
    paymentMethods: [paymentMethodSchema],

    // Brief §7 "smart field memory": non-account checkout fields remembered per user.
    fieldMemory: { type: Map, of: String, default: {} },

    accountRep: {
      name: String,
      email: String,
      phone: String,
    },

    // ---- referral commission (ERP rework §6.13) ----------------------------
    //
    // A referring business earns a percentage of what the accounts it referred
    // pay, credited as store credit.
    //
    // The code is minted on approval, not at signup: a pending business might
    // never be approved, and a code that can refer people before its own
    // account is trusted is a code worth abusing.
    referralCode: { type: String, unique: true, sparse: true, index: true },

    // Who referred this account. **Set once, at registration, and never
    // editable afterwards** (§6.13) — a referrer that can be changed later is a
    // way to redirect money that has already been earned. Nothing in the admin
    // API exposes a write to this field.
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    // CASL consent (ERP rework §6.13).
    //
    // Canadian anti-spam law requires consent, a working unsubscribe and sender
    // identification on commercial email. This records the first two: what was
    // granted, where it came from, and when — because "we had consent" is a
    // claim that has to be evidenced, not asserted.
    //
    // Registering a B2B wholesale account is implied consent under CASL s.10(9) for
    // messages about the business relationship. It is recorded explicitly
    // anyway: an implied basis nobody wrote down is one nobody can defend.
    marketingConsent: {
      granted: { type: Boolean, default: false },
      source: String, // 'registration' | 'admin' | 'import'
      at: Date,
      ip: String,
    },

    /**
     * What the customer agreed to be contacted **on** (§6.13, CASL).
     *
     * This sits *beneath* `marketingConsent.granted`, which stays the master
     * switch — a campaign needs the master flag AND the channel it is sending
     * on, and `unsubscribedAt` still outranks both. Modelling it the other way
     * round, with four independent flags and no master, would mean an
     * unsubscribe had four places to be honoured and would eventually be missed
     * in one of them.
     *
     * `undefined` is not `false`. An account that predates this field has never
     * been asked, which is a different fact from having declined, so the
     * defaults below are applied only to accounts created from here on and the
     * read path treats a missing channel as "not recorded" (see
     * `consentChannels` in adminService).
     *
     * Every channel carries its own `at` and `source`: consent that cannot say
     * when it was given, and on what basis, is consent that cannot be defended.
     */
    contactConsent: {
      sms: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
      email: { type: Boolean, default: false },
      call: { type: Boolean, default: false },
      at: Date,
      source: String, // 'registration' | 'admin' | 'import'
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },

    /**
     * Membership tier — a label an admin sets, and nothing more (yet).
     *
     * It deliberately does **not** touch price. `services/pricingService.js` is
     * the only place a discount is decided and offers never stack; a tier that
     * quietly granted a percentage would be a second discount engine sitting
     * outside that rule. When tiers are meant to affect money, they go through
     * pricingService as a named offer type.
     */
    tier: {
      type: String,
      enum: ['standard', 'silver', 'gold', 'platinum'],
      default: 'standard',
      index: true,
    },

    /**
     * Staff-only notes about an account.
     *
     * Append-only, and never shown to the customer: this is where "always
     * disputes the freight line" and "pays late but pays" get written, and the
     * value of it depends entirely on nobody being able to quietly rewrite what
     * a colleague recorded. Deleting is an admin act with its own endpoint
     * rather than an edit in place.
     */
    internalNotes: [
      {
        body: { type: String, trim: true, maxlength: 2000, required: true },
        staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        staffName: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // Set the moment somebody unsubscribes. A timestamp rather than a boolean,
    // because the date is the part that matters if the consent is ever
    // questioned. Non-null excludes the account from every campaign, and it
    // outranks `marketingConsent.granted` — a later unsubscribe always beats an
    // earlier opt-in.
    unsubscribedAt: Date,

    /**
     * Password reset, stored as a **hash of** the token rather than the token.
     *
     * The value in the email is the only copy of the secret. What is kept here
     * is `sha256(token)`, so a leaked database dump cannot be used to reset
     * anybody's password — the same reason `passwordHash` exists two fields up.
     * SHA-256 without a salt is right here and wrong for a password: the token
     * is 32 random bytes, so there is no dictionary to attack and no need for a
     * slow KDF.
     *
     * `resetTokenAt` is the expiry, not the issue time — checked on use, so an
     * old link fails closed. Both are cleared the moment a reset succeeds,
     * which is what makes a link single-use.
     */
    resetTokenHash: { type: String, select: false },
    resetTokenAt: { type: Date, select: false },

    // Set when an admin locks a staff account out without deleting it — the
    // Users screen's Locked count. Distinct from `status: 'suspended'`, which
    // is the buyer-side approval ladder and has its own error message.
    lockedAt: Date,

    approvedAt: Date,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: String,
    lastLoginAt: Date,
  },
  { timestamps: true },
);

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
};

userSchema.methods.verifyPassword = function verifyPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

/**
 * What to call this account on screen, in one place.
 *
 * The person first, because the account is theirs; the company only if there is
 * no person; the email last so a heading can never come out blank. Every screen
 * that greets, lists or addresses an account reads this rather than picking a
 * field itself — otherwise "what is this account called" gets answered
 * differently on the dashboard, the approvals queue and an invoice, and an
 * account with no company name renders as an empty heading on some of them.
 *
 * A virtual rather than a stored field: it is derived, and a stored copy would
 * go stale the moment somebody edits their name.
 */
userSchema.virtual('displayName').get(function displayName() {
  return this.contactName?.trim() || this.businessName?.trim() || this.email;
});

/** The shape sent to the client. Never leaks passwordHash. */
userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    businessName: this.businessName,
    contactName: this.contactName,
    displayName: this.displayName,
    email: this.email,
    phone: this.phone,
    role: this.role,
    staffRole: this.staffRole ? String(this.staffRole._id ?? this.staffRole) : null,
    business: this.business ? String(this.business._id ?? this.business) : null,
    status: this.status,
    taxId: this.taxId,
    website: this.website,
    businessType: this.businessType,
    creditLimit: this.creditLimit,
    balance: this.balance,
    storeCredit: this.storeCredit ?? 0,
    terms: this.terms,
    addresses: this.addresses,
    paymentMethods: this.paymentMethods,
    fieldMemory: Object.fromEntries(this.fieldMemory ?? []),
    accountRep: this.accountRep,
    tier: this.tier ?? 'standard',
    approvedAt: this.approvedAt,
    createdAt: this.createdAt,
    // `internalNotes` is deliberately absent: this shape is what the account
    // holder receives about itself, and staff notes are not for them.
  };
};

const User = mongoose.model('User', userSchema);

export { User };
export default User;
