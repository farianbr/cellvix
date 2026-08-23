import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import cn from '@/lib/cn';
import { PROVINCES } from '@shared/schemas/checkout';
import { savedAddressSchema } from '@shared/schemas/account';
import Panel, { PanelEmpty } from '@/components/ui/Panel';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Checkbox from '@/components/ui/Checkbox';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { useAuth } from '@/hooks/useAuth';
import { useAccountMutations } from '@/hooks/useAccount';

function AddressForm({ address, onSubmit, onCancel, isPending }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(savedAddressSchema),
    defaultValues: {
      label: address?.label ?? '',
      contactName: address?.contactName ?? '',
      company: address?.company ?? '',
      line1: address?.line1 ?? '',
      line2: address?.line2 ?? '',
      city: address?.city ?? '',
      region: address?.region ?? 'ON',
      postal: address?.postal ?? '',
      country: 'Canada',
      phone: address?.phone ?? '',
      isDefaultShipping: address?.isDefaultShipping ?? false,
      isDefaultBilling: address?.isDefaultBilling ?? false,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Label"
        placeholder="Warehouse, Storefront…"
        error={errors.label?.message}
        data-autofocus
        {...register('label')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Contact name" error={errors.contactName?.message} {...register('contactName')} />
        <Input label="Company" {...register('company')} />
      </div>

      <Input label="Street address" error={errors.line1?.message} {...register('line1')} />
      <Input label="Unit / suite" {...register('line2')} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="City" error={errors.city?.message} {...register('city')} />
        <Select label="Province" options={PROVINCES} error={errors.region?.message} {...register('region')} />
        <Input
          label="Postal code"
          placeholder="M5V 2R7"
          error={errors.postal?.message}
          {...register('postal')}
        />
      </div>

      <Input label="Phone" type="tel" error={errors.phone?.message} {...register('phone')} />

      <div className="space-y-1 rounded-[10px] bg-surface-2 p-2">
        <Checkbox label="Default shipping address" {...register('isDefaultShipping')} />
        <Checkbox label="Default billing address" {...register('isDefaultBilling')} />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          {address ? 'Save changes' : 'Add address'}
        </Button>
      </div>
    </form>
  );
}

export function AccountAddressesPage() {
  const { user } = useAuth();
  const { addAddress, updateAddress, removeAddress } = useAccountMutations();
  const [editing, setEditing] = useState(null); // address object, or 'new'

  const addresses = user?.addresses ?? [];
  const isPending = addAddress.isPending || updateAddress.isPending;

  function handleSubmit(values) {
    const options = { onSuccess: () => setEditing(null) };
    if (editing === 'new') addAddress.mutate(values, options);
    else updateAddress.mutate({ id: editing._id, ...values }, options);
  }

  return (
    <>
      <Panel
        title="Saved addresses"
        description="Used to autofill checkout. One default for shipping, one for billing."
        action={
          <Button size="sm" icon={Plus} onClick={() => setEditing('new')}>
            Add address
          </Button>
        }
        flush={addresses.length > 0}
      >
        {addresses.length === 0 ? (
          <PanelEmpty
            icon={MapPin}
            title="No saved addresses"
            body="Add the addresses you ship to so checkout fills itself in."
            action={
              <Button variant="outline" size="sm" icon={Plus} onClick={() => setEditing('new')}>
                Add your first address
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {addresses.map((address) => (
              <li key={address._id} className="flex items-start gap-3 px-4 py-4 sm:px-5">
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg',
                    address.isDefaultShipping ? 'bg-brand-50 text-brand' : 'bg-surface-2 text-ink-400',
                  )}
                  aria-hidden="true"
                >
                  <MapPin className="size-4" strokeWidth={1.75} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-[13.5px] font-bold text-ink-900">
                      {address.label}
                    </p>
                    {address.isDefaultShipping && (
                      <Badge tone="brand" size="sm" icon={Star}>
                        Shipping
                      </Badge>
                    )}
                    {address.isDefaultBilling && (
                      <Badge tone="neutral" size="sm">
                        Billing
                      </Badge>
                    )}
                  </div>

                  <address className="mt-1 text-[12.5px] not-italic leading-relaxed text-ink-500">
                    {address.contactName && <span className="block">{address.contactName}</span>}
                    <span className="block">
                      {address.line1}
                      {address.line2 && `, ${address.line2}`}
                    </span>
                    <span className="block">
                      {address.city}, {address.region} {address.postal}
                    </span>
                    {address.phone && <span className="block">{address.phone}</span>}
                  </address>
                </div>

                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(address)}
                    aria-label={`Edit ${address.label}`}
                    className="flex size-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-surface-2 hover:text-ink-900"
                  >
                    <Pencil className="size-4" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAddress.mutate(address._id)}
                    aria-label={`Delete ${address.label}`}
                    className="flex size-8 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-danger-50 hover:text-danger"
                  >
                    <Trash2 className="size-4" strokeWidth={1.75} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add an address' : 'Edit address'}
        size="md"
        align="top"
      >
        {editing && (
          <AddressForm
            address={editing === 'new' ? null : editing}
            onSubmit={handleSubmit}
            onCancel={() => setEditing(null)}
            isPending={isPending}
          />
        )}
      </Modal>
    </>
  );
}

export default AccountAddressesPage;
