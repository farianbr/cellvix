import { useWatch } from 'react-hook-form';
import Input from '@/components/ui/Input';
import SelectField from '@/components/ui/SelectField';
import { COUNTRY_OPTIONS } from '@shared/countries';
import { regionsFor, regionLabelFor, postalLabelFor, postalExampleFor } from '@shared/regions';

/**
 * City, region, postal code and country — the part of an address that changes
 * shape depending on where it is.
 *
 * **One component because there were three**, and they had already drifted: the
 * customer form imported the shared Canadian province list, the business form
 * imported the same list, and the supplier form declared its own array of
 * thirteen two-letter codes with no labels. All three offered a country select
 * that changed nothing — so an operator could pick Germany and then be asked
 * for a Canadian province and a postal code shaped `A1A 1A1`.
 *
 * ## What "dynamic" means here
 *
 * The country is the input; everything below it follows:
 *
 *   - **The region control's TYPE.** A country with a known subdivision list
 *     gets a select; one without gets a text field. A select that cannot
 *     express the true answer is worse than a text field, because there is no
 *     way to enter what is correct.
 *   - **What the fields are CALLED.** Province in Canada, State in the US and
 *     Australia, Prefecture in Japan, Postcode rather than Postal code in the
 *     UK. The words are the local ones because that is what the address is.
 *   - **The postal PLACEHOLDER**, which is the example format for that country.
 *
 * Changing country clears the region, deliberately: `ON` means Ontario in
 * Canada and nothing in Germany, and a stale value silently saved against the
 * wrong country is the failure this component exists to prevent.
 *
 * `prefix` is the form path these fields live under (`address`, or
 * `shipping.address`), so one component serves nested shapes without the caller
 * rebuilding the field names.
 */
export function AddressFields({
  control,
  register,
  setValue,
  prefix = 'address',
  /** Rendered above the row; the caller owns the street lines. */
  children,
  className,
}) {
  const country = useWatch({ control, name: `${prefix}.country` }) || 'Canada';

  const regions = regionsFor(country);
  const regionLabel = regionLabelFor(country);
  const postalLabel = postalLabelFor(country);
  const postalExample = postalExampleFor(country);

  return (
    <div className={className}>
      {children}

      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="City" {...register(`${prefix}.city`)} />

        {regions.length > 0 ? (
          <SelectField
            control={control}
            name={`${prefix}.region`}
            label={regionLabel}
            options={regions}
          />
        ) : (
          // No list worth offering for this country, so a text field — the
          // operator knows the answer and the form should not argue with it.
          <Input label={regionLabel} {...register(`${prefix}.region`)} />
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Input
          label={postalLabel}
          placeholder={postalExample ?? undefined}
          {...register(`${prefix}.postal`)}
        />
        <SelectField
          control={control}
          name={`${prefix}.country`}
          label="Country"
          options={COUNTRY_OPTIONS}
          // A region belongs to the country it was picked in. Carrying `ON`
          // into Germany would save a subdivision that does not exist there,
          // and the select would show it as a value it has no option for.
          onValueChange={() => setValue?.(`${prefix}.region`, '')}
        />
      </div>
    </div>
  );
}

export default AddressFields;
