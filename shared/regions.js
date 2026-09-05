/**
 * Subdivisions and postal rules, per country.
 *
 * **Why this exists.** The address forms hard-coded thirteen Canadian provinces
 * and one postal pattern, so every address anywhere was validated as if it were
 * in Canada: a supplier in Shenzhen could not be saved without inventing a
 * postal code shaped `A1A 1A1`, and the region select offered them Nunavut.
 *
 * ## The two things a country needs
 *
 * `regions`  The subdivisions worth offering as a select. Absent means the
 *            country has none worth listing (Singapore, Monaco) or too many to
 *            be useful, and the form falls back to a free-text field. That
 *            fallback is the honest default: a list that is wrong is worse than
 *            no list, because the operator cannot enter the true answer.
 *
 * `postal`   A regex the code must match, plus the shape to show in an error.
 *            Absent means the country has no postal system or no fixed format,
 *            and anything non-empty is accepted.
 *
 * **Only the countries Cellvix plausibly trades with carry full data.** Listing
 * every subdivision on earth would be forty thousand lines nobody verifies;
 * everything else degrades to free text, which still saves correctly. Adding a
 * country later is one entry here and no change anywhere else.
 *
 * Codes are the subdivision's own official abbreviation (ISO 3166-2 without the
 * country prefix), because that is what appears on a shipping label.
 */

const CA_PROVINCES = [
  { value: 'AB', label: 'Alberta' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland and Labrador' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'NT', label: 'Northwest Territories' },
  { value: 'NU', label: 'Nunavut' },
  { value: 'ON', label: 'Ontario' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'QC', label: 'Quebec' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'YT', label: 'Yukon' },
];

const US_STATES = [
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' }, { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' },
  { value: 'DC', label: 'District of Columbia' }, { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' }, { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' }, { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' }, { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' }, { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' }, { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' }, { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' }, { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' }, { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' }, { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' }, { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' }, { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' }, { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' }, { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' }, { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' }, { value: 'PR', label: 'Puerto Rico' },
  { value: 'RI', label: 'Rhode Island' }, { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' }, { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' },
];

const AU_STATES = [
  { value: 'ACT', label: 'Australian Capital Territory' },
  { value: 'NSW', label: 'New South Wales' },
  { value: 'NT', label: 'Northern Territory' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'SA', label: 'South Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'VIC', label: 'Victoria' },
  { value: 'WA', label: 'Western Australia' },
];

const IN_STATES = [
  { value: 'AN', label: 'Andaman and Nicobar Islands' }, { value: 'AP', label: 'Andhra Pradesh' },
  { value: 'AR', label: 'Arunachal Pradesh' }, { value: 'AS', label: 'Assam' },
  { value: 'BR', label: 'Bihar' }, { value: 'CH', label: 'Chandigarh' },
  { value: 'CT', label: 'Chhattisgarh' }, { value: 'DH', label: 'Dadra and Nagar Haveli and Daman and Diu' },
  { value: 'DL', label: 'Delhi' }, { value: 'GA', label: 'Goa' },
  { value: 'GJ', label: 'Gujarat' }, { value: 'HR', label: 'Haryana' },
  { value: 'HP', label: 'Himachal Pradesh' }, { value: 'JK', label: 'Jammu and Kashmir' },
  { value: 'JH', label: 'Jharkhand' }, { value: 'KA', label: 'Karnataka' },
  { value: 'KL', label: 'Kerala' }, { value: 'LA', label: 'Ladakh' },
  { value: 'LD', label: 'Lakshadweep' }, { value: 'MP', label: 'Madhya Pradesh' },
  { value: 'MH', label: 'Maharashtra' }, { value: 'MN', label: 'Manipur' },
  { value: 'ML', label: 'Meghalaya' }, { value: 'MZ', label: 'Mizoram' },
  { value: 'NL', label: 'Nagaland' }, { value: 'OR', label: 'Odisha' },
  { value: 'PY', label: 'Puducherry' }, { value: 'PB', label: 'Punjab' },
  { value: 'RJ', label: 'Rajasthan' }, { value: 'SK', label: 'Sikkim' },
  { value: 'TN', label: 'Tamil Nadu' }, { value: 'TG', label: 'Telangana' },
  { value: 'TR', label: 'Tripura' }, { value: 'UP', label: 'Uttar Pradesh' },
  { value: 'UT', label: 'Uttarakhand' }, { value: 'WB', label: 'West Bengal' },
];

const CN_PROVINCES = [
  { value: 'AH', label: 'Anhui' }, { value: 'BJ', label: 'Beijing' },
  { value: 'CQ', label: 'Chongqing' }, { value: 'FJ', label: 'Fujian' },
  { value: 'GS', label: 'Gansu' }, { value: 'GD', label: 'Guangdong' },
  { value: 'GX', label: 'Guangxi' }, { value: 'GZ', label: 'Guizhou' },
  { value: 'HI', label: 'Hainan' }, { value: 'HE', label: 'Hebei' },
  { value: 'HL', label: 'Heilongjiang' }, { value: 'HA', label: 'Henan' },
  { value: 'HB', label: 'Hubei' }, { value: 'HN', label: 'Hunan' },
  { value: 'JS', label: 'Jiangsu' }, { value: 'JX', label: 'Jiangxi' },
  { value: 'JL', label: 'Jilin' }, { value: 'LN', label: 'Liaoning' },
  { value: 'NM', label: 'Inner Mongolia' }, { value: 'NX', label: 'Ningxia' },
  { value: 'QH', label: 'Qinghai' }, { value: 'SN', label: 'Shaanxi' },
  { value: 'SD', label: 'Shandong' }, { value: 'SH', label: 'Shanghai' },
  { value: 'SX', label: 'Shanxi' }, { value: 'SC', label: 'Sichuan' },
  { value: 'TJ', label: 'Tianjin' }, { value: 'XZ', label: 'Tibet' },
  { value: 'XJ', label: 'Xinjiang' }, { value: 'YN', label: 'Yunnan' },
  { value: 'ZJ', label: 'Zhejiang' },
];

const GB_REGIONS = [
  { value: 'ENG', label: 'England' },
  { value: 'NIR', label: 'Northern Ireland' },
  { value: 'SCT', label: 'Scotland' },
  { value: 'WLS', label: 'Wales' },
];

/**
 * Per-country rules. A country absent from this table gets a free-text region
 * and an unvalidated postal code, which is correct behaviour rather than a gap.
 */
export const COUNTRY_RULES = {
  Canada: {
    regionLabel: 'Province',
    regions: CA_PROVINCES,
    postalLabel: 'Postal code',
    postal: { pattern: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, example: 'A1A 1A1' },
  },
  'United States': {
    regionLabel: 'State',
    regions: US_STATES,
    postalLabel: 'ZIP code',
    postal: { pattern: /^\d{5}(-\d{4})?$/, example: '90210' },
  },
  'United Kingdom': {
    regionLabel: 'Country',
    regions: GB_REGIONS,
    postalLabel: 'Postcode',
    postal: { pattern: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/, example: 'SW1A 1AA' },
  },
  Australia: {
    regionLabel: 'State',
    regions: AU_STATES,
    postalLabel: 'Postcode',
    postal: { pattern: /^\d{4}$/, example: '2000' },
  },
  India: {
    regionLabel: 'State',
    regions: IN_STATES,
    postalLabel: 'PIN code',
    postal: { pattern: /^\d{6}$/, example: '110001' },
  },
  China: {
    regionLabel: 'Province',
    regions: CN_PROVINCES,
    postalLabel: 'Postal code',
    postal: { pattern: /^\d{6}$/, example: '100000' },
  },
  Germany: {
    regionLabel: 'State',
    postalLabel: 'Postal code',
    postal: { pattern: /^\d{5}$/, example: '10115' },
  },
  France: {
    regionLabel: 'Region',
    postalLabel: 'Postal code',
    postal: { pattern: /^\d{5}$/, example: '75001' },
  },
  Japan: {
    regionLabel: 'Prefecture',
    postalLabel: 'Postal code',
    postal: { pattern: /^\d{3}-?\d{4}$/, example: '100-0001' },
  },
  Singapore: {
    regionLabel: 'Region',
    postalLabel: 'Postal code',
    postal: { pattern: /^\d{6}$/, example: '018956' },
  },
  'Hong Kong': { regionLabel: 'District' },
  'United Arab Emirates': { regionLabel: 'Emirate' },
};

/** The whole rule for a country, with sane defaults for one we do not list. */
export function rulesFor(country) {
  return (
    COUNTRY_RULES[country] ?? {
      regionLabel: 'Region / state',
      postalLabel: 'Postal code',
    }
  );
}

/** The subdivisions to offer, or `[]` when the form should use free text. */
export function regionsFor(country) {
  return rulesFor(country).regions ?? [];
}

/** What to call the subdivision field here — "Province", "State", "Prefecture". */
export function regionLabelFor(country) {
  return rulesFor(country).regionLabel ?? 'Region / state';
}

/** What to call the postal field here — "Postal code", "ZIP code", "Postcode". */
export function postalLabelFor(country) {
  return rulesFor(country).postalLabel ?? 'Postal code';
}

/**
 * Is this postal code valid for this country?
 *
 * True for a country with no rule, because "we do not know the format" and
 * "this is wrong" are different answers and only one of them should block a
 * save. An empty value is the required-field check's business, not this one.
 */
export function isValidPostal(postal, country) {
  const rule = rulesFor(country).postal;
  if (!rule) return true;
  return rule.pattern.test(String(postal ?? '').trim());
}

/** "A1A 1A1" for the error message, or null where there is no fixed shape. */
export function postalExampleFor(country) {
  return rulesFor(country).postal?.example ?? null;
}

export default COUNTRY_RULES;
