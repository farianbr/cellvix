import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Headphones, MessageCircleQuestion, Search } from 'lucide-react';
import cn from '@/lib/cn';
import { BUSINESS_INFO } from '@/lib/constants';
import Input from '@/components/ui/Input';
import Skeleton from '@/components/ui/Skeleton';
import Accordion from '@/components/ui/Accordion';
import { useFaqs } from '@/hooks/useContent';
import useDebouncedValue from '@/hooks/useDebouncedValue';

/**
 * The general FAQ.
 *
 * Centred column, oversized heading, and the questions as a stack of rounded
 * pills that open one at a time — the reading order a help page wants, with
 * nothing in the margins competing with the answer.
 *
 * Search filters on the client rather than round-tripping: the whole published
 * set is a few dozen short entries and arrives in one request, so filtering
 * locally is instant and works while the network is slow. The server-side `q`
 * parameter exists for anyone hitting the API directly.
 */
export function FaqPage() {
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 180).trim().toLowerCase();
  const reduce = useReducedMotion();

  const { data, isLoading } = useFaqs();
  const groups = data?.groups ?? [];

  const filtered = useMemo(() => {
    if (!debounced) return groups;
    return groups
      .map((group) => ({
        ...group,
        faqs: group.faqs.filter(
          (faq) =>
            faq.question.toLowerCase().includes(debounced) ||
            faq.answer.toLowerCase().includes(debounced),
        ),
      }))
      .filter((group) => group.faqs.length > 0);
  }, [groups, debounced]);

  const matchCount = filtered.reduce((total, group) => total + group.faqs.length, 0);
  const totalCount = groups.reduce((total, group) => total + group.faqs.length, 0);

  const headerMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 20, filter: 'blur(6px)' },
        animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
      };

  return (
    <div className="mx-auto max-w-[1100px] px-3 py-10 sm:px-4 lg:px-6 lg:py-16">
      {/* ---- header ------------------------------------------------------- */}
      <motion.header
        {...headerMotion}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto max-w-2xl text-center"
      >
        <p className="eyebrow inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-ink-400">
          <span className="tnum font-mono text-brand">
            {totalCount ? String(totalCount).padStart(3, '0') : '···'}
          </span>
          <span className="size-1 rounded-full bg-brand" aria-hidden="true" />
          Help centre
        </p>

        <h1 className="mt-6 text-[34px] leading-[1.04] tracking-[-0.035em] sm:text-[48px] lg:text-[56px]">
          Common questions
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-ink-400">
          Approval, pricing, credit terms, shipping and warranty — the answers the trade desk gives
          most often. If yours is not here, the desk is a phone call away.
        </p>

        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the FAQ…"
          icon={Search}
          aria-label="Search the FAQ"
          containerClassName="mx-auto mt-7 max-w-md"
        />

        {debounced && (
          <p className="mt-2.5 text-[12.5px] text-ink-400" role="status">
            {matchCount === 0
              ? 'No answer matches that.'
              : `${matchCount} ${matchCount === 1 ? 'answer' : 'answers'} match “${debounced}”.`}
          </p>
        )}
      </motion.header>

      {/* ---- section jump row --------------------------------------------- */}
      {/* Anchors, not state, so a section can be linked directly. */}
      {(debounced ? filtered : groups).length > 1 && (
        <nav aria-label="FAQ sections" className="mt-8 lg:mt-10">
          <ul className="scroll-slim -mx-3 flex justify-start gap-2 overflow-x-auto px-3 pb-1 lg:flex-wrap lg:justify-center lg:overflow-visible">
            {(debounced ? filtered : groups).map((group) => (
              <li key={group.value} className="shrink-0">
                <a
                  href={`#faq-${group.value}`}
                  className={cn(
                    'inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface px-4',
                    'text-[13px] font-medium text-ink-500 transition-colors hover:border-line-strong hover:text-brand',
                  )}
                >
                  {group.label}
                  <span className="tnum text-[11.5px] text-ink-300">{group.faqs.length}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* ---- the questions ------------------------------------------------- */}
      <div className="mx-auto mt-8 max-w-[860px] lg:mt-12">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <Skeleton key={index} className="h-[76px] rounded-[24px]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center rounded-[24px] border border-line bg-surface py-16 text-center">
            <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-surface-2 text-ink-300">
              <MessageCircleQuestion className="size-5" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <h2 className="text-[18px]">No answer for that yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-[13.5px] text-ink-500">
              Ask the trade desk directly — and the answer usually ends up on this page.
            </p>
            <Link
              to="/contact"
              className="mt-6 inline-flex h-12 items-center rounded-[12px] bg-brand-gradient px-6 font-display text-[14px] font-semibold text-white transition-[filter] hover:brightness-110"
            >
              Contact us
            </Link>
          </div>
        ) : (
          <div className="space-y-10 lg:space-y-14">
            {filtered.map((group) => (
              <section key={group.value} id={`faq-${group.value}`} className="scroll-mt-[140px]">
                <h2 className="mb-4 px-1 text-[19px] sm:text-[22px]">{group.label}</h2>
                <Accordion items={group.faqs} />
              </section>
            ))}
          </div>
        )}
      </div>

      {/* ---- still stuck ---------------------------------------------------
          The reference closes the list with a single quiet line rather than a
          panel; the phone number stays because the trade desk is the point. */}
      <section className="mx-auto mt-12 max-w-[860px] text-center lg:mt-16">
        <h2 className="text-[19px] sm:text-[22px]">Have any other questions?</h2>
        <p className="mx-auto mt-2.5 max-w-md text-[14px] leading-relaxed text-ink-400">
          The trade desk answers sourcing, credit and warranty questions directly — no ticket queue.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <Link
            to="/contact"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-brand-gradient px-6 font-display text-[14px] font-semibold text-white transition-[filter] hover:brightness-110"
          >
            Contact us
            <ArrowRight className="size-4" strokeWidth={2} aria-hidden="true" />
          </Link>
          <a
            href={`tel:${BUSINESS_INFO.phone.replace(/[^\d+]/g, '')}`}
            className="inline-flex h-12 items-center gap-2 rounded-full border border-line-strong bg-surface px-6 font-display text-[14px] font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-surface-2"
          >
            <Headphones className="size-4" strokeWidth={1.75} aria-hidden="true" />
            {BUSINESS_INFO.phone}
          </a>
        </div>
      </section>
    </div>
  );
}

export default FaqPage;
