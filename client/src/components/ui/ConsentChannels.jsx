import { Check, Mail, MessageCircle, MessageSquare, Phone } from 'lucide-react';
import cn from '@/lib/cn';

/**
 * The four channels a customer can agree to be contacted on (CASL, §6.13).
 *
 * One definition, three consumers: the customer profile's `ConsentPanel`, the
 * admin's new-customer form and the storefront sign-up. The list and the
 * on/off styling live here so a channel added later cannot appear on one
 * surface and not another, and so "consented" never looks different depending
 * on which screen recorded it.
 *
 * Controlled and stateless on purpose. `ConsentPanel` holds its ticks as draft
 * state until an explicit Save, because editing an existing record must not
 * restamp the consent date four times while somebody is still deciding; a
 * create form has no such record yet and writes straight to its own form
 * state. Both of those are the caller's business, not this component's.
 */

export const CONSENT_CHANNELS = [
  { key: 'sms', label: 'SMS', icon: MessageSquare },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'call', label: 'Phone Call', icon: Phone },
];

/** An empty answer. Not the same fact as "declined" — see `ConsentPanel`. */
export const EMPTY_CONSENT = { sms: false, whatsapp: false, email: false, call: false };

export function ConsentChannels({ value = EMPTY_CONSENT, onChange, disabled = false, className }) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {CONSENT_CHANNELS.map(({ key, label, icon: Icon }) => {
        const on = Boolean(value[key]);
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange?.({ ...value, [key]: !on })}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-50',
              on
                ? 'border-ok/30 bg-ok-50 text-ok'
                : 'border-line bg-surface text-ink-500 hover:border-line-strong hover:text-ink-900',
            )}
          >
            {on ? (
              <Check className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
            ) : (
              <Icon className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default ConsentChannels;
