import { Facebook, Globe, Linkedin, User } from 'lucide-react';
import cn from '@/lib/cn';
import { pressable } from '@/lib/motion';

/**
 * The byline card: photo, name, role, bio and social links.
 *
 * ONE component for both places a byline appears - the blog post rail and the
 * product article rail - because they carry the same `author` shape from
 * `shared/author.js`. Two cards would have been two sets of link icons, two
 * fallbacks for a missing photo and two answers to "what if there is no bio".
 *
 * ## The photo, and its absence
 *
 * A photo is optional and most bylines will not have one, so the fallback is
 * not an afterthought: it is initials on the brand orb, which is what the
 * byline under the article title already draws. That keeps the two consistent
 * and means a missing photo never leaves a grey box or a broken-image glyph.
 * `onError` falls back to the same initials if the URL is wrong, because an
 * admin typing a URL by hand will sometimes type a bad one and a dead image is
 * worse than no image.
 *
 * ## The links
 *
 * Icon-only, because four labelled rows would outweigh the bio above them, and
 * each carries its own accessible name. `rel="noreferrer"` on every one: these
 * are admin-authored URLs pointing off-site.
 */

/** The icon per link key. Keys match `AUTHOR_LINKS` in `shared/author.js`. */
const LINK_ICONS = {
  linkedin: { icon: Linkedin, label: 'LinkedIn' },
  // Lucide has no X/Twitter glyph under a stable name, so the mark is drawn
  // here. One path, and it cannot break when the icon set is upgraded.
  x: {
    icon: function XMark(props) {
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    },
    label: 'X',
  },
  facebook: { icon: Facebook, label: 'Facebook' },
  website: { icon: Globe, label: 'Website' },
};

function AuthorCard({ author, eyebrow, className }) {
  if (!author?.name) return null;

  const initials = author.name
    .split(' ')
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('');

  const links = Object.entries(author.links ?? {}).filter(([key, url]) => LINK_ICONS[key] && url);

  return (
    <div className={cn('rounded-lg border border-line bg-surface p-5', className)}>
      {eyebrow && <p className="eyebrow mb-3.5 text-ink-300">{eyebrow}</p>}

      <div className="flex items-center gap-3">
        {author.photo ? (
          <img
            src={author.photo}
            alt=""
            width="48"
            height="48"
            loading="lazy"
            decoding="async"
            className="size-12 shrink-0 rounded-full border border-line object-cover"
            onError={(event) => {
              // Swap a dead URL for the initials rather than leaving the
              // browser's broken-image mark in a byline.
              event.currentTarget.hidden = true;
              event.currentTarget.nextElementSibling?.removeAttribute('hidden');
            }}
          />
        ) : null}

        {/* The fallback, and the error target for the image above. Hidden when
            a photo is present and revealed by `onError` if it fails. */}
        <span
          hidden={Boolean(author.photo)}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-gradient-orb font-display text-md font-bold text-white"
          aria-hidden="true"
        >
          {initials || <User className="size-5" strokeWidth={2} />}
        </span>

        {/* Not truncated. A role is a credential - "Quality lead, Toronto
            warehouse" clipped to "Quality lead, Toronto wareh…" reads as a
            layout failure and throws away the half that says WHERE. */}
        <span className="min-w-0">
          <span className="block font-display text-md font-bold leading-snug text-ink-900">
            {author.name}
          </span>
          {author.role && (
            <span className="mt-0.5 block text-sm leading-snug text-ink-500">{author.role}</span>
          )}
        </span>
      </div>

      {author.bio && (
        <p className="mt-3.5 border-t border-line pt-3.5 text-sm leading-relaxed text-ink-500">
          {author.bio}
        </p>
      )}

      {links.length > 0 && (
        <ul className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-line pt-3.5">
          {links.map(([key, url]) => {
            const { icon: Icon, label } = LINK_ICONS[key];
            return (
              <li key={key}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    pressable,
                    'flex size-8 items-center justify-center rounded-full border border-line text-ink-400 transition-colors duration-snap',
                    'hover:border-brand hover:text-brand',
                  )}
                >
                  <Icon className="size-4" strokeWidth={2} aria-hidden="true" />
                  <span className="sr-only">
                    {author.name} on {label}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default AuthorCard;
