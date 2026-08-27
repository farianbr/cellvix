import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import {
  AlertCircle,
  ExternalLink,
  Eye,
  Newspaper,
  Pencil,
  Pen,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import cn from '@/lib/cn';
import { date } from '@/lib/format';
import { BLOG_CATEGORIES } from '@shared/schemas/content';
import RichText from '@/lib/richText';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import SelectMenu from '@/components/ui/SelectMenu';
import SelectField from '@/components/ui/SelectField';
import Checkbox from '@/components/ui/Checkbox';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import PostCover from '@/components/blog/PostCover';
import PageHeader from '@/components/admin/PageHeader';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { useAdminBlog, useAdminBlogPost, useAdminMutations } from '@/hooks/useAdmin';

const STATUS_FILTERS = [
  { value: 'all', label: 'All posts' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Drafts' },
];

const CATEGORY_OPTIONS = BLOG_CATEGORIES.map((category) => ({
  value: category.value,
  label: category.label,
}));

const CATEGORY_LABELS = Object.fromEntries(BLOG_CATEGORIES.map((c) => [c.value, c.label]));

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft — not on the site' },
  { value: 'published', label: 'Published — live on /blog' },
];

const BODY_HELP = `## Heading      ### Subheading      - bullet      1. numbered      > note      **bold**      \`code\``;

/** `2026-08-23` for a date input, from whatever the API sent. */
function toDateInput(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

/**
 * Post editor.
 *
 * The body is a plain textarea with a preview tab rather than a rich-text
 * widget: what is stored is the small markup vocabulary in `lib/richText.jsx`,
 * which renders to React nodes and never to HTML. A WYSIWYG here would produce
 * markup the renderer cannot represent — and an author who has no idea their
 * formatting was dropped on save.
 */
function PostForm({ post, onSubmit, onCancel, isPending, error }) {
  const [tab, setTab] = useState('write');

  const { register, handleSubmit, watch, formState, control } = useForm({
    defaultValues: {
      title: post?.title ?? '',
      excerpt: post?.excerpt ?? '',
      body: post?.body ?? '',
      category: post?.category ?? BLOG_CATEGORIES[0].value,
      tagList: (post?.tags ?? []).join(', '),
      coverImage: post?.coverImage ?? '',
      authorName: post?.author?.name ?? 'Cellvix',
      authorRole: post?.author?.role ?? '',
      status: post?.status ?? 'draft',
      publishedAt: toDateInput(post?.publishedAt),
      isFeatured: post?.isFeatured ?? false,
    },
  });

  const body = watch('body');
  const status = watch('status');

  return (
    <form
      onSubmit={handleSubmit((values) => {
        const { tagList, ...rest } = values;
        onSubmit({
          ...rest,
          tags: tagList
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
            .slice(0, 8),
        });
      })}
      className="space-y-4"
    >
      {error && (
        <p className="flex items-start gap-2 rounded-[10px] bg-danger-50 px-3 py-2.5 text-[13px] text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <Input
        label="Title"
        placeholder="How to grade a pull screen before you fit it"
        error={formState.errors.title?.message}
        data-autofocus
        {...register('title', { required: 'Give the post a title.' })}
      />

      <Textarea
        label="Excerpt"
        rows={2}
        value={watch('excerpt')}
        counter={320}
        hint="One or two sentences. Shown on the index and under the headline."
        error={formState.errors.excerpt?.message}
        {...register('excerpt', { required: 'Write a one-line summary.' })}
      />

      {/* ---- body: write / preview ---------------------------------------- */}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-ink-700">Body</span>
          <div className="flex rounded-[8px] border border-line p-0.5">
            {[
              { key: 'write', label: 'Write', icon: Pen },
              { key: 'preview', label: 'Preview', icon: Eye },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-pressed={tab === key}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2.5 text-[12.5px] font-medium transition-colors',
                  tab === key
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-400 hover:bg-surface-2 hover:text-ink-900',
                )}
              >
                <Icon className="size-3.5" strokeWidth={2} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Both panes stay mounted; the inactive one is hidden rather than
            unmounted, so switching to Preview and back cannot lose the caret
            position or an in-flight undo stack in the textarea. */}
        <div className={tab === 'write' ? '' : 'hidden'}>
          <Textarea
            rows={16}
            className="font-mono text-[13px]"
            value={body}
            hint={BODY_HELP}
            error={formState.errors.body?.message}
            {...register('body', { required: 'The post needs a body.' })}
          />
        </div>

        {tab === 'preview' && (
          <div className="max-h-[420px] overflow-y-auto rounded-[10px] border border-line bg-surface-2 px-4 py-3">
            {body?.trim() ? (
              <RichText>{body}</RichText>
            ) : (
              <p className="py-8 text-center text-[13px] text-ink-300">Nothing to preview yet.</p>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          control={control}
          name="category"
          label="Category"
          options={CATEGORY_OPTIONS}
        />
        <Input
          label="Tags"
          placeholder="grading, screens, quality"
          hint="Comma separated, up to eight."
          {...register('tagList')}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Author"
          error={formState.errors.authorName?.message}
          {...register('authorName', { required: 'Who wrote it?' })}
        />
        <Input label="Author role" placeholder="Quality lead" {...register('authorRole')} />
      </div>

      <Input
        label="Cover image URL"
        placeholder="Leave blank for the drawn category cover"
        hint="Optional. Without one, the index draws a technical cover for this category."
        {...register('coverImage')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField control={control} name="status" label="Status" options={STATUS_OPTIONS} />
        <Input
          label="Publish date"
          type="date"
          hint={
            status === 'published'
              ? 'Blank publishes with today’s date.'
              : 'Only used once the post is published.'
          }
          {...register('publishedAt')}
        />
      </div>

      <Checkbox
        label="Feature this post at the top of the blog"
        className="-ml-2"
        {...register('isFeatured')}
      />

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          {post ? 'Save changes' : 'Create post'}
        </Button>
      </div>
    </form>
  );
}

/**
 * Loads the full post before rendering the form.
 *
 * The list payload deliberately omits `body` — nine articles of prose to render
 * nine cards — so editing an existing post needs one more request. Creating a
 * new one needs none.
 */
function PostEditor({ editingId, onSubmit, onCancel, isPending, error }) {
  const isNew = editingId === 'new';
  const { data: post, isLoading } = useAdminBlogPost(isNew ? null : editingId);

  if (!isNew && isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-11" />
        <Skeleton className="h-20" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <PostForm
      post={isNew ? null : post}
      onSubmit={onSubmit}
      onCancel={onCancel}
      isPending={isPending}
      error={error}
    />
  );
}

/**
 * Header metadata read from the same table the breadcrumb uses, so a page
 * title can never drift from its crumb.
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/marketing/blog'], icon: adminIcon('Newspaper') };

export function AdminBlogPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [editingId, setEditingId] = useState(null); // post id, or 'new'
  const [deleting, setDeleting] = useState(null);

  const { data, isLoading } = useAdminBlog({
    status: status === 'all' ? undefined : status,
    q: query || undefined,
  });
  const { createPost, updatePost, deletePost } = useAdminMutations();

  const posts = data?.posts ?? [];
  const isPending = createPost.isPending || updatePost.isPending;
  const error = (createPost.error ?? updatePost.error)?.message;

  return (
    <>
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={ADMIN_PAGE.title}
        description={ADMIN_PAGE.description}
      />

      <Panel
        title="Posts"
        description={
          data
            ? `${data.counts?.published ?? 0} published · ${data.counts?.draft ?? 0} in draft`
            : ''
        }
        action={
          <Button size="sm" icon={Plus} onClick={() => setEditingId('new')}>
            New post
          </Button>
        }
        flush
      >
        <div className="flex flex-wrap gap-2.5 border-b border-line p-4 sm:px-5">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Title, excerpt or tag…"
            icon={Search}
            containerClassName="min-w-[200px] flex-1"
          />
          <SelectMenu
            options={STATUS_FILTERS}
            value={status}
            onChange={setStatus}
            srLabel="Filter by status"
            size="md"
            className="w-[160px]"
          />
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4 sm:p-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-20" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <PanelEmpty
            icon={Newspaper}
            title="No posts yet"
            body="Articles written here appear on /blog and in the site search."
            action={
              <Button size="sm" icon={Plus} onClick={() => setEditingId('new')}>
                Write the first post
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {posts.map((post) => (
              <li key={post.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                <PostCover
                  post={post}
                  ratio="aspect-4/3"
                  className="w-16 shrink-0 rounded-[10px] border border-line"
                />

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <Badge tone={post.status === 'published' ? 'ok' : 'warn'} size="sm">
                      {post.status === 'published' ? 'Live' : 'Draft'}
                    </Badge>
                    <Badge tone="neutral" size="sm">
                      {CATEGORY_LABELS[post.category] ?? post.category}
                    </Badge>
                    {post.isFeatured && (
                      <Badge tone="brand" size="sm" icon={Star}>
                        Featured
                      </Badge>
                    )}
                  </div>

                  <p className="truncate text-[13.5px] font-medium text-ink-900">{post.title}</p>
                  <p className="mt-0.5 line-clamp-1 text-[12.5px] text-ink-500">{post.excerpt}</p>
                  <p className="mt-1 text-[11.5px] text-ink-300">
                    {post.author.name} · {post.readMinutes} min ·{' '}
                    {post.publishedAt ? date(post.publishedAt) : 'no publish date'} · updated{' '}
                    {date(post.updatedAt)}
                  </p>
                </div>

                <div className="flex shrink-0 gap-1">
                  {post.status === 'published' && (
                    <Link
                      to={`/blog/${post.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`View “${post.title}” on the site`}
                      className="flex size-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-surface-2 hover:text-ink-900"
                    >
                      <ExternalLink className="size-4" strokeWidth={1.75} />
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingId(post.id)}
                    aria-label={`Edit “${post.title}”`}
                    className="flex size-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-surface-2 hover:text-ink-900"
                  >
                    <Pencil className="size-4" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(post)}
                    aria-label={`Delete “${post.title}”`}
                    className="flex size-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger"
                  >
                    <Trash2 className="size-4" strokeWidth={1.75} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Modal
        open={Boolean(editingId)}
        onClose={() => setEditingId(null)}
        title={editingId === 'new' ? 'New post' : 'Edit post'}
        size="xl"
        align="top"
      >
        {editingId && (
          <PostEditor
            editingId={editingId}
            isPending={isPending}
            error={error}
            onCancel={() => setEditingId(null)}
            onSubmit={(values) => {
              const options = { onSuccess: () => setEditingId(null) };
              if (editingId === 'new') createPost.mutate(values, options);
              else updatePost.mutate({ id: editingId, ...values }, options);
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this post?"
        body={
          deleting
            ? `“${deleting.title}” will be removed permanently. ${
                deleting.status === 'published'
                  ? 'It is live, so any link to it will start returning a 404.'
                  : 'It has never been published.'
              }`
            : ''
        }
        loading={deletePost.isPending}
        error={deletePost.error?.message}
        onConfirm={() => deletePost.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </>
  );
}

export default AdminBlogPage;
