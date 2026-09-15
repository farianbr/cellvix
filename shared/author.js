/**
 * The byline attached to a piece of long-form copy.
 *
 * ONE definition, used by both things that carry one: a blog post and a product
 * article. They started with different shapes - the blog had `{ name, role }`
 * on the model and the article had a hardcoded "Written by the Cellvix parts
 * desk" string in the component - and the moment both grew a photo and social
 * links that divergence would have become two author forms, two serializers and
 * two sets of rules about which links are allowed. Defined here instead, so a
 * field added for one is a field the other already has.
 *
 * ## What is and is not in here
 *
 * Name, role, bio, photo, and a small fixed set of links. Not a `User`
 * reference: an author is a byline, not an account. The person who wrote a post
 * often has no login, the copy outlives their employment, and pointing the
 * public site at a row in the accounts collection would leak a real staff
 * record onto a page any visitor can read.
 *
 * ## Links
 *
 * A FIXED set of keys rather than a free list of `{ label, url }` pairs. The
 * rail draws a known icon per key, and an open list would mean either an icon
 * picker in the admin form or a generic link glyph for everything, both of
 * which are worse than four named fields. `website` is the escape hatch for
 * anything else.
 *
 * `email` is deliberately absent. A public mailto on a staff byline is a
 * spam-harvesting target, and the site already has one contact route that goes
 * to a desk rather than a person.
 */

/** The link fields an author may carry, in the order the rail draws them. */
const AUTHOR_LINKS = [
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://www.linkedin.com/in/…' },
  { key: 'x', label: 'X', placeholder: 'https://x.com/…' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://www.facebook.com/…' },
  { key: 'website', label: 'Website', placeholder: 'https://…' },
];

const AUTHOR_LINK_KEYS = AUTHOR_LINKS.map((link) => link.key);

/**
 * The Mongoose shape. A plain object rather than a `Schema`, so each model
 * embeds it as a sub-document without the two sharing one instance - a single
 * `Schema` object reused across models is a documented Mongoose foot-gun.
 *
 * `photo` is a URL, matching `coverImage` on the blog and every other image in
 * the project: there is no upload pipeline here, and inventing one for a byline
 * photo would be a larger change than the byline is worth.
 */
function authorModelShape() {
  return {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    role: { type: String, trim: true, maxlength: 80 },
    bio: { type: String, trim: true, maxlength: 400 },
    photo: { type: String, trim: true, maxlength: 500 },
    links: Object.fromEntries(
      AUTHOR_LINK_KEYS.map((key) => [key, { type: String, trim: true, maxlength: 300 }]),
    ),
  };
}

/**
 * Normalise whatever the admin form sent into the model's shape.
 *
 * The form posts flat fields (`authorName`, `authorPhoto`, `authorLinkedin`)
 * because that is what a flat `register()` form produces; the model wants them
 * nested. Doing it here means the two write paths - blog and article - cannot
 * disagree about the mapping.
 *
 * Empty strings become `undefined` so an author who has no LinkedIn stores no
 * key at all, rather than an empty one the rail then has to test for.
 */
function authorFromForm(data = {}) {
  const trimmed = (value) => {
    const text = String(value ?? '').trim();
    return text || undefined;
  };

  const links = {};
  for (const key of AUTHOR_LINK_KEYS) {
    const value = trimmed(data[`author${key.charAt(0).toUpperCase()}${key.slice(1)}`]);
    if (value) links[key] = value;
  }

  return {
    name: String(data.authorName ?? '').trim(),
    role: trimmed(data.authorRole),
    bio: trimmed(data.authorBio),
    photo: trimmed(data.authorPhoto),
    links: Object.keys(links).length ? links : undefined,
  };
}

/**
 * The public shape, for a serializer.
 *
 * Always returns every key so the client never has to guard on a missing
 * object, and never returns a `links` entry that is empty - the rail renders an
 * icon row only when there is at least one link, and "an empty object is
 * falsy-ish" is exactly the kind of check that gets written wrong once.
 */
function authorToPublic(author, fallbackName = 'Cellvix') {
  const links = {};
  for (const key of AUTHOR_LINK_KEYS) {
    const value = author?.links?.[key];
    if (value) links[key] = value;
  }

  return {
    name: author?.name || fallbackName,
    role: author?.role ?? '',
    bio: author?.bio ?? '',
    photo: author?.photo ?? '',
    links,
  };
}

export { AUTHOR_LINKS, AUTHOR_LINK_KEYS, authorModelShape, authorFromForm, authorToPublic };
