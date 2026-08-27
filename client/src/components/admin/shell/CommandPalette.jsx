import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { CornerDownLeft, Search } from 'lucide-react';
import cn from '@/lib/cn';
import { ADMIN_NAV } from '@shared/schemas/admin';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from './adminIcons';

/**
 * Ctrl+K / ⌘K jump-to (ERP rework §7.1).
 *
 * **Screens only, for now.** §7.1 also specifies record search — clients,
 * orders, invoices, quotes, RMAs, products, suppliers, POs — over
 * `GET /admin/search?q=`, permission-filtered server-side. That endpoint is
 * phase 12, so rather than an empty box with a spinner that never resolves,
 * this navigates the panel and says plainly that records are not searchable
 * yet. Adding a `Records` group above `Screens` is additive when the endpoint
 * lands; nothing here has to be undone.
 *
 * Recent picks persist in `localStorage`, so the second use of the palette is
 * faster than the first.
 */

const RECENTS_KEY = 'cellvix.admin.palette.recents';
const RECENTS_MAX = 5;

/** Flatten the nav tree to searchable rows, each remembering its group for context. */
function buildIndex() {
  const rows = [];

  for (const group of ADMIN_NAV) {
    if (group.to) {
      rows.push({ to: group.to, label: group.label, group: null, icon: group.icon });
      continue;
    }
    for (const child of group.children ?? []) {
      rows.push({ to: child.to, label: child.label, group: group.label, icon: child.icon });
    }
  }

  // Screens with a route but no nav row of their own — Approvals, My Profile —
  // are reachable targets too, and someone will type their name.
  for (const [path, meta] of Object.entries(ADMIN_ROUTES)) {
    if (path.includes(':')) continue;
    if (rows.some((row) => row.to.split('?')[0] === path)) continue;
    rows.push({ to: path, label: meta.title ?? meta.label, group: null, icon: meta.icon });
  }

  return rows;
}

function readRecents() {
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    // A private window or blocked site data is not an error worth surfacing.
    return [];
  }
}

function writeRecents(list) {
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, RECENTS_MAX)));
  } catch {
    /* ignore */
  }
}

/**
 * Substring first, then a *tight* subsequence so `puror` still finds
 * `Purchase Orders`.
 *
 * The density check is the important part: a plain subsequence match spreads
 * five letters across a whole sentence, which is how `roles` ends up matching
 * "Devices, brands, models & aliases". Requiring the matched letters to sit
 * inside a span of about twice the query length keeps a fuzzy match fuzzy
 * rather than meaningless.
 */
function score(label, query) {
  const haystack = label.toLowerCase();
  const needle = query.toLowerCase();
  if (!needle) return 0;

  const direct = haystack.indexOf(needle);
  if (direct === 0) return 100;
  if (direct > 0) return 70 - direct;

  // Word-initial match: `pos` finds `Purchase Orders` via its initials.
  const initials = haystack
    .split(/[^a-z0-9]+/)
    .map((word) => word[0] ?? '')
    .join('');
  if (initials.startsWith(needle)) return 60;

  let index = 0;
  let start = -1;
  for (const char of needle) {
    index = haystack.indexOf(char, index);
    if (index === -1) return -1;
    if (start === -1) start = index;
    index += 1;
  }

  const span = index - start;
  if (span > needle.length * 2 + 2) return -1;
  return 30 - (span - needle.length);
}

export function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [recents, setRecents] = useState(readRecents);

  const index = useMemo(buildIndex, []);

  const results = useMemo(() => {
    if (!query.trim()) {
      const recentRows = recents
        .map((to) => index.find((row) => row.to === to))
        .filter(Boolean)
        .map((row) => ({ ...row, recent: true }));

      // Recents first, then the rest of the panel in nav order.
      const seen = new Set(recentRows.map((row) => row.to));
      return [...recentRows, ...index.filter((row) => !seen.has(row.to))].slice(0, 12);
    }

    return index
      .map((row) => ({ row, value: Math.max(score(row.label, query), score(row.group ?? '', query) - 20) }))
      .filter((entry) => entry.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 12)
      .map((entry) => entry.row);
  }, [query, index, recents]);

  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    // Autofocus after the dialog paints, or the first keystroke is dropped.
    const id = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  if (!open) return null;

  function go(row) {
    if (!row) return;
    const next = [row.to, ...recents.filter((to) => to !== row.to)].slice(0, RECENTS_MAX);
    setRecents(next);
    writeRecents(next);
    onClose();
    navigate(row.to);
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((value) => (value + 1) % Math.max(results.length, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((value) => (value - 1 + results.length) % Math.max(results.length, 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go(results[cursor]);
    } else if (event.key === 'Escape') {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close search"
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/45"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Jump to a screen"
        className="relative w-full max-w-[540px] overflow-hidden rounded-[14px] border border-line bg-surface shadow-card"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-3.5">
          <Search className="size-4 shrink-0 text-ink-300" strokeWidth={2} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to a screen…"
            className="h-12 flex-1 bg-transparent text-[14px] text-ink-900 placeholder:text-ink-300 focus:outline-none"
          />
          <kbd className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[10.5px] text-ink-300">
            Esc
          </kbd>
        </div>

        <div className="max-h-[46vh] overflow-y-auto scroll-slim py-1.5">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-ink-400">
              No screen matches “{query}”.
            </p>
          ) : (
            results.map((row, position) => {
              const Icon = adminIcon(row.icon);
              const active = position === cursor;

              return (
                <button
                  key={row.to}
                  type="button"
                  onMouseEnter={() => setCursor(position)}
                  onClick={() => go(row)}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13.5px] transition-colors',
                    active ? 'bg-surface-2 text-ink-900' : 'text-ink-700',
                  )}
                >
                  {Icon && (
                    <Icon className="size-4 shrink-0 text-ink-400" strokeWidth={1.75} aria-hidden="true" />
                  )}
                  <span className="flex-1 truncate">
                    {row.group && <span className="text-ink-300">{row.group} · </span>}
                    {row.label}
                  </span>
                  {row.recent && !query && (
                    <span className="eyebrow shrink-0 text-ink-200">Recent</span>
                  )}
                  {active && (
                    <CornerDownLeft className="size-3.5 shrink-0 text-ink-300" strokeWidth={2} aria-hidden="true" />
                  )}
                </button>
              );
            })
          )}
        </div>

        <p className="border-t border-line bg-surface-2 px-3.5 py-2 text-[11.5px] leading-snug text-ink-400">
          Screens only for now. Searching clients, orders, invoices and products arrives in phase 12
          with the <code className="text-ink-500">/admin/search</code> endpoint.
        </p>
      </div>
    </div>
  );
}

export default CommandPalette;
