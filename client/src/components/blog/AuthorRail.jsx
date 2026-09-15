import { Link } from 'react-router';
import { Clock, Tag } from 'lucide-react';
import { date } from '@/lib/format';
import cn from '@/lib/cn';
import { pressable } from '@/lib/motion';
import AuthorCard from '@/components/content/AuthorCard';

/**
 * Who wrote this post, and what else they have written.
 *
 * ## Why it is a rail and not a footer block
 *
 * The page already runs a three-track grid whose right-hand track was empty
 * slack. A reader deciding whether to trust a grading procedure wants to know
 * who is telling them *while* they read it, not after - so the credential sits
 * level with the prose and stays there, which is the one thing a byline under
 * the title cannot do on a 2,000-word article.
 *
 * ## What it holds, and what it deliberately does not
 *
 * Author, the post's own meta, then their other posts. That is the whole rail.
 * It is not a second table of contents (there is one, on the left), not a share
 * row, and not a newsletter box: everything here answers "who says so, and what
 * else do they know", and anything that does not answer that belongs elsewhere.
 *
 * The card itself is `AuthorCard`, shared with the product article rail, so a
 * field added to a byline appears in both places without being written twice.
 *
 * Renders from `xl` up, the breakpoint the third track appears at, and is
 * sticky within it. Below that it does not render at all - see the comment on
 * the element for why a stacked copy is worse than none.
 */
function AuthorRail({ post, related = [], labels = {}, className }) {
  return (
    /* `xl` and up only. Below that the grid has collapsed and this would sit a
       few hundred pixels under the byline printing the same name, role, date
       and read time again - the rail exists to put the credential BESIDE the
       prose, and stacked under it, it is just the byline twice. The one thing
       here the byline does not carry is the bio, so that renders inside the
       article at narrow widths instead (see `BlogPostPage`).

       `--chrome-h` is the sticky header PLUS the sliding nav row, set by
       `Header`. A bare `top-8` parked the card under that chrome and clipped
       its own top off; every sticky element in the app clears the same way. */
    <aside
      className={cn(
        'hidden min-w-0 xl:sticky xl:top-[calc(var(--chrome-h,158px)+24px)] xl:block xl:self-start',
        className,
      )}
      aria-label="About the author"
    >
      <AuthorCard author={post.author} />

      {/* The post's own meta, under the author rather than inside the card:
          these belong to the article, not to the person who wrote it, and the
          card is shared with a page whose meta is different. They sit here as
          well as in the byline because the rail travels with the reader and the
          byline does not - at the bottom of a long article "how long is this"
          is still the question being asked. */}
      <div className="mt-3 rounded-lg border border-line bg-surface px-5 py-4">
        <dl className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-400">
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Published</dt>
            <dd>
              <time dateTime={post.publishedAt ?? undefined}>{date(post.publishedAt)}</time>
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden="true" />
            <dt className="sr-only">Reading time</dt>
            <dd>{post.readMinutes} min read</dd>
          </div>
        </dl>

        {/* The article prints its own tag row under the body, and that one is
            `xl:hidden` - so exactly one of the two shows at every width. */}
        {post.tags?.length > 0 && (
          <ul className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-line pt-3.5">
            <li className="text-ink-300">
              <Tag className="size-3.5" strokeWidth={2} aria-hidden="true" />
              <span className="sr-only">Filed under</span>
            </li>
            {post.tags.map((tag) => (
              <li key={tag}>
                <Link
                  to={`/blog?tag=${encodeURIComponent(tag)}`}
                  className={cn(
                    pressable,
                    'inline-flex h-6 items-center rounded-full border border-line px-2.5 text-xs text-ink-500 hover:border-brand hover:text-brand',
                  )}
                >
                  {tag}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Narrow, one-line-per-post version of the article's own "Read next"
          block, which is `xl:hidden` for the same reason the tag row is: both
          rendering printed the same three links twice on one screen. */}
      {related.length > 0 && (
        <div className="mt-4">
          <h2 className="eyebrow mb-2.5 px-1 text-ink-300">More like this</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {related.map((item) => (
              <li key={item.id}>
                <Link
                  to={`/blog/${item.slug}`}
                  className={cn(pressable, 'group block px-4 py-3 hover:bg-surface-2')}
                >
                  <span className="eyebrow mb-1 block text-ink-300">
                    {labels[item.category] ?? item.category}
                  </span>
                  <span className="block text-sm font-semibold leading-snug text-ink-900 group-hover:text-brand">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-xs text-ink-400">
                    {item.readMinutes} min read
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}

export default AuthorRail;
