/**
 * The fixed lists a NOIM lodgement picks from, so a couple or celebrant
 * chooses rather than types and the Registry never meets a spelling it
 * does not know: countries, Australian states, and the plain-words
 * choices the form offers, each with the LifeLink value it maps to
 * (`lodgement.ts`). The LifeLink guide points at a "Reference Data"
 * sheet (its Country list and BrideGroomRelationship tab) that did not
 * come with it: until BDM sends it, `COUNTRIES` is the common English
 * names (with United Kingdom, which issues a UK passport, beside England,
 * Scotland and Wales, where a person is born) and `RELATIONSHIPS` the
 * relations the Marriage Act allows, both
 * to be swapped for the Registry's own wording.
 *
 * @module app/design-system/v2/pages/dashboard/bdm/reference
 */

/** Australia's states and territories, as `AddressType.State` takes them. */
export const AU_STATES = ['NSW', 'VIC', 'QLD', 'ACT', 'SA', 'WA', 'TAS', 'NT'] as const;

/** Countries, Australia first since nearly every answer is it. */
export const COUNTRIES = [
  'Australia', 'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Argentina', 'Armenia', 'Austria', 'Azerbaijan',
  'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia',
  'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada',
  'Cape Verde', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo', 'Cook Islands', 'Costa Rica',
  'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Democratic Republic of the Congo', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'East Timor',
  'Ecuador', 'Egypt', 'El Salvador', 'England', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji',
  'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala',
  'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hong Kong', 'Hungary', 'Iceland', 'India', 'Indonesia',
  'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Ivory Coast', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan',
  'Kenya', 'Kiribati', 'Kosovo', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia',
  'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Macau', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali',
  'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro',
  'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Caledonia', 'New Zealand', 'Nicaragua',
  'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Northern Ireland', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine',
  'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia',
  'Rwanda', 'Saint Lucia', 'Samoa', 'San Marino', 'Saudi Arabia', 'Scotland', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone',
  'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka',
  'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Togo',
  'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States',
  'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam', 'Wales', 'Yemen', 'Zambia', 'Zimbabwe',
];

/**
 * Before this marriage, in plain words, and BDM's `ConjugalStatusType`
 * for each. An annulled marriage was never valid in law, so it lodges as
 * Never Validly Married, with Nullity as how it ended.
 */
export const CONJUGAL = {
  'Never married': 'Never Validly Married',
  Divorced: 'Divorced',
  'Divorce not final yet': 'Married – Pending Divorce (NOIM)',
  Widowed: 'Widowed',
  'Marriage annulled': 'Never Validly Married',
} as const;
export type Conjugal = keyof typeof CONJUGAL;

/** How the last marriage ended (`MarriageTerminationType`), from the conjugal answer. */
export const TERMINATION: Partial<Record<Conjugal, 'Death' | 'Divorce' | 'Nullity'>> = {
  Divorced: 'Divorce',
  'Divorce not final yet': 'Divorce',
  Widowed: 'Death',
  'Marriage annulled': 'Nullity',
};

/** A parent, in plain words, and BDM's `LifeStatusType`. */
export const LIFE = { Living: 'Alive', Deceased: 'Deceased', Unknown: 'Unknown' } as const;

/** The ID a person shows. Each maps to a part of BDM's `IdentificationType`. */
export const ID_TYPES = ['Australian birth certificate', 'Australian passport', 'Overseas passport', 'None of these'] as const;

/** How the two are related. Placeholder for BDM's BrideGroomRelationship list. */
export const RELATIONSHIPS = ['First cousins', 'Second cousins', 'Aunt or uncle and niece or nephew', 'Related by adoption', 'Another way'] as const;

/** Who witnessed a signature on the notice, and BDM's `WitnessTitleType`. */
export const WITNESSES = {
  'Authorised celebrant': 'Authorised Marriage Celebrant',
  'Justice of the Peace': 'Justice of the Peace',
  Lawyer: 'Legal Practitioner',
  'Notary public': 'Notary Public',
  'Another authorised person': 'Other Authorised Person',
} as const;
