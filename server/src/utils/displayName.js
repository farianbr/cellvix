/**
 * What to call an account on screen.
 *
 * **The account's identity is the person, not the company.** `contactName` is
 * required and `businessName` is an optional detail, so a screen that reads
 * `businessName` directly renders blank for every sole trader who never filled
 * it in. This is the single answer to "what is this account called": the person
 * first, the company only if there is no person, the email last so a heading
 * can never come out empty.
 *
 * `User` carries the same logic as a `displayName` virtual for documents. This
 * function exists because most read paths are `.lean()` — plain objects, no
 * virtuals — and the two must not be allowed to disagree. Change one, change
 * both.
 *
 * @param {{ contactName?: string, businessName?: string, email?: string }} user
 * @returns {string}
 */
function displayNameOf(user) {
  if (!user) return '—';
  return user.contactName?.trim() || user.businessName?.trim() || user.email || '—';
}

exports.default = { displayNameOf };

// --- CommonJS exports -------------------------------------------------
exports.displayNameOf = displayNameOf;
