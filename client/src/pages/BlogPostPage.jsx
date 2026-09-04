import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, Clock, Tag } from 'lucide-react';
import { date } from '@/lib/format';
import { BLOG_CATEGORIES } from '@shared/schemas/content';
import RichText, { extractHeadings } from '@/lib/richText';
import Skeleton from '@/components/ui/Skeleton';
import PostCover from '@/components/blog/PostCover';
import TableOfContents from '@/components/blog/TableOfContents';
import WhyCellvix from '@/components/product/WhyCellvix';
import useActiveSection from '@/hooks/useActiveSection';
import useScrollProgress from '@/hooks/useScrollProgress';
import { useBlogPost } from '@/hooks/useContent';
import { pressable } from '@/lib/motion';
import cn from '@/lib/cn';

const LABELS = Object.fromEntries(BLOG_CATEGORIES.map((c) => [c.value, c.label]));

export function BlogPostPage() {
  const { slug } = useParams();
  const { data, isLoading, error } = useBlogPost(slug);
  const { progress } = useScrollProgress();

  const post = data?.post;

  // The contents come out of the body itself, so an author who renames a
  // heading renames the entry that points at it and nothing drifts.
  const headings = useMemo(() => (post ? extractHeadings(post.body) : []), [post]);
  const headingIds = useMemo(() => headings.map((heading) => heading.id), [headings]);
  const activeHeading = useActiveSection(headingIds);

  // The document title is the one piece of chrome a single-page router will not
  // update on its own, and it is what a shared link shows in a tab strip.
  useEffect(() => {
    if (!post) return undefined;
    const previous = document.title;
    document.title = `${post.title} — Cellvix`;
    return () => {
      document.title = previous;
    };
  }, [post]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1400px] px-3 py-6 sm:px-4 lg:px-6 lg:py-10">
        {/* Same measure the loaded article uses, so the skeleton does not sit at
            a different width than the prose that replaces it. */}
        <div className="mx-auto max-w-[760px]">
          <Skeleton className="mb-4 h-4 w-32" />
          <Skeleton className="mb-3 h-10 w-full" />
          <Skeleton className="mb-8 h-4 w-56" />
          <Skeleton className="mb-8 aspect-16/10" rounded="lg" />
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-2xl">That article is not here</h1>
        <p className="mt-3 text-md text-ink-500">{error.message}</p>
        <Link
          to="/blog"
          className="mt-6 inline-flex items-center gap-1.5 text-md font-semibold text-brand hover:text-brand-700"
        >
          <ArrowLeft className="size-4" strokeWidth={2} aria-hidden="true" />
          Back to the journal
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Reading progress. A long-form page is the one place a progress rule
          earns its keep, and it is the gradient at 2px — an accent rule, not a
          fill (PROJECT_INSTRUCTIONS.md §2.2). */}
      <div
        className="sticky top-0 z-30 h-0.5 w-full bg-line/60"
        role="presentation"
        aria-hidden="true"
      >
        <div
          className="rule-brand-gradient h-full origin-left transition-transform duration-150"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      {/* The page is the same 1400px box every other page uses, so the header,
          the footer and the article all line up down one pair of edges — a
          narrower slab here read as a different site.

          Inside it, the PROSE still stops at 760px: a measure that grows with
          the viewport is what makes long-form unreadable at 1440, and that is a
          separate question from how wide the page is. The width the page has
          over the measure goes to the rails, so the article sits in a real
          three-part layout rather than floating in a short centred column.

          The contents rail sits on the LEFT, and is first in the DOM too: it is
          navigation for the page below it, so reaching it before the prose is
          the right order for a screen reader and for a Tab key as much as it is
          for the eye.

          The tracks start at the page's left edge rather than being centred in
          it, so the contents rail lines up with the logo above it and the grid
          on the Shop page — the same left margin down every page. The slack a
          wide window has collects in a third, empty track on the right, which is
          where the eye expects white space in a left-aligned layout. */}
      <div className="mx-auto grid max-w-[1400px] gap-10 px-3 py-6 sm:px-4 lg:px-6 lg:py-10 xl:grid-cols-[220px_minmax(0,760px)_1fr]">
        <TableOfContents headings={headings} activeId={activeHeading} variant="rail" />

        <article className="min-w-0">
          <Link
            to="/blog"
            className={cn(pressable, 'mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-400 hover:text-brand')}
          >
            <ArrowLeft className="size-4" strokeWidth={2} aria-hidden="true" />
            Journal
          </Link>

          <header>
            <p className="eyebrow mb-3 text-brand">{LABELS[post.category] ?? post.category}</p>
            <h1 className="text-3xl leading-tight sm:text-d-sm">{post.title}</h1>
            <p className="mt-4 text-lg leading-relaxed text-ink-500">{post.excerpt}</p>

            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-line py-3.5 text-sm text-ink-400">
              <span className="flex size-8 items-center justify-center rounded-full bg-brand-gradient-orb font-display text-xs font-bold text-white">
                {post.author.name
                  .split(' ')
                  .map((word) => word[0])
                  .slice(0, 2)
                  .join('')}
              </span>
              <span>
                <span className="block font-medium text-ink-900">{post.author.name}</span>
                {post.author.role && <span className="block text-xs">{post.author.role}</span>}
              </span>
              <span className="ml-auto flex items-center gap-3">
                <time dateTime={post.publishedAt ?? undefined}>{date(post.publishedAt)}</time>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                  {post.readMinutes} min read
                </span>
              </span>
            </div>
          </header>

          <PostCover post={post} className="mt-7 rounded-lg border border-line" />

          <TableOfContents
            headings={headings}
            activeId={activeHeading}
            variant="inline"
            className="mt-7"
          />

          <div className="mt-8">
            <RichText headingIds>{post.body}</RichText>
          </div>

          {post.tags?.length > 0 && (
            <ul className="mt-9 flex flex-wrap items-center gap-2 border-t border-line pt-6">
              <li className="text-ink-300">
                <Tag className="size-4" strokeWidth={2} aria-hidden="true" />
                <span className="sr-only">Tags</span>
              </li>
              {post.tags.map((tag) => (
                <li key={tag}>
                  <Link
                    to={`/blog?tag=${encodeURIComponent(tag)}`}
                    className={cn(pressable, 'inline-flex h-7 items-center rounded-full border border-line bg-surface px-3 text-sm text-ink-500 hover:border-brand hover:text-brand')}
                  >
                    {tag}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <WhyCellvix className="mt-10" />

          {data.related?.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-4 text-xl">Read next</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                {data.related.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={`/blog/${item.slug}`}
                      className={cn(pressable, 'group flex items-center gap-4 px-4 py-3.5 hover:bg-surface-2 sm:px-5')}
                    >
                      <PostCover
                        post={item}
                        ratio="aspect-4/3"
                        className="w-20 shrink-0 rounded-md border border-line"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="eyebrow mb-1 block text-ink-300">
                          {LABELS[item.category] ?? item.category}
                        </span>
                        <span className="block text-md font-semibold leading-snug text-ink-900 group-hover:text-brand">
                          {item.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-ink-400">
                          {date(item.publishedAt)} · {item.readMinutes} min read
                        </span>
                      </span>
                      <ArrowRight
                        className="size-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      </div>
    </>
  );
}

export default BlogPostPage;
