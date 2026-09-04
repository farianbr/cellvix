/**
 * Escapes a user-supplied string so it can sit inside a RegExp literal.
 *
 * Every search endpoint builds a case-insensitive `RegExp` from whatever was
 * typed. Without this, a lone `(` is a 500 and `.*` is a full collection scan.
 */
function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `escapeRegex` plus the `RegExp` construction every caller does next. */
function likeRegex(value, flags = 'i') {
  return new RegExp(escapeRegex(String(value).trim()), flags);
}

export { escapeRegex, likeRegex };
export default escapeRegex;
