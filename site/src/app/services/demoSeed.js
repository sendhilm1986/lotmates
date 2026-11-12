import { sdk } from '@/services/sdk';

const { eq } = window.ApperSDK.CoreSDK;

const DAY = 864e5;
const at = (days, hour = 20) => {
  const d = new Date(Date.now() + days * DAY);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const day = (days) => {
  const d = new Date(Date.now() + days * DAY);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const CITY = { Name: 'Chennai', state_c: 'Tamil Nadu', status_c: 'Live' };

const LOCALITIES = [
  { Name: 'Lakeview (demo)', pincode_c: '600041', status_c: 'Live' },
  { Name: 'Hillside (demo)', pincode_c: '600096', status_c: 'Live' },
  { Name: 'Riverbend (demo)', pincode_c: '600119', status_c: 'Coming soon' },
];

const COMMUNITIES = [
  { Name: 'Green Meadows Apartments (demo)', locality: 'Lakeview (demo)', type_c: 'Apartment', homes_c: 180, status_c: 'Active', ambassadorName_c: 'Kavya N.' },
  { Name: 'Hillview Enclave (demo)', locality: 'Lakeview (demo)', type_c: 'Gated', homes_c: 96, status_c: 'Active', ambassadorName_c: 'Kavya N.' },
  { Name: 'Sri Nagar Layout (demo)', locality: 'Hillside (demo)', type_c: 'Street', homes_c: 140, status_c: 'Active' },
  { Name: 'Palm Grove Residency (demo)', locality: 'Hillside (demo)', type_c: 'Apartment', homes_c: 220, status_c: 'Onboarding' },
];

const ALL_CHECKS = 'ID proof,Licence,Test job,References';

const VENDORS = [
  { Name: 'Sparkle Home Care (demo)', locality: 'Lakeview (demo)', category_c: 'Cleaning', contactName_c: 'Ramesh Babu', phone_c: '+91 90000 10001', email_c: 'hello@sparklehome.demo', status_c: 'Active', checks_c: ALL_CHECKS, rating_c: 4.6, jobsDone_c: 188, notes_c: '3-person crews, police-verified staff. Can do 6 homes a day.' },
  { Name: 'Lakeview Wellness Diagnostics (demo)', locality: 'Lakeview (demo)', category_c: 'Health', contactName_c: 'Dr. Anitha R.', phone_c: '+91 90000 10002', email_c: 'care@lakeviewwellness.demo', status_c: 'Active', checks_c: ALL_CHECKS, rating_c: 4.5, jobsDone_c: 312, notes_c: 'NABL-accredited lab. Home sample collection from 6 am.' },
  { Name: 'SunRoof Energy (demo)', locality: 'Lakeview (demo)', category_c: 'Solar', contactName_c: 'Karthik S.', phone_c: '+91 90000 10003', email_c: 'install@sunroof.demo', status_c: 'Active', checks_c: ALL_CHECKS, rating_c: 4.7, jobsDone_c: 64, notes_c: 'MNRE-empanelled installer. Handles the subsidy paperwork.' },
  { Name: 'Thangam Grinders (demo)', locality: 'Hillside (demo)', category_c: 'Products', contactName_c: 'Selvi T.', phone_c: '+91 90000 10004', email_c: 'orders@thangam.demo', status_c: 'Active', checks_c: ALL_CHECKS, rating_c: 4.5, jobsDone_c: 140, notes_c: 'Makes wet grinders locally. Doorstep delivery and old grinder exchange.' },
  { Name: 'ShieldPest Services (demo)', locality: 'Hillside (demo)', category_c: 'Pest', contactName_c: 'Arvind M.', phone_c: '+91 90000 10005', email_c: 'book@shieldpest.demo', status_c: 'Active', checks_c: ALL_CHECKS, rating_c: 4.3, jobsDone_c: 96, notes_c: 'Licensed pest control operator. Odourless gel and drill-fill treatments.' },
  { Name: 'CoolBreeze AC Care (demo)', locality: 'Hillside (demo)', category_c: 'AC', contactName_c: 'Imran K.', phone_c: '+91 90000 10006', email_c: 'service@coolbreeze.demo', status_c: 'Probation', checks_c: 'ID proof,Licence,References', rating_c: 4.4, jobsDone_c: 22, notes_c: 'New on Lotmates. First rounds capped at 60 units.' },
];

const tiers = (...pairs) => {
  const out = {};
  pairs.forEach(([max, price], i) => {
    out[`tier${i + 1}Max_c`] = max;
    out[`tier${i + 1}Price_c`] = price;
  });
  return out;
};

const DEALS = [
  {
    Name: 'Deep cleaning, 2BHK', category_c: 'Cleaning', vendor: 'Sparkle Home Care (demo)', locality: 'Lakeview (demo)', community: 'Green Meadows Apartments (demo)',
    unit_c: 'per home', regularPrice_c: 4000, ...tiers([10, 3499], [20, 3199], [30, 2899], [40, 2699]),
    minHomes_c: 10, capacity_c: 40, commission_c: 15, deadline_c: at(14), serviceStart_c: day(16), serviceEnd_c: day(36),
    status_c: 'Live', bookedHomes_c: 27, unlockedTier_c: 3, round_c: 3,
    description_c: 'Kitchen degreasing, bathrooms, fans, windows and floors.\n3-person crew, about 6 hours per home.\nEco-friendly products, safe for kids and pets.',
  },
  {
    Name: 'Full body checkup for parents', category_c: 'Health', vendor: 'Lakeview Wellness Diagnostics (demo)', locality: 'Lakeview (demo)',
    unit_c: 'per person', regularPrice_c: 3200, ...tiers([10, 2499], [25, 2199], [50, 1899]),
    minHomes_c: 10, capacity_c: 50, commission_c: 18, deadline_c: at(7), serviceStart_c: day(10), serviceEnd_c: day(28),
    status_c: 'Live', bookedHomes_c: 23, unlockedTier_c: 2, round_c: 2,
    description_c: '60+ tests including thyroid, lipid, liver, kidney and HbA1c.\nSample collection at home from 6 am.\nReport on WhatsApp in 24 hours, with a doctor call.',
  },
  {
    Name: 'Rooftop solar, 3 kW system', category_c: 'Solar', vendor: 'SunRoof Energy (demo)', locality: 'Lakeview (demo)',
    unit_c: 'per 3 kW system', regularPrice_c: 185000, ...tiers([5, 172000], [15, 166000], [25, 159000]),
    minHomes_c: 5, capacity_c: 25, commission_c: 6, deadline_c: at(21), serviceStart_c: day(28), serviceEnd_c: day(75),
    status_c: 'Live', bookedHomes_c: 7, unlockedTier_c: 2, round_c: 1,
    description_c: 'Tier-1 panels, 3 kW on-grid inverter and net meter.\nSubsidy application handled for you.\n5-year service and 25-year panel warranty.',
  },
  {
    Name: 'Wet grinder 2L tilting, factory direct', category_c: 'Products', vendor: 'Thangam Grinders (demo)', locality: 'Lakeview (demo)',
    unit_c: 'per grinder', regularPrice_c: 7500, ...tiers([15, 5900], [30, 5400], [50, 4990]),
    minHomes_c: 15, capacity_c: 50, commission_c: 12, deadline_c: at(9), serviceStart_c: day(14), serviceEnd_c: day(24),
    status_c: 'Live', bookedHomes_c: 9, unlockedTier_c: 1, round_c: 1,
    description_c: '2-litre tilting wet grinder, made locally.\n5-year motor warranty with local service.\nDoorstep delivery and old grinder exchange.',
  },
  {
    Name: 'Wet grinder 2L table-top, Hillside', category_c: 'Products', vendor: 'Thangam Grinders (demo)', locality: 'Hillside (demo)',
    unit_c: 'per grinder', regularPrice_c: 6500, ...tiers([12, 4900], [25, 4500], [40, 4200]),
    minHomes_c: 12, capacity_c: 40, commission_c: 12, deadline_c: at(11), serviceStart_c: day(16), serviceEnd_c: day(26),
    status_c: 'Live', bookedHomes_c: 14, unlockedTier_c: 2, round_c: 1,
    description_c: 'Compact table-top grinder with two stone rollers.\nAtta kneader and coconut scraper included.\nFree delivery inside the community.',
  },
  {
    Name: 'Termite treatment with 1-year cover', category_c: 'Pest', vendor: 'ShieldPest Services (demo)', locality: 'Lakeview (demo)', community: 'Hillview Enclave (demo)',
    unit_c: 'per home', regularPrice_c: 6000, ...tiers([8, 4800], [20, 4300]),
    minHomes_c: 8, capacity_c: 20, commission_c: 15, deadline_c: at(3), serviceStart_c: day(6), serviceEnd_c: day(20),
    status_c: 'Live', bookedHomes_c: 6, unlockedTier_c: 1, round_c: 1,
    description_c: 'Drill-fill-seal treatment for walls and wooden fittings.\nOdourless gel for kitchens.\nFree re-treatment for a year if termites return.',
  },
  {
    Name: 'AC service before summer', category_c: 'AC', vendor: 'CoolBreeze AC Care (demo)', locality: 'Hillside (demo)', community: 'Sri Nagar Layout (demo)',
    unit_c: 'per AC', regularPrice_c: 899, ...tiers([15, 699], [30, 599], [60, 499]),
    minHomes_c: 15, capacity_c: 60, commission_c: 18, deadline_c: at(12), serviceStart_c: day(15), serviceEnd_c: day(30),
    status_c: 'Live', bookedHomes_c: 11, unlockedTier_c: 1, round_c: 1,
    description_c: 'Jet wash of indoor and outdoor units.\nGas pressure check and drain line cleaning.\nSplit or window AC, any brand.',
  },
  {
    Name: 'Sofa shampoo cleaning', category_c: 'Cleaning', vendor: 'Sparkle Home Care (demo)', locality: 'Hillside (demo)',
    unit_c: 'per 5-seater set', regularPrice_c: 2200, ...tiers([10, 1599], [25, 1399], [40, 1199]),
    minHomes_c: 10, capacity_c: 40, commission_c: 15, deadline_c: at(18), serviceStart_c: day(20), serviceEnd_c: day(34),
    status_c: 'Live', bookedHomes_c: 4, unlockedTier_c: 1, round_c: 1,
    description_c: 'Deep shampoo and vacuum extraction for fabric sofas.\nStain treatment and deodorising.\nDries in 4 to 6 hours.',
  },
  {
    Name: 'Deepavali deep clean, Hillview Enclave', category_c: 'Cleaning', vendor: 'Sparkle Home Care (demo)', locality: 'Lakeview (demo)', community: 'Hillview Enclave (demo)',
    unit_c: 'per home', regularPrice_c: 4000, ...tiers([10, 3499], [20, 3199], [30, 2999]),
    minHomes_c: 10, capacity_c: 30, commission_c: 18, deadline_c: at(-12), serviceStart_c: day(-10), serviceEnd_c: day(5),
    status_c: 'Closed', bookedHomes_c: 18, unlockedTier_c: 2, round_c: 1,
    description_c: 'Festival deep clean before Deepavali.\nKitchen, bathrooms, fans and windows.\n3-person crew.',
  },
  {
    Name: 'Mosquito fogging before the rains', category_c: 'Pest', vendor: 'ShieldPest Services (demo)', locality: 'Hillside (demo)', community: 'Palm Grove Residency (demo)',
    unit_c: 'per home', regularPrice_c: 900, ...tiers([20, 699], [50, 599], [100, 499]),
    minHomes_c: 20, capacity_c: 100, commission_c: 15, deadline_c: at(25), serviceStart_c: day(27), serviceEnd_c: day(40),
    status_c: 'Draft', bookedHomes_c: 0, unlockedTier_c: 1, round_c: 1,
    description_c: 'Fogging of common areas, drains and gardens.\nLarvicide in water collection points.\nTwo rounds, two weeks apart.',
  },
];

async function findByName(table, name) {
  const r = await sdk.table(table).select(['Name']).where(eq('Name', name)).limit(1).fetch();
  if (!r.success) throw new Error(r.message || `Couldn't read ${table}`);
  return r.data?.[0]?.Id ?? null;
}

async function createOne(table, record) {
  const r = await sdk.table(table).create(record);
  const created = r.data?.[0];
  if (!created) throw new Error(r.messages?.[0] || r.message || `Couldn't add to ${table}`);
  return created.Id ?? created.id;
}

async function ensure(table, record, stats) {
  const existing = await findByName(table, record.Name);
  if (existing) {
    stats.skipped += 1;
    return existing;
  }
  const id = await createOne(table, record);
  stats.added += 1;
  return id;
}

export const DEMO_TOTAL = 1 + LOCALITIES.length + COMMUNITIES.length + VENDORS.length + DEALS.length;

// Adds the demo content to the live database. Safe to run twice: records that already exist
// (matched by name) are left alone.
export async function seedDemo(onProgress = () => {}) {
  const stats = { added: 0, skipped: 0 };
  let done = 0;
  const tick = (label) => {
    done += 1;
    onProgress({ done, total: DEMO_TOTAL, label });
  };

  const cityId = await ensure('cities_c', CITY, stats);
  tick(CITY.Name);

  const localityIds = {};
  for (const l of LOCALITIES) {
    localityIds[l.Name] = await ensure('localities_c', { ...l, city_c: cityId }, stats);
    tick(l.Name);
  }

  const communityIds = {};
  for (const c of COMMUNITIES) {
    const { locality, ...rest } = c;
    communityIds[c.Name] = await ensure('communities_c', { ...rest, locality_c: localityIds[locality] }, stats);
    tick(c.Name);
  }

  const vendorIds = {};
  for (const v of VENDORS) {
    const { locality, ...rest } = v;
    vendorIds[v.Name] = await ensure('vendors_c', { ...rest, locality_c: localityIds[locality] }, stats);
    tick(v.Name);
  }

  for (const d of DEALS) {
    const { vendor, locality, community, ...rest } = d;
    const record = { ...rest, vendor_c: vendorIds[vendor], locality_c: localityIds[locality] };
    if (community) record.community_c = communityIds[community];
    await ensure('deals_c', record, stats);
    tick(d.Name);
  }

  return stats;
}
