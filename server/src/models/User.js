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
    businessName: { type: String, required: true, trim: true },
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

    // One login per business — the brief explicitly rules out team roles.
    role: { type: String, enum: ['buyer', 'admin'], default: 'buyer' },
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

/** The shape sent to the client. Never leaks passwordHash. */
userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    businessName: this.businessName,
    contactName: this.contactName,
    email: this.email,
    phone: this.phone,
    role: this.role,
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
    approvedAt: this.approvedAt,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model('User', userSchema);
export default User;
