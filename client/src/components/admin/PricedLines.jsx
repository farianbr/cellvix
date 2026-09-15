import { useFieldArray } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';

import cn from '@/lib/cn';
import { money } from '@/lib/format';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { pressable } from '@/lib/motion';

/**
 * A priced line with a catalogue picker, shared by the estimate and the
 * service invoice.
 *
 * Extracted rather than copied: the two screens bill the same work in the same
 * shape, and a second copy is how one of them quietly stops writing the
 * reference field or stops honouring an override. `emptyLine` lives here too,
 * so both pages agree on what a blank row is.
 */
const emptyLine = () => ({ name: '', description: '', priceDollars: '', qty: 1, service: '', product: '' });

/**
 * One priced line, with a picker in front of it.
 *
 * **The picker fills the line; it does not become the line.** Choosing "Screen
 * replacement" copies its name and list price into the two fields beside it and
 * then gets out of the way - the staff member raises the price for a bent frame,
 * and the line keeps the id so reporting can still group by what was sold. A
 * picker that owned the price would make the override impossible, and the
 * override is the normal case.
 *
 * **One component, two catalogues.** A service business sells labour AND parts,
 * so this fills from `Service` for one list and the shop's own `Product`
 * inventory for the other. `refField` is which reference the picked id belongs
 * in; everything else about a line is identical, which is why they share an
 * editor rather than having two that drift.
 */
function PricedLines({
  control,
  register,
  setValue,
  name,
  label,
  addLabel,
  catalogue,
  placeholder,
  emptyHint,
  // `service` or `product`: which reference field the picked id belongs in.
  refField,
}) {
  const { fields, append, remove } = useFieldArray({ control, name });

  return (
    <div className="mt-3">
      <p className="eyebrow mb-2 text-ink-400">{label}</p>

      {fields.length === 0 && <p className="mb-2 text-xs text-ink-400">{emptyHint}</p>}

      <div className="space-y-2">
        {fields.map((field, index) => (
          <div key={field.id} className="rounded-md border border-line bg-surface-2 p-2">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <select
                className="h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink-900"
                aria-label={placeholder}
                defaultValue=""
                onChange={(event) => {
                  const picked = catalogue.find((entry) => entry.id === event.target.value);
                  if (!picked) return;
                  setValue(`${name}.${index}.name`, picked.name, { shouldDirty: true });
                  setValue(`${name}.${index}.priceDollars`, picked.price ?? 0, {
                    shouldDirty: true,
                  });
                  /**
                   * The id goes in the field for its OWN kind.
                   *
                   * A service business sells two things and this editor fills
                   * both: labour from `Service`, and parts from the shop's own
                   * `Product` inventory. They are different collections, so a
                   * part's id written into `service` would point at a service
                   * that does not exist - the line would still read correctly,
                   * because it snapshots its own name and price, and every
                   * report grouping by service would silently miss it.
                   */
                  setValue(`${name}.${index}.${refField}`, picked.id, { shouldDirty: true });
                  if (picked.description) {
                    setValue(`${name}.${index}.description`, picked.description, {
                      shouldDirty: true,
                    });
                  }
                  // Reset, so picking the same entry twice in a row still fires.
                  event.target.value = '';
                }}
              >
                <option value="">{placeholder}</option>
                {catalogue.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                    {entry.price ? ` · ${money(Math.round(entry.price * 100))}` : ''}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`Remove line ${index + 1}`}
                className={cn(
                  pressable,
                  'inline-flex size-11 items-center justify-center rounded-md border border-line-strong bg-surface text-ink-400 hover:border-danger hover:text-danger',
                )}
              >
                <Trash2 className="size-4" strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_90px_90px]">
              <Input placeholder="Line name" {...register(`${name}.${index}.name`)} />
              <Input
                placeholder="Description (optional)"
                {...register(`${name}.${index}.description`)}
              />
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...register(`${name}.${index}.priceDollars`)}
              />
              <Input
                type="number"
                min="1"
                placeholder="Qty"
                {...register(`${name}.${index}.qty`)}
              />
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        icon={Plus}
        className="mt-2"
        onClick={() => append(emptyLine())}
      >
        {addLabel}
      </Button>
    </div>
  );
}

export { emptyLine, PricedLines };
export default PricedLines;
