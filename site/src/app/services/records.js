import { BOOKING_FIELDS } from '@/services/dealRules';

export const REVIEW_FIELDS = ['Name', 'booking_c', 'deal_c', 'vendor_c', 'rating_c', 'comment_c', 'Owner', 'CreatedOn', 'serviceDone_c', 'photos_c'];

/** A review's photos as a list of { id, src, thumb, w, h }. */
export function reviewPhotos(r) {
  try {
    const list = typeof r?.photos_c === 'string' ? JSON.parse(r.photos_c || '[]') : r?.photos_c;
    return Array.isArray(list) ? list.filter((p) => p?.src) : [];
  } catch {
    return [];
  }
}

export const COMPLAINT_FIELDS = [
  'Name',
  'booking_c',
  'deal_c',
  'vendor_c',
  'details_c',
  'status_c',
  'response_c',
  'resolution_c',
  'vendorUser_c',
  'photos_c',
  'Owner',
  'CreatedOn',
  'ModifiedOn',
];
export const COMPLAINT_STATUS = ['Open', 'In review', 'Resolved'];
export const COMPLAINT_STYLES = {
  Open: 'bg-destructive/10 text-destructive border-destructive/25',
  'In review': 'bg-warning-muted text-foreground border-warning-border',
  Resolved: 'bg-success/10 text-success border-success/30',
};

export const PAYOUT_FIELDS = [
  'Name',
  'vendor_c',
  'deal_c',
  'vendorUser_c',
  'gross_c',
  'commission_c',
  'net_c',
  'status_c',
  'paidOn_c',
  'reference_c',
  'CreatedOn',
];
export const PAYOUT_STATUS = ['Pending', 'Paid'];
export const PAYOUT_STYLES = {
  Pending: 'bg-warning-muted text-foreground border-warning-border',
  Paid: 'bg-success/10 text-success border-success/30',
};

export const PROPOSAL_FIELDS = [
  'Name',
  'category_c',
  'community_c',
  'homesInterested_c',
  'notes_c',
  'newCategory_c',
  'newCommunity_c',
  'newLocality_c',
  'contactPref_c',
  'contactPhone_c',
  'contactEmail_c',
  'repliedOn_c',
  'status_c',
  'adminNote_c',
  'Owner',
  'CreatedOn',
];
export const PROPOSAL_STATUS = ['New', 'Reviewing', 'Accepted', 'Declined'];
export const PROPOSAL_STYLES = {
  New: 'bg-primary/10 text-primary border-primary/25',
  Reviewing: 'bg-warning-muted text-foreground border-warning-border',
  Accepted: 'bg-success/10 text-success border-success/30',
  Declined: 'bg-muted text-muted-foreground border-border',
};

export const JOB_FIELDS = [...BOOKING_FIELDS, 'vendorUser_c', 'ambassador_c', 'jobPhotos_c', 'jobNote_c', 'doneOn_c'];

export const JOB_PHOTOS_CONFIG = {
  type: 'Files',
  label: 'Job photos',
  supportMultipleValues: true,
  supportedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'heic'],
  minValue: 1,
  maxValue: 5120,
};

export const VENDOR_PUBLIC_FIELDS = ['Name', 'category_c', 'locality_c', 'status_c', 'checks_c', 'rating_c', 'jobsDone_c', 'contactName_c'];

export const AMBASSADOR_SHARE = 0.1;

export const userIdOf = (user) => user?.userId ?? user?.Id ?? null;

export function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const newRef = (prefix) => `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;

export const toArray = (v) => (Array.isArray(v) ? v : typeof v === 'string' && v ? v.split(',') : []);

export const sameId = (a, b) => String(a ?? '') === String(b ?? '');

export function unwrapList(r) {
  if (!r.success) throw new Error(r.message);
  return r.data;
}

/** What a proposal is for, in words: a known category, or the new one the ambassador named. */
export const proposalCategory = (p, label) => (p?.category_c === 'Other' ? p?.newCategory_c || 'Something else' : label(p?.category_c));

/** Where a proposal is for: a community on Lotmates, or the one the ambassador named. */
export const proposalPlace = (p) =>
  p?.community_c?.Name ?? ([p?.newCommunity_c, p?.newLocality_c].filter(Boolean).join(', ') || 'No community');

export const APP_FIELDS = [
  'Name', 'email_c', 'phone_c', 'communityName_c', 'localityName_c', 'homes_c', 'relation_c', 'about_c',
  'contactPref_c', 'status_c', 'adminNote_c', 'user_c', 'contactedOn_c', 'decidedOn_c', 'CreatedOn', 'ModifiedOn',
];
export const APP_STATUS = ['New', 'Contacted', 'Approved', 'Declined'];
export const APP_STYLES = {
  New: 'bg-primary/10 text-primary border-primary/25',
  Contacted: 'bg-warning-muted text-foreground border-warning-border',
  Approved: 'bg-success/10 text-success border-success/30',
  Declined: 'bg-muted text-muted-foreground border-border',
};
export const APP_RELATIONS = ['Resident', 'Association member', 'Building or estate manager', 'Other'];

export const VAPP_FIELDS = [
  'Name', 'contactName_c', 'email_c', 'phone_c', 'category_c', 'newCategory_c', 'localityIds_c', 'areasOther_c', 'years_c',
  'teamSize_c', 'capacity_c', 'gstin_c', 'website_c', 'services_c', 'licences_c', 'contactPref_c', 'status_c', 'qa_c',
  'adminNote_c', 'user_c', 'vendor_c', 'contactedOn_c', 'decidedOn_c', 'CreatedOn', 'ModifiedOn',
];
export const VAPP_STATUS = ['New', 'Contacted', 'Checking', 'Approved', 'Declined'];
/** The quality checks every vendor goes through before approval. Licences can be "not needed" for some trades. */
export const VENDOR_QA = [
  { key: 'id', label: 'ID proof', hint: 'Government ID for the owner, matching the name on the application.', icon: 'IdCard' },
  { key: 'licence', label: 'Licences for the trade', hint: 'Trade licences or registrations, such as pest control or a diagnostic lab licence.', icon: 'FileBadge', optional: true },
  { key: 'references', label: 'References from past customers', hint: 'At least two customers who confirm the work and how it went.', icon: 'MessagesSquare' },
  { key: 'test', label: 'Test job', hint: 'One job done and checked by the team before any deal goes live.', icon: 'ClipboardCheck' },
  { key: 'bank', label: 'Bank account verified', hint: 'For weekly payouts, in the business or owner\'s name.', icon: 'Landmark' },
];
