import { useMemo, useState } from 'react';
import { iconFor } from '@/lib/icons';
import { Search } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import cn from '@/lib/cn';
import { count as formatCount } from '@/lib/format';

/**
 * The option grid a wizard step opens into (brief §5.3).
 *
 * Cards are icon + label. Device types carry a real lucide icon; the deeper
 * levels get an initial-letter monogram so the grid stays visually consistent
 * without inventing brand logos.
 */
export function WizardOverlay({ open, onClose, level, title, options, selected, onSelect }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.name.toLowerCase().includes(needle));
  }, [options, query]);

  // A long model list needs a filter; six device types do not.
  const searchable = options.length > 12;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={`${formatCount(options.length)} options`}
      size="lg"
      align="top"
      bodyClassName="pb-6"
    >
      {searchable && (
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${level === 'model' ? 'models' : level}…`}
          icon={Search}
          containerClassName="mb-4"
          data-autofocus
        />
      )}

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-[13.5px] text-ink-400">
          Nothing matches “{query}”.
        </p>
      ) : (
        <div
          className={cn(
            'grid gap-2.5',
            level === 'deviceType'
              ? 'grid-cols-2 sm:grid-cols-3'
              : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
          )}
        >
          {filtered.map((option) => {
            const isSelected = selected === option.slug;
            const Icon = option.icon ? iconFor(option.icon) : null;

            return (
              <button
                key={option.slug}
                type="button"
                onClick={() => onSelect(option)}
                aria-pressed={isSelected}
                className={cn(
                  'group flex items-center gap-3 rounded-[12px] border p-3 text-left transition-[border-color,background,box-shadow] duration-[120ms]',
                  level === 'deviceType' && 'flex-col items-center gap-2.5 py-5 text-center',
                  isSelected
                    ? 'border-brand bg-brand-50 shadow-card'
                    : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2',
                )}
              >
                <span
                  className={cn(
                    'flex shrink-0 items-center justify-center rounded-[10px] transition-colors',
                    level === 'deviceType' ? 'size-12' : 'size-9',
                    isSelected
                      ? 'bg-brand-gradient text-white'
                      : 'bg-surface-3 text-ink-500 group-hover:bg-line',
                  )}
                  aria-hidden="true"
                >
                  {Icon ? (
                    <Icon
                      className={level === 'deviceType' ? 'size-6' : 'size-4.5'}
                      strokeWidth={1.75}
                    />
                  ) : (
                    <span className="font-display text-[13px] font-bold">
                      {option.name.replace(/^(Galaxy|Apple|iPhone|iPad) /, '').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block truncate font-display text-[13.5px] font-semibold',
                      isSelected ? 'text-brand-700' : 'text-ink-900',
                    )}
                  >
                    {option.name}
                  </span>
                  <span className="tnum block text-[11.5px] text-ink-400">
                    {formatCount(option.count)} parts
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

export default WizardOverlay;
