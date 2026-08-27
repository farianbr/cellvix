import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus } from 'lucide-react';
import cn from '@/lib/cn';
import useOnClickOutside from '@/hooks/useOnClickOutside';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from './adminIcons';

/**
 * The `+ Create` dropdown, shortcut `C` (ERP rework §7.2).
 *
 * **Grouped, not flat** — the screenshot settles it: money coming in on one
 * side, money going out on the other, which is how the operator already thinks
 * about which record they are about to make.
 *
 * Entries whose screen has not shipped route to the stub, which names the
 * phase. That is honest and keeps the menu whole; hiding half of it would make
 * the shortcut unlearnable and then change under the user later.
 *
 * Roles are phase 8. When they land, entries the user cannot reach are hidden
 * here **and** the underlying route still checks — a hidden menu item is not a
 * permission (§7.6).
 */

const GROUPS = [
  {
    key: 'income',
    label: 'Income',
    items: [
      { key: 'client', label: 'Client', to: '/admin/clients', icon: 'Users' },
      { key: 'order', label: 'Order', to: '/admin/orders', icon: 'Package' },
      { key: 'invoice', label: 'Invoice', to: '/admin/invoices', icon: 'FileText' },
      { key: 'quote', label: 'Quote', to: '/admin/quotes', icon: 'FileSignature' },
      { key: 'rma', label: 'RMA', to: '/admin/rma', icon: 'RotateCcw' },
    ],
  },
  {
    key: 'expense',
    label: 'Expense',
    items: [
      { key: 'supplier', label: 'Supplier', to: '/admin/suppliers', icon: 'Truck' },
      { key: 'po', label: 'Purchase Order', to: '/admin/purchase-orders', icon: 'ClipboardList' },
      { key: 'expense', label: 'Expense', to: '/admin/expenses', icon: 'Receipt' },
      { key: 'product', label: 'Product', to: '/admin/inventory', icon: 'Boxes' },
    ],
  },
];

export function CreateMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  useOnClickOutside(ref, () => setOpen(false));

  // `C` opens the menu, unless the user is typing — a shortcut that fires
  // inside a search box eats the letter.
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') return setOpen(false);
      if (event.key !== 'c' && event.key !== 'C') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target;
      const typing =
        target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (typing) return;

      event.preventDefault();
      setOpen((value) => !value);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Create (C)"
        className="hidden h-9 items-center gap-1.5 rounded-[9px] bg-brand-gradient px-3 text-[13px] font-semibold text-white transition-[filter] hover:brightness-110 sm:inline-flex"
      >
        <Plus className="size-4" strokeWidth={2.25} aria-hidden="true" />
        Create
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1.5 w-[230px] overflow-hidden rounded-[11px] border border-line bg-surface py-1.5 shadow-card"
        >
          {GROUPS.map((group, index) => (
            <div key={group.key} className={cn(index > 0 && 'mt-1 border-t border-line pt-1')}>
              <p className="eyebrow px-3 py-1.5 text-ink-300">{group.label}</p>

              {group.items.map((item) => {
                const Icon = adminIcon(item.icon);
                const phase = ADMIN_ROUTES[item.to]?.phase ?? 1;
                const pending = phase > 2;

                return (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      navigate(item.to);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-ink-700 transition-colors hover:bg-surface-2 hover:text-ink-900"
                  >
                    {Icon && (
                      <Icon className="size-3.5 shrink-0 text-ink-400" strokeWidth={1.75} aria-hidden="true" />
                    )}
                    <span className="flex-1">{item.label}</span>
                    {pending && (
                      <span className="eyebrow shrink-0 text-ink-200">P{phase}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CreateMenu;
