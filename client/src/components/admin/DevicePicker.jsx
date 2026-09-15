import { useMemo } from 'react';
import { useWatch } from 'react-hook-form';

import Input from '@/components/ui/Input';
import { useAdminDevices } from '@/hooks/useAdmin';

/**
 * Category, brand, device and model, as four linked dropdowns.
 *
 * ## Why it reads `DeviceCatalog` and not `Taxonomy`
 *
 * `Taxonomy` is the storefront's tree and every read of it counts products,
 * pruning any branch with none. A repair shop stocks parts for almost nothing it
 * repairs, so under that rule its device list would prune itself away. This
 * reads the service business's own tree, which is never pruned and never
 * counted. See `models/DeviceCatalog.js`.
 *
 * ## Why it degrades to free text
 *
 * **A shop that has not built its device list must still be able to take a
 * repair in.** A counter blocked behind "go and populate a settings screen
 * first" is a counter that writes the device on paper. So each level is a
 * `<select>` when the tree offers options at that level and a plain text box
 * when it does not, and the form value is the **name** either way - which is
 * also what `Ticket.devices` stores, so nothing downstream can tell the
 * difference.
 *
 * That is the same reason the fields are not `required`: a device somebody
 * cannot name precisely is still a device on the bench.
 *
 * ## Why the value is a name, not an id
 *
 * A ticket has to stay readable after the tree moves on - a model retired next
 * year must not blank out the record of a repair done today. Both `Ticket` and
 * `ServiceQuote` store the device as free text for exactly that reason, and
 * storing an id here would mean the picker and the record disagreed about what
 * a device is.
 */
export function DevicePicker({ control, register, setValue, index, prefix = 'devices' }) {
  const { data } = useAdminDevices({ status: 'active' });
  const tree = data?.tree ?? [];

  const base = `${prefix}.${index}`;
  const category = useWatch({ control, name: `${base}.category` });
  const brand = useWatch({ control, name: `${base}.brand` });
  const series = useWatch({ control, name: `${base}.series` });

  // Each level's options are the children of whatever is selected above it.
  const categoryNode = useMemo(
    () => tree.find((node) => node.name === category),
    [tree, category],
  );
  const brandNode = useMemo(
    () => categoryNode?.children.find((node) => node.name === brand),
    [categoryNode, brand],
  );
  const seriesNode = useMemo(
    () => brandNode?.children.find((node) => node.name === series),
    [brandNode, series],
  );

  /**
   * Clearing the levels below a change.
   *
   * Picking Apple after Samsung has to drop "Galaxy S24" - leaving it would
   * submit a device that does not exist, and it would look deliberate because
   * the box still holds a real model name.
   */
  function pick(level, value) {
    setValue(`${base}.${level}`, value, { shouldDirty: true });
    const below = { category: ['brand', 'series', 'model'], brand: ['series', 'model'], series: ['model'] }[level];
    for (const field of below ?? []) {
      setValue(`${base}.${field}`, '', { shouldDirty: true });
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Level
        label="Category"
        placeholder="Phone"
        options={tree}
        value={category}
        onPick={(value) => pick('category', value)}
        register={register(`${base}.category`)}
      />
      <Level
        label="Brand"
        placeholder="Apple"
        options={categoryNode?.children}
        value={brand}
        onPick={(value) => pick('brand', value)}
        register={register(`${base}.brand`)}
      />
      <Level
        label="Device / series"
        placeholder="iPhone 15"
        options={brandNode?.children}
        value={series}
        onPick={(value) => pick('series', value)}
        register={register(`${base}.series`)}
      />
      <Level
        label="Model"
        placeholder="iPhone 15 Pro Max"
        options={seriesNode?.children}
        register={register(`${base}.model`)}
        onPick={(value) => setValue(`${base}.model`, value, { shouldDirty: true })}
      />
    </div>
  );
}

/**
 * One level: a dropdown when the tree has options here, a text box when not.
 *
 * The text box is not a fallback nobody meant - it is how a shop with an empty
 * device list still books work in, and how an unusual device gets recorded
 * without somebody first adding it to a settings screen while a customer waits.
 */
function Level({ label, placeholder, options, value, onPick, register }) {
  const list = options ?? [];

  if (list.length === 0) {
    return <Input label={label} placeholder={placeholder} {...register} />;
  }

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-700">{label}</span>
      <select
        className="h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink-900"
        value={value ?? ''}
        onChange={(event) => onPick(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {list.map((node) => (
          <option key={node.id} value={node.name}>
            {node.name}
          </option>
        ))}
        {/*
          A value typed before the tree gained options, or one whose node has
          since been retired, is kept as its own option rather than silently
          resetting to blank - a ticket being edited must not lose its device
          because somebody tidied the settings screen afterwards.
        */}
        {value && !list.some((node) => node.name === value) && (
          <option value={value}>{value}</option>
        )}
      </select>
    </label>
  );
}

export default DevicePicker;
