import { useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import {
  AlertCircle,
  Pencil,
  Plus,
  Search,
  Star,
  Tag,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import cn from '@/lib/cn';
import { pressable } from '@/lib/motion';
import { money, date } from '@/lib/format';
import { GRADE_ORDER, GRADES } from '@/lib/constants';
import { DISCOUNT_TYPES, OFFER_KINDS } from '@shared/schemas/content';
import { optionsFor } from '@/lib/taxonomy';
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
import DataTable, { CountLine } from '@/components/admin/DataTable';
import Skeleton from '@/components/ui/Skeleton';
import PageHeader from '@/components/admin/PageHeader';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { adminIcon } from '@/components/admin/shell/adminIcons';
import { usePartTypes, useTaxonomy } from '@/hooks/useCatalog';
import { useAdminOffers, useAdminMutations, useAdminUsers } from '@/hooks/useAdmin';

const STATUS_FILTERS = [
  { value: 'all', label: 'All offers' },
  { value: 'live', label: 'Live now' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'expired', label: 'Expired' },
  { value: 'paused', label: 'Paused' },
];

const STATUS_TONES = {
  live: 'ok',
  scheduled: 'info',
  expired: 'neutral',
  paused: 'warn',
};

const KIND_OPTIONS = OFFER_KINDS.map((kind) => ({ value: kind.value, label: kind.label }));
const DISCOUNT_OPTIONS = DISCOUNT_TYPES.map((type) => ({ value: type.value, label: type.label }));
const GRADE_OPTIONS = GRADE_ORDER.map((grade) => ({
  value: grade,
  label: GRADES[grade]?.label ?? grade,
}));

const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');
const toDollars = (cents) => (cents ? (cents / 100).toFixed(2) : '');
const toCents = (dollars) => Math.round(Number(dollars || 0) * 100) || 0;

/**
 * Offer form.
 *
 * `kind` swaps the entire middle of the form rather than disabling half of it:
 * a combo has no discount percentage and a deal has no SKU list, so showing
 * both would invite an admin to fill in fields the server then discards.
 */
const REDEMPTION_OPTIONS = [
  { value: 'multi', label: 'Multi-use — any number of orders' },
  { value: 'single', label: 'Single-use — once per account' },
];

const ELIGIBILITY_OPTIONS = [
  { value: 'all', label: 'Open to every approved account' },
  { value: 'accounts', label: 'Only the accounts I pick' },
];

/**
 * Who may redeem an offer.
 *
 * A searchable checklist rather than a multi-select: an admin restricting an
 * offer is thinking of two or three named businesses, and a native multi-select
 * of two hundred is unusable for that. Chosen accounts stay pinned at the top so
 * the current answer is always visible, however far the search has scrolled.
 */
function AudiencePicker({ selected, onChange, error }) {
  const [query, setQuery] = useState('');
  const { data, isLoading } = useAdminUsers({ status: 'approved' });

  const accounts = data?.users ?? [];
  const chosen = accounts.filter((account) => selected.includes(account.id));
  const needle = query.trim().toLowerCase();
  const rest = accounts.filter(
    (account) =>
      !selected.includes(account.id) &&
      (!needle ||
        (account.displayName ?? account.businessName ?? '').toLowerCase().includes(needle) ||
        account.email.toLowerCase().includes(needle)),
  );

  const toggle = (id) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-ink-700">Accounts</span>
        <span className="tnum text-xs text-ink-400">{selected.length} picked</span>
      </div>

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search approved businesses…"
        icon={Search}
      />

      <div className="scroll-slim mt-2 max-h-56 overflow-y-auto rounded-md border border-line">
        {isLoading ? (
          <p className="px-3 py-6 text-center text-sm text-ink-400">Loading accounts…</p>
        ) : accounts.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-ink-400">
            No approved accounts yet.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {[...chosen, ...rest].map((account) => (
              <li key={account.id}>
                <Checkbox
                  label={`${account.displayName ?? account.businessName} · ${account.email}`}
                  checked={selected.includes(account.id)}
                  onChange={() => toggle(account.id)}
                  className="rounded-none px-3 py-2"
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}
    </div>
  );
}

function OfferForm({ offer, tree, partTypes, onSubmit, onCancel, isPending, error }) {
  const { register, handleSubmit, watch, setValue, control, formState } = useForm({
    defaultValues: {
      title: offer?.title ?? '',
      subtitle: offer?.subtitle ?? '',
      description: offer?.description ?? '',
      terms: offer?.terms ?? '',
      kind: offer?.kind ?? 'deal',
      badge: offer?.badge ?? '',
      code: offer?.code ?? '',
      discountType: offer?.discountType ?? 'percent',
      discountPercent: offer?.discountPercent ?? 10,
      discountAmountDollars: toDollars(offer?.discountAmount),
      minQty: offer?.minQty ?? 0,
      minSpendDollars: toDollars(offer?.minSpend),
      targetDeviceTypeSlug: offer?.target?.deviceTypeSlug ?? '',
      targetBrandSlug: offer?.target?.brandSlug ?? '',
      targetPartType: offer?.target?.partType ?? '',
      targetGrade: offer?.target?.grade ?? '',
      items: offer?.items?.length ? offer.items : [{ sku: '', qty: 1 }, { sku: '', qty: 1 }],
      bundlePriceDollars: toDollars(offer?.bundlePrice),
      redemption: offer?.redemption ?? 'multi',
      usageLimit: offer?.usageLimit ?? 0,
      eligibility: offer?.eligibility ?? 'all',
      allowedUsers: offer?.allowedUsers ?? [],
      startsAt: toDateInput(offer?.startsAt),
      endsAt: toDateInput(offer?.endsAt),
      isActive: offer?.isActive ?? true,
      isFeatured: offer?.isFeatured ?? false,
      order: offer?.order ?? 0,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const kind = watch('kind');
  const discountType = watch('discountType');
  const deviceType = watch('targetDeviceTypeSlug');
  const eligibility = watch('eligibility');
  const allowedUsers = watch('allowedUsers');
  const code = watch('code');

  const brands = optionsFor(tree, { deviceType, brand: null, series: null, model: null }, 'brand');

  return (
    <form
      onSubmit={handleSubmit((values) =>
        onSubmit({
          title: values.title,
          subtitle: values.subtitle,
          description: values.description,
          terms: values.terms,
          kind: values.kind,
          badge: values.badge,
          code: values.code,
          discountType: values.discountType,
          discountPercent: Number(values.discountPercent) || 0,
          discountAmount: toCents(values.discountAmountDollars),
          minQty: Number(values.minQty) || 0,
          minSpend: toCents(values.minSpendDollars),
          target: {
            deviceTypeSlug: values.targetDeviceTypeSlug,
            brandSlug: values.targetBrandSlug,
            partType: values.targetPartType,
            grade: values.targetGrade,
          },
          items: values.items
            .filter((item) => item.sku.trim())
            .map((item) => ({ sku: item.sku.trim(), qty: Number(item.qty) || 1 })),
          bundlePrice: toCents(values.bundlePriceDollars),
          redemption: values.redemption,
          usageLimit: Number(values.usageLimit) || 0,
          eligibility: values.eligibility,
          allowedUsers: values.eligibility === 'accounts' ? values.allowedUsers : [],
          startsAt: values.startsAt || null,
          endsAt: values.endsAt || null,
          isActive: values.isActive,
          isFeatured: values.isFeatured,
          order: Number(values.order) || 0,
        }),
      )}
      className="space-y-4"
    >
      {error && (
        <p className="flex items-start gap-2 rounded-md bg-danger-50 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      <SelectField control={control} name="kind" label="Offer type" options={KIND_OPTIONS} />

      <Input
        label="Title"
        placeholder="15% off every battery"
        error={formState.errors.title?.message}
        data-autofocus
        {...register('title', { required: 'Give the offer a title.' })}
      />

      <Input
        label="Subtitle"
        placeholder="Phone, tablet and laptop cells"
        {...register('subtitle')}
      />

      <Textarea label="Description" rows={3} value={watch('description')} {...register('description')} />

      {/* ---- kind-specific ------------------------------------------------- */}
      {kind === 'deal' ? (
        <fieldset className="space-y-3 rounded-md border border-line p-3.5">
          <legend className="eyebrow px-1 text-ink-400">The discount</legend>

          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              control={control}
              name="discountType"
              label="Discount"
              options={DISCOUNT_OPTIONS}
            />
            {discountType === 'percent' ? (
              <Input label="Percent off" inputMode="numeric" suffix="%" {...register('discountPercent')} />
            ) : discountType === 'amount' ? (
              <Input
                label="Amount off"
                inputMode="decimal"
                suffix="CAD"
                {...register('discountAmountDollars')}
              />
            ) : (
              <p className="self-end pb-3 text-sm text-ink-400">
                Ground shipping is waived on qualifying orders.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Input label="Promo code" placeholder="CELLS15" className="font-mono" {...register('code')} />
            <Input
              label="Minimum units"
              inputMode="numeric"
              hint="0 for none"
              {...register('minQty')}
            />
            <Input
              label="Minimum order"
              inputMode="decimal"
              suffix="CAD"
              hint="0 for none"
              {...register('minSpendDollars')}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              control={control}
              name="targetDeviceTypeSlug"
              label="Device type"
              options={[
                { value: '', label: 'Any device type' },
                ...(tree ?? []).map((node) => ({ value: node.slug, label: node.name })),
              ]}
              // A brand belongs to a device type; keeping the old one would
              // target a pairing that does not exist in the catalogue.
              onValueChange={() => setValue('targetBrandSlug', '')}
            />
            <SelectField
              control={control}
              name="targetBrandSlug"
              label="Brand"
              options={[
                { value: '', label: deviceType ? 'Any brand' : 'Pick a device type first' },
                ...brands.map((node) => ({ value: node.slug, label: node.name })),
              ]}
              disabled={!deviceType}
            />
            <SelectField
              control={control}
              name="targetPartType"
              label="Component type"
              options={[{ value: '', label: 'Any component type' }, ...partTypes]}
            />
            <SelectField
              control={control}
              name="targetGrade"
              label="Grade"
              options={[{ value: '', label: 'Any grade' }, ...GRADE_OPTIONS]}
            />
          </div>
          <p className="px-1 text-xs text-ink-300">
            Leave everything blank to apply the deal across the whole catalogue.
          </p>
        </fieldset>
      ) : (
        <fieldset className="space-y-3 rounded-md border border-line p-3.5">
          <legend className="eyebrow px-1 text-ink-400">The bundle</legend>

          <ul className="space-y-2">
            {fields.map((field, index) => (
              <li key={field.id} className="flex items-end gap-2">
                <Input
                  label={index === 0 ? 'SKU' : undefined}
                  placeholder="CVX-SAM-SA-1224"
                  className="font-mono uppercase"
                  containerClassName="flex-1"
                  {...register(`items.${index}.sku`)}
                />
                <Input
                  label={index === 0 ? 'Qty' : undefined}
                  inputMode="numeric"
                  containerClassName="w-20 shrink-0"
                  {...register(`items.${index}.qty`)}
                />
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={fields.length <= 2}
                  aria-label={`Remove line ${index + 1}`}
                  className="mb-0.5 flex size-11 shrink-0 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-400"
                >
                  <X className="size-4" strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>

          <Button
            type="button"
            size="sm"
            variant="outline"
            icon={Plus}
            onClick={() => append({ sku: '', qty: 1 })}
          >
            Add a SKU
          </Button>

          <Input
            label="Bundle price"
            inputMode="decimal"
            suffix="CAD"
            hint="What the whole bundle costs. The saving against list price is calculated for you."
            {...register('bundlePriceDollars')}
          />
          <p className="px-1 text-xs text-ink-300">
            SKUs are checked against the catalogue when you save — an unknown one is refused rather
            than published as a broken bundle.
          </p>
        </fieldset>
      )}

      {/* ---- who may redeem it ---------------------------------------------- */}
      {kind === 'deal' && (
        <fieldset className="space-y-3 rounded-md border border-line p-3.5">
          <legend className="eyebrow px-1 text-ink-400">Who can use it</legend>

          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              control={control}
              name="redemption"
              label="Redemption"
              options={REDEMPTION_OPTIONS}
              hint={code ? undefined : 'Single-use needs a promo code.'}
            />
            <Input
              label="Total redemptions"
              inputMode="numeric"
              hint="0 for unlimited. Counts every account together."
              {...register('usageLimit')}
            />
          </div>

          <SelectField
            control={control}
            name="eligibility"
            label="Availability"
            options={ELIGIBILITY_OPTIONS}
          />

          {eligibility === 'accounts' && (
            <AudiencePicker
              selected={allowedUsers}
              onChange={(next) => setValue('allowedUsers', next, { shouldDirty: true })}
            />
          )}

          <p className="px-1 text-xs text-ink-300">
            A restricted offer is invisible to everyone else — it is not listed for them, and its
            code answers “not recognised” rather than “not for you”.
          </p>
        </fieldset>
      )}

      {/* ---- presentation and window --------------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Badge" placeholder="Best value" {...register('badge')} />
        <Input label="Sort order" inputMode="numeric" {...register('order')} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Starts"
          type="date"
          hint="Blank starts immediately."
          {...register('startsAt')}
        />
        <Input label="Ends" type="date" hint="Blank runs until paused." {...register('endsAt')} />
      </div>

      <Textarea label="Terms" rows={2} value={watch('terms')} {...register('terms')} />

      <div className="space-y-1">
        <Checkbox label="Active" className="-ml-2" {...register('isActive')} />
        <Checkbox
          label="Feature at the top of the offers page"
          className="-ml-2"
          {...register('isFeatured')}
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          {offer ? 'Save changes' : 'Create offer'}
        </Button>
      </div>
    </form>
  );
}

/**
 * Header metadata read from the same table the breadcrumb uses, so a page
 * title can never drift from its crumb.
 */
const ADMIN_PAGE = { ...ADMIN_ROUTES['/admin/marketing/offers'], icon: adminIcon('Tag') };

export function AdminOffersPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState(null); // offer object, or 'new'
  const [deleting, setDeleting] = useState(null);

  const { data, isLoading } = useAdminOffers({
    status: status === 'all' ? undefined : status,
    q: query || undefined,
  });
  const { createOffer, updateOffer, deleteOffer } = useAdminMutations();
  const { data: tree } = useTaxonomy();
  const { data: partTypeFacets } = usePartTypes();

  const offers = data?.offers ?? [];

  /**
   * The columns.
   *
   * The list stacked up to six badges above every offer and then ran its
   * numbers together into one middot-separated sentence — and the sentence said
   * something DIFFERENT depending on the offer's kind. A combo read "3 SKUs ·
   * $220.00 (saves $35.90) · immediate → Sep 23"; a deal read "15% off ·
   * CELLS15 · immediate → Sep 20 · redeemed 0". Two shapes of prose in one
   * list, so nothing lined up and nothing could be compared: an operator asking
   * "which of these expires first" had to find the third or fourth clause of
   * every row and read it out of a different position each time.
   *
   * Columns fix that by construction. The "Value" column is the one place the
   * two kinds still differ, because a combo's bundle price and a deal's
   * discount genuinely are different facts — but they now sit in the same place
   * on every row, which is what makes them scannable.
   *
   * The badge stack collapses to the two that are exceptions worth flagging:
   * a combo with an unavailable SKU, which stops the offer working, and a
   * restriction, which changes who sees it. Featured, single-use and the
   * kind itself all become columns or glyphs — a badge that appears on most
   * rows is decoration.
   */
  const columns = [
    {
      key: 'title',
      header: 'Offer',
      width: '34%',
      render: (offer) => (
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate font-medium text-ink-900">{offer.title}</p>
            {offer.isFeatured && (
              <Star className="size-3.5 shrink-0 text-brand" strokeWidth={2.25} aria-label="Featured" />
            )}
          </div>
          {offer.subtitle && <p className="truncate text-xs text-ink-400">{offer.subtitle}</p>}
        </div>
      ),
    },
    {
      key: 'kind',
      header: 'Kind',
      width: '9%',
      priority: 2,
      render: (offer) => (
        <span className="text-sm text-ink-700">{offer.kind === 'combo' ? 'Combo' : 'Deal'}</span>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      width: '17%',
      sortable: false,
      render: (offer) =>
        offer.kind === 'combo' ? (
          <div className="min-w-0">
            <p className="tnum text-sm font-medium text-ink-900">{money(offer.bundlePrice)}</p>
            <p className="tnum truncate text-xs text-ink-400">
              {offer.items.length} SKU{offer.items.length === 1 ? '' : 's'}
              {offer.savings > 0 ? ` · saves ${money(offer.savings)}` : ''}
            </p>
          </div>
        ) : (
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink-900">
              {offer.discountType === 'percent'
                ? `${offer.discountPercent}% off`
                : offer.discountType === 'amount'
                  ? `${money(offer.discountAmount)} off`
                  : 'Free shipping'}
            </p>
            {offer.code && <p className="truncate font-mono text-xs text-ink-400">{offer.code}</p>}
          </div>
        ),
    },
    {
      key: 'redeemed',
      header: 'Redeemed',
      width: '10%',
      align: 'right',
      priority: 3,
      sortValue: (offer) => offer.usageCount ?? 0,
      render: (offer) =>
        offer.kind === 'deal' ? (
          <span className="tnum text-sm text-ink-700">
            {offer.usageCount}
            {offer.usageLimit > 0 && <span className="text-ink-300">/{offer.usageLimit}</span>}
          </span>
        ) : (
          <span className="text-ink-300">—</span>
        ),
    },
    {
      key: 'window',
      header: 'Runs',
      width: '16%',
      priority: 2,
      sortValue: (offer) => (offer.endsAt ? new Date(offer.endsAt).getTime() : Infinity),
      render: (offer) => (
        <div className="min-w-0">
          <p className="tnum truncate text-sm text-ink-700">
            {offer.endsAt ? `Ends ${date(offer.endsAt)}` : 'No end date'}
          </p>
          <p className="tnum truncate text-xs text-ink-400">
            From {offer.startsAt ? date(offer.startsAt) : 'immediate'}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '14%',
      render: (offer) => (
        <div className="min-w-0 space-y-1">
          <Badge tone={STATUS_TONES[offer.status] ?? 'neutral'} size="sm">
            {offer.status}
          </Badge>
          {/* Only the exceptions. An unavailable SKU stops a combo working, and
              a restriction changes who can see the offer at all — everything
              else that used to be a badge is now a column. */}
          {offer.kind === 'combo' && !offer.available && (
            <p>
              <Badge tone="warn" size="sm">
                SKU unavailable
              </Badge>
            </p>
          )}
          {offer.eligibility === 'accounts' && (
            <p>
              <Badge tone="info" size="sm" icon={Users}>
                {offer.allowedUsers.length} account{offer.allowedUsers.length === 1 ? '' : 's'}
              </Badge>
            </p>
          )}
          {offer.redemption === 'single' && (
            <p className="text-xs text-ink-400">Single-use</p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '84px',
      align: 'right',
      sortable: false,
      render: (offer) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={(event) => {
              // The row opens the editor, so a click that lands on this button
              // must not fire the row's handler behind it as well.
              event.stopPropagation();
              setEditing(offer);
            }}
            aria-label={`Edit “${offer.title}”`}
            className={cn(
            pressable,
            'flex size-8 items-center justify-center rounded-md text-ink-400 hover:bg-surface-2 hover:text-ink-900',
            )}
          >
            <Pencil className="size-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setDeleting(offer);
            }}
            aria-label={`Delete “${offer.title}”`}
            className={cn(
            pressable,
            'flex size-8 items-center justify-center rounded-md text-ink-400 hover:bg-danger-50 hover:text-danger',
            )}
          >
            <Trash2 className="size-4" strokeWidth={2} />
          </button>
        </div>
      ),
    },
  ];
  const isPending = createOffer.isPending || updateOffer.isPending;
  const error = (createOffer.error ?? updateOffer.error)?.message;

  const partTypes = useMemo(
    () => (partTypeFacets ?? []).map((facet) => ({ value: facet.value, label: facet.label })),
    [partTypeFacets],
  );

  return (
    <>
      <PageHeader
        icon={ADMIN_PAGE.icon}
        title={ADMIN_PAGE.title}
        description={ADMIN_PAGE.description}
      />

      <Panel
        title="All offers"
        description={
          data
            ? `${data.counts?.live ?? 0} live · ${data.counts?.scheduled ?? 0} scheduled · ${
                data.counts?.expired ?? 0
              } expired`
            : ''
        }
        action={
          <Button size="sm" icon={Plus} onClick={() => setEditing('new')}>
            New offer
          </Button>
        }
        flush
      >
        <div className="flex flex-wrap gap-2.5 border-b border-line p-4 sm:px-5">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Title, subtitle or code…"
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
        ) : offers.length === 0 ? (
          <PanelEmpty
            icon={Tag}
            title="No offers"
            body="Live offers appear on /offers. Scheduled ones stay hidden until their start date."
            action={
              <Button size="sm" icon={Plus} onClick={() => setEditing('new')}>
                Create the first offer
              </Button>
            }
          />
        ) : (
          <>
            <div className="border-b border-line px-3 py-2 sm:px-4">
              <CountLine total={offers.length} noun={offers.length === 1 ? 'offer' : 'offers'} />
            </div>

            <DataTable
              columns={columns}
              rows={offers}
              rowKey={(offer) => offer.id}
              onRowClick={(offer) => setEditing(offer)}
            />
          </>
        )}
      </Panel>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New offer' : 'Edit offer'}
        size="lg"
        align="top"
      >
        {editing && (
          <OfferForm
            offer={editing === 'new' ? null : editing}
            tree={tree}
            partTypes={partTypes}
            isPending={isPending}
            error={error}
            onCancel={() => setEditing(null)}
            onSubmit={(values) => {
              const options = { onSuccess: () => setEditing(null) };
              if (editing === 'new') createOffer.mutate(values, options);
              else updateOffer.mutate({ id: editing.id, ...values }, options);
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this offer?"
        body={
          deleting
            ? `“${deleting.title}” will be removed permanently. To take it off the site without losing it, uncheck Active instead.`
            : ''
        }
        loading={deleteOffer.isPending}
        error={deleteOffer.error?.message}
        onConfirm={() => deleteOffer.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </>
  );
}

export default AdminOffersPage;
