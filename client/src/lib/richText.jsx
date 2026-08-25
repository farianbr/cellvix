import { Fragment } from 'react';
import cn from '@/lib/cn';

/**
 * A very small markup renderer for admin-authored copy (blog bodies, offer
 * descriptions, long FAQ answers).
 *
 * It returns React nodes. It never returns HTML and there is no
 * `dangerouslySetInnerHTML` anywhere near it, so an author — or anyone who ever
 * gets hold of an admin session — cannot inject script into a public page. That
 * is the whole reason this exists instead of a markdown library.
 *
 * Vocabulary, one construct per line:
 *   ## Heading          -> h2
 *   ### Subheading      -> h3
 *   - bullet            -> ul/li
 *   1. step             -> ol/li
 *   > note              -> blockquote
 *   ---                 -> hr
 *   blank line          -> paragraph break
 * Inline: **bold** and `code`.
 */

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`)/g;

/** Splits one line into bold / code / plain runs. */
export function renderInline(text, keyPrefix = 'i') {
  return text
    .split(INLINE)
    .filter((part) => part !== '')
    .map((part, index) => {
      const key = `${keyPrefix}-${index}`;

      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return (
          <strong key={key} className="font-semibold text-ink-900">
            {part.slice(2, -2)}
          </strong>
        );
      }

      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        return (
          <code
            key={key}
            className="rounded-[5px] border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[0.9em] text-ink-700"
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      return <Fragment key={key}>{part}</Fragment>;
    });
}

/** Authored text with the inline markers removed — for slugs and TOC labels. */
export function stripInline(text) {
  return String(text ?? '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

function slugify(text) {
  const slug = stripInline(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'section';
}

/**
 * Stamps a stable, unique id onto every heading block, in document order.
 *
 * Both `extractHeadings` and `RichText` run it over the same parsed blocks, so
 * a table of contents and the headings it points at cannot disagree — the ids
 * are derived from the body, not stored alongside it. Duplicate titles get a
 * numeric suffix rather than silently sharing an anchor.
 */
function withHeadingIds(blocks) {
  const seen = new Map();

  return blocks.map((block) => {
    if (block.type !== 'h2' && block.type !== 'h3') return block;

    const base = slugify(block.text);
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return { ...block, id: count === 1 ? base : `${base}-${count}` };
  });
}

/**
 * The headings of an authored body, for a table of contents.
 *
 * `levels` defaults to h2 only: a TOC that lists every subheading stops being a
 * map and becomes a second copy of the article.
 */
export function extractHeadings(source, { levels = ['h2'] } = {}) {
  return withHeadingIds(toBlocks(source))
    .filter((block) => levels.includes(block.type))
    .map((block) => ({
      id: block.id,
      text: stripInline(block.text),
      level: block.type === 'h3' ? 3 : 2,
    }));
}

/** Groups raw lines into blocks so lists survive as one element, not many. */
function toBlocks(source) {
  const blocks = [];
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'p', lines: paragraph });
      paragraph = [];
    }
  };

  for (const raw of String(source ?? '').split('\n')) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (trimmed === '') {
      flushParagraph();
      continue;
    }

    if (trimmed === '---') {
      flushParagraph();
      blocks.push({ type: 'hr' });
      continue;
    }

    if (trimmed.startsWith('### ')) {
      flushParagraph();
      blocks.push({ type: 'h3', text: trimmed.slice(4) });
      continue;
    }

    if (trimmed.startsWith('## ')) {
      flushParagraph();
      blocks.push({ type: 'h2', text: trimmed.slice(3) });
      continue;
    }

    if (trimmed.startsWith('> ')) {
      flushParagraph();
      const last = blocks.at(-1);
      // Consecutive quote lines are one blockquote, not a stack of them.
      if (last?.type === 'quote') last.lines.push(trimmed.slice(2));
      else blocks.push({ type: 'quote', lines: [trimmed.slice(2)] });
      continue;
    }

    if (trimmed.startsWith('- ')) {
      flushParagraph();
      const last = blocks.at(-1);
      if (last?.type === 'ul') last.items.push(trimmed.slice(2));
      else blocks.push({ type: 'ul', items: [trimmed.slice(2)] });
      continue;
    }

    const ordered = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (ordered) {
      flushParagraph();
      const last = blocks.at(-1);
      if (last?.type === 'ol') last.items.push(ordered[2]);
      else blocks.push({ type: 'ol', items: [ordered[2]] });
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  return blocks;
}

/**
 * Renders authored copy.
 *
 * `tone="prose"` is the article treatment; `tone="compact"` is for FAQ answers
 * and offer descriptions, where the same vocabulary appears at body size inside
 * a card and must not open up a magazine's worth of vertical rhythm.
 *
 * `headingIds` gives every heading an anchor, matching `extractHeadings`. It is
 * opt-in because two bodies rendered on one page would otherwise mint the same
 * ids twice; only the article view, which renders exactly one, turns it on.
 */
export function RichText({ children, tone = 'prose', headingIds = false, className }) {
  const parsed = toBlocks(children);
  const blocks = headingIds ? withHeadingIds(parsed) : parsed;
  const compact = tone === 'compact';

  // A jumped-to heading has to clear the sticky header and the reading-progress
  // rule sitting under it.
  const anchor = headingIds ? 'scroll-mt-[calc(var(--header-h,72px)+20px)]' : undefined;

  return (
    <div className={className}>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;

        switch (block.type) {
          case 'h2':
            return (
              <h2
                key={key}
                id={block.id}
                className={cn(
                  compact ? 'mt-4 text-[15px]' : 'mt-9 text-[19px] sm:text-[22px]',
                  block.id && anchor,
                )}
              >
                {renderInline(block.text, key)}
              </h2>
            );

          case 'h3':
            return (
              <h3
                key={key}
                id={block.id}
                className={cn(
                  compact ? 'mt-3.5 text-[14px]' : 'mt-7 text-[16px] sm:text-[17px]',
                  block.id && anchor,
                )}
              >
                {renderInline(block.text, key)}
              </h3>
            );

          case 'ul':
            return (
              <ul key={key} className={compact ? 'mt-2 space-y-1.5' : 'mt-4 space-y-2'}>
                {block.items.map((item, itemIndex) => (
                  <li
                    key={`${key}-${itemIndex}`}
                    className="relative pl-5 text-[14.5px] leading-relaxed text-ink-500"
                  >
                    <span
                      className="absolute left-0 top-[0.62em] size-1.5 rounded-full bg-brand"
                      aria-hidden="true"
                    />
                    {renderInline(item, `${key}-${itemIndex}`)}
                  </li>
                ))}
              </ul>
            );

          case 'ol':
            return (
              <ol key={key} className={compact ? 'mt-2 space-y-1.5' : 'mt-4 space-y-2.5'}>
                {block.items.map((item, itemIndex) => (
                  <li
                    key={`${key}-${itemIndex}`}
                    className="relative pl-8 text-[14.5px] leading-relaxed text-ink-500"
                  >
                    <span
                      className="tnum absolute left-0 top-0 flex size-5.5 items-center justify-center rounded-full bg-brand-50 font-display text-[11px] font-bold text-brand-700"
                      aria-hidden="true"
                    >
                      {itemIndex + 1}
                    </span>
                    {renderInline(item, `${key}-${itemIndex}`)}
                  </li>
                ))}
              </ol>
            );

          case 'quote':
            return (
              <blockquote
                key={key}
                className={
                  compact
                    ? 'mt-3 border-l-2 border-brand pl-3 text-[13.5px] italic text-ink-500'
                    : 'mt-6 rounded-r-[10px] border-l-[3px] border-brand bg-brand-50/60 py-3 pl-4 pr-4 text-[15px] leading-relaxed text-ink-700'
                }
              >
                {block.lines.map((line, lineIndex) => (
                  <p key={`${key}-${lineIndex}`}>{renderInline(line, `${key}-${lineIndex}`)}</p>
                ))}
              </blockquote>
            );

          case 'hr':
            return <hr key={key} className="mt-8 border-t border-line" />;

          default:
            return (
              <p
                key={key}
                className={
                  compact
                    ? 'mt-2 text-[14px] leading-relaxed text-ink-500 first:mt-0'
                    : 'mt-4 text-[15px] leading-[1.75] text-ink-500 first:mt-0'
                }
              >
                {renderInline(block.lines.join(' '), key)}
              </p>
            );
        }
      })}
    </div>
  );
}

export default RichText;
