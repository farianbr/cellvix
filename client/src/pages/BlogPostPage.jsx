import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, Clock, Tag } from 'lucide-react';
import { date } from '@/lib/format';
import { BLOG_CATEGORIES } from '@shared/schemas/content';
import RichText from '@/lib/richText';
import Skeleton from '@/components/ui/Skeleton';
import PostCover from '@/components/blog/PostCover';
import WhyCellvix from '@/components/product/WhyCellvix';
import useScrollProgress from '@/hooks/useScrollProgress';
import { useBlogPost } from '@/hooks/useContent';

const LABELS = Object.fromEntries(BLOG_CATEGORIES.map((c) => [c.value, c.label]));

export function BlogPostPage() {
  const { slug } = useParams();
  const { data, isLoading, error } = useBlogPost(slug);
  const { progress } = useScrollProgress();

  const post = data?.post;

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
      <div className="mx-auto max-w-[760px] px-4 py-10">
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
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-[22px]">That article is not here</h1>
        <p className="mt-3 text-[14px] text-ink-500">{error.message}</p>
        <Link
          to="/blog"
          className="mt-6 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand hover:text-brand-700"
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

      <article className="mx-auto max-w-[760px] px-3 py-6 sm:px-4 lg:py-10">
        <Link
          to="/blog"
          className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-400 transition-colors hover:text-brand"
        >
          <ArrowLeft className="size-4" strokeWidth={2} aria-hidden="true" />
          Journal
        </Link>

        <header>
          <p className="eyebrow mb-3 text-brand">{LABELS[post.category] ?? post.category}</p>
          <h1 className="text-[28px] leading-tight sm:text-[36px]">{post.title}</h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-ink-500">{post.excerpt}</p>

          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-line py-3.5 text-[12.5px] text-ink-400">
            <span className="flex size-8 items-center justify-center rounded-full bg-brand-gradient font-display text-[12px] font-bold text-white">
              {post.author.name
                .split(' ')
                .map((word) => word[0])
                .slice(0, 2)
                .join('')}
            </span>
            <span>
              <span className="block font-medium text-ink-900">{post.author.name}</span>
              {post.author.role && <span className="block text-[11.5px]">{post.author.role}</span>}
            </span>
            <span className="ml-auto flex items-center gap-3">
              <time dateTime={post.publishedAt ?? undefined}>{date(post.publishedAt)}</time>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                {post.readMinutes} min read
              </span>
            </span>
          </div>
        </header>

        <PostCover post={post} className="mt-7 rounded-[14px] border border-line" />

        <div className="mt-8">
          <RichText>{post.body}</RichText>
        </div>

        {post.tags?.length > 0 && (
          <ul className="mt-9 flex flex-wrap items-center gap-2 border-t border-line pt-6">
            <li className="text-ink-300">
              <Tag className="size-4" strokeWidth={1.75} aria-hidden="true" />
              <span className="sr-only">Tags</span>
            </li>
            {post.tags.map((tag) => (
              <li key={tag}>
                <Link
                  to={`/blog?tag=${encodeURIComponent(tag)}`}
                  className="inline-flex h-7 items-center rounded-full border border-line bg-surface px-3 text-[12.5px] text-ink-500 transition-colors hover:border-brand hover:text-brand"
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
            <h2 className="mb-4 text-[18px]">Read next</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
              {data.related.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`/blog/${item.slug}`}
                    className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2 sm:px-5"
                  >
                    <PostCover
                      post={item}
                      ratio="aspect-4/3"
                      className="w-20 shrink-0 rounded-[10px] border border-line"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="eyebrow mb-1 block text-ink-300">
                        {LABELS[item.category] ?? item.category}
                      </span>
                      <span className="block text-[14px] font-semibold leading-snug text-ink-900 group-hover:text-brand">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-ink-400">
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
    </>
  );
}

export default BlogPostPage;
