import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowRight, Headphones, Newspaper, Search, Tag } from 'lucide-react';
import { BUSINESS_INFO } from '@/lib/constants';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import BrandScene from '@/components/ui/BrandScene';
import { useFilterStore } from '@/store/filterStore';

const SHORTCUTS = [
  { label: 'Phone parts', to: '/?deviceType=smartphone' },
  { label: 'Tablet parts', to: '/?deviceType=tablet' },
  { label: 'Laptop parts', to: '/?deviceType=laptop' },
  { label: 'Console parts', to: '/?deviceType=game-console' },
];

const ELSEWHERE = [
  {
    icon: Tag,
    to: '/offers',
    title: 'Offers & combo deals',
    body: 'Bundle pricing and catalogue discounts running right now.',
  },
  {
    icon: Newspaper,
    to: '/blog',
    title: 'Bench notes',
    body: 'Grading standards, diagnostics and what changed in the catalogue.',
  },
  {
    icon: Headphones,
    to: '/contact',
    title: 'Trade desk',
    body: 'Sourcing an unlisted part, credit terms, or a warranty claim.',
  },
];

/**
 * 404 — a recovery moment, not a dead end (brief §9).
 *
 * The search field is the point of the page: someone who followed a broken link
 * is looking for a part, and a list of category shortcuts is a slower answer
 * than a text box. It writes the shared filter store as well as the URL, because
 * the shop hydrates from the URL once per mount and merges into whatever the
 * store still holds from an earlier visit.
 */
export function NotFoundPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [query, setQuery] = useState('');

  function search(event) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;

    const store = useFilterStore.getState();
    store.resetAll();
    store.setQuery(term);
    navigate(`/?q=${encodeURIComponent(term)}`);
  }

  return (
    <div className="mx-auto max-w-[1100px] px-3 py-10 sm:px-4 lg:px-6 lg:py-16">
      <div className="grid items-center gap-9 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-14">
        <div className="min-w-0">
          <p className="eyebrow mb-2 text-brand">Error 404</p>
          <h1 className="text-[30px] leading-tight sm:text-[38px]">This page came apart</h1>

          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-500">
            Nothing on {BUSINESS_INFO.domain} answers to{' '}
            <span className="font-mono text-[13.5px] text-ink-700">{pathname}</span>. The part you
            are after is almost certainly still in the catalogue — search for it by name or SKU.
          </p>

          <form onSubmit={search} className="mt-6 flex max-w-lg flex-wrap gap-2.5">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Part name, model or SKU…"
              icon={Search}
              aria-label="Search the catalogue"
              containerClassName="min-w-[220px] flex-1"
            />
            <Button type="submit" size="md" iconRight={ArrowRight}>
              Search
            </Button>
          </form>

          <div className="mt-8">
            <p className="eyebrow mb-3 text-ink-400">Popular categories</p>
            <div className="flex flex-wrap gap-2">
              {SHORTCUTS.map((shortcut) => (
                <Link
                  key={shortcut.to}
                  to={shortcut.to}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] font-medium text-ink-700 transition-colors hover:border-brand hover:text-brand"
                >
                  {shortcut.label}
                  <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <BrandScene variant="not-found" />
        </div>
      </div>

      {/* ---- somewhere else to go ------------------------------------------- */}
      <div className="mt-12 border-t border-line pt-8">
        <ul className="grid gap-3 sm:grid-cols-3">
          {ELSEWHERE.map(({ icon: Icon, to, title, body }) => (
            <li key={to}>
              <Link
                to={to}
                className="group flex h-full flex-col rounded-[14px] border border-line bg-surface p-4 transition-[border-color,box-shadow] duration-200 hover:border-line-strong hover:shadow-card"
              >
                <span className="mb-3 flex size-9 items-center justify-center rounded-[10px] bg-brand-50 text-brand-700">
                  <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="font-display text-[14px] font-bold text-ink-900 group-hover:text-brand">
                  {title}
                </span>
                <span className="mt-1 text-[12.5px] leading-relaxed text-ink-500">{body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default NotFoundPage;
