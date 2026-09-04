import cn from '@/lib/cn';

/**
 * How wide an admin page's content is allowed to be.
 *
 * Eleven admin screens capped themselves at five different widths — 680, 760,
 * 820, 860 and 900 — with no rule behind any of them. That is the same drift
 * the type scale had: each page picked a number that looked right on the screen
 * its author had open, and the set never agreed.
 *
 * Two shapes cover every page, and the difference between them is real rather
 * than aesthetic:
 *
 * `form` — a settings screen. A column of labelled fields has a comfortable
 * measure the same way prose does: past roughly 70 characters the eye loses the
 * line, and a text input stretched to 1400px is a worse target than a short
 * one, not a better one. So a form column stops.
 *
 * `record` — an order, an invoice, a client. These are the pages that were
 * getting this most wrong. A record is a set of RELATED blocks, and capping it
 * at 900px on a 1440px screen left 250px of dead space down one side while the
 * blocks stacked vertically and pushed the timeline below the fold. The blocks
 * want to sit beside each other; the cap was stopping them.
 *
 * `full` — a list, a board, a dashboard. Already the default, named here so a
 * page can say "deliberately unconstrained" rather than saying nothing.
 */
const WIDTHS = {
  form: 'max-w-[760px]',
  record: 'max-w-[1280px]',
  full: '',
};

export function PageWidth({ as: Tag = 'div', variant = 'record', className, children }) {
  return <Tag className={cn(WIDTHS[variant] ?? WIDTHS.record, className)}>{children}</Tag>;
}

export default PageWidth;
