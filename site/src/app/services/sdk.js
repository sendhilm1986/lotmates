/**
 * sdk.js — the only file that talks to the backend.
 * It keeps the same shape as the Apper SDK the app was built on, but every call goes to
 * the Lotmates plugin in headless WordPress (lotmates.in/cms). The server decides what
 * each visitor may read or change; nothing here is trusted for access.
 */

const API = (import.meta.env.PUBLIC_API_BASE || '/cms') + '/wp-json/lotmates/v1';

let nonce = null;
let currentUser = null;
const listeners = new Set();

async function call(route, body, method = 'POST') {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (nonce) headers['X-WP-Nonce'] = nonce;
  const res = await fetch(API + route, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    // An expired nonce after a long idle: refresh the session once and retry.
    if (res.status === 403 && json?.code === 'rest_cookie_invalid_nonce' && !call.retrying) {
      call.retrying = true;
      try {
        await refreshSession();
        return await call(route, body, method);
      } finally {
        call.retrying = false;
      }
    }
    const err = new Error(json?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = json?.code;
    throw err;
  }
  return json;
}

async function refreshSession() {
  const s = await call('/session', undefined, 'GET');
  nonce = s?.nonce ?? null;
  currentUser = s?.user ?? null;
  return currentUser;
}

function emit() {
  const state = currentUser ? { status: 'authenticated', user: currentUser } : { status: 'anonymous' };
  listeners.forEach((fn) => {
    try {
      fn(state);
    } catch {
      /* a listener's error must not break sign-in */
    }
  });
}

const ok = (value) => ({ ok: true, value });
const fail = (e) => ({ ok: false, error: { message: e?.message || 'Something went wrong', kind: e?.code } });

// ---- Filters (same names the pages already use) ----
const f = (op) => (field, value) => ({ op, f: field, v: value });
const CoreSDK = {
  eq: f('eq'),
  ne: f('ne'),
  gt: f('gt'),
  gte: f('gte'),
  lt: f('lt'),
  lte: f('lte'),
  isIn: f('in'),
  notIn: f('notin'),
  contains: f('contains'),
  isNull: (field) => ({ op: 'isnull', f: field }),
  isNotNull: (field) => ({ op: 'notnull', f: field }),
  relativeMatch: (field, range) => ({ op: 'rel', f: field, v: range }),
  and: (...items) => ({ op: 'and', items: items.filter(Boolean) }),
  or: (...items) => ({ op: 'or', items: items.filter(Boolean) }),
};
// Pages read the helpers from window.ApperSDK.CoreSDK; keep that working.
if (typeof window !== 'undefined') window.ApperSDK = { CoreSDK };

// ---- Table queries ----
class Query {
  constructor(table) {
    this.table = table;
    this.q = { order: [] };
  }
  select(fields) {
    // Pages pass either names or {field} objects.
    this.q.fields = Array.isArray(fields) ? fields.map((x) => (typeof x === 'string' ? x : x?.field)).filter(Boolean) : fields;
    return this;
  }
  where(expr) {
    this.q.where = expr;
    return this;
  }
  orderBy(field) {
    this.q.order.push({ f: field, dir: 'asc' });
    return this;
  }
  orderByDesc(field) {
    this.q.order.push({ f: field, dir: 'desc' });
    return this;
  }
  page(n, size) {
    this.q.page = n;
    this.q.size = size;
    return this;
  }
  limit(n) {
    this.q.size = n;
    this.q.page = 1;
    return this;
  }
  async fetch() {
    try {
      return await call('/q', { table: this.table, op: 'fetch', ...this.q });
    } catch (e) {
      return { success: false, message: e.message, data: [] };
    }
  }
  async get(id) {
    try {
      return await call('/q', { table: this.table, op: 'get', id, fields: this.q.fields });
    } catch (e) {
      return { success: false, message: e.message, data: null };
    }
  }
  async create(record) {
    return write(this.table, 'create', Array.isArray(record) ? { records: record } : { record });
  }
  async update(record) {
    return write(this.table, 'update', Array.isArray(record) ? { records: record } : { record });
  }
  async remove(ids) {
    return write(this.table, 'delete', { ids: Array.isArray(ids) ? ids : [ids] });
  }
  async delete(ids) {
    return this.remove(ids);
  }
  // Chainable like the Apper SDK: .aggregate([...]).limit(1).fetch() returns { aggregators }.
  aggregate(aggregators) {
    this.q.aggregators = aggregators;
    return this;
  }
}

async function write(table, op, payload) {
  try {
    return await call('/q', { table, op, ...payload });
  } catch (e) {
    return { success: false, message: e.message, messages: [e.message], data: [] };
  }
}

// ---- Session ----
const session = {
  ui: null, // no hosted sign-in widget: the app's own forms are used
  initFailed: false,
  user: () => currentUser,
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  async retry() {
    try {
      await refreshSession();
      session.initFailed = false;
    } catch {
      session.initFailed = true;
    }
  },
  async login({ email, password }) {
    try {
      await call('/login', { email, password });
      await refreshSession();
      emit();
      return ok(currentUser);
    } catch (e) {
      return fail(e);
    }
  },
  async register({ email, password, firstName, lastName }) {
    try {
      await call('/register', { email, password, firstName, lastName });
      await refreshSession();
      emit();
      return ok(currentUser);
    } catch (e) {
      return fail(e);
    }
  },
  async logout() {
    try {
      await call('/logout', {});
    } catch {
      /* signing out locally anyway */
    }
    currentUser = null;
    nonce = null;
    emit();
  },
  async sendResetLink({ email }) {
    try {
      await call('/forgot', { email });
      return ok(true);
    } catch (e) {
      return fail(e);
    }
  },
  changePassword: ({ currentPassword, newPassword }) => account.changePassword({ currentPassword, newPassword }),
  async resetPassword({ token, newPassword }) {
    try {
      await call('/reset', { token, password: newPassword });
      return ok(true);
    } catch (e) {
      return fail(e);
    }
  },
};

// ---- Your own profile ----
async function accountCall(route, body, method = 'POST') {
  try {
    return ok(await call(route, body, method));
  } catch (e) {
    return fail(e);
  }
}
const account = {
  get: () => accountCall('/me', undefined, 'GET'),
  // A square profile photo. The server crops it and returns the updated profile.
  async uploadAvatar(file) {
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(API + '/me/avatar', { method: 'POST', body: fd, credentials: 'include', headers: nonce ? { 'X-WP-Nonce': nonce } : {} });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message || `Upload failed (${res.status})`);
      if (json?.user) {
        currentUser = json.user;
        emit();
      }
      return ok(json);
    } catch (e) {
      return fail(e);
    }
  },
  async removeAvatar() {
    const r = await accountCall('/me/avatar', undefined, 'DELETE');
    if (r.ok && r.value?.user) {
      currentUser = r.value.user;
      emit();
    }
    return r;
  },
  async update(fields) {
    const r = await accountCall('/me', fields);
    if (r.ok && r.value?.user) {
      currentUser = r.value.user;
      emit();
    }
    return r;
  },
  async changeEmail({ email, password }) {
    const r = await accountCall('/me/email', { email, password });
    if (r.ok && r.value?.user) {
      currentUser = r.value.user;
      emit();
    }
    return r;
  },
  async changePassword({ currentPassword, newPassword }) {
    const r = await accountCall('/me/password', { currentPassword, newPassword });
    // The server issued a fresh sign-in; pick up its new security token.
    if (r.ok) await refreshSession().catch(() => {});
    return r;
  },
  signOutOthers: () => accountCall('/me/signout-others', {}),
  exportData: () => accountCall('/me/export', undefined, 'GET'),
  requestDeletion: () => accountCall('/me/delete-request', {}),
  cancelDeletion: () => accountCall('/me/delete-request/cancel', {}),
};

// ---- Team: invites and roles (team only; accepting is public) ----
// Same calls the Apper SDK had. These throw on failure; the team page catches.
const teams = {
  getMembers: () => call('/team/members', undefined, 'GET'),
  getInvitedMembers: () => call('/team/invites', undefined, 'GET'),
  async inviteUsers({ invitations }) {
    const results = [];
    for (const inv of invitations ?? []) results.push(await call('/team/invites', { email: inv.email, profile: inv.profileName }));
    return results.length === 1 ? results[0] : results;
  },
  updateMemberProfile: (id, { profile }) => call(`/team/members/${encodeURIComponent(id)}`, { profile }),
  resendInvitation: (id) => call(`/team/invites/${encodeURIComponent(id)}`, {}),
  deleteMember: (id) => call(`/team/members/${encodeURIComponent(id)}`, undefined, 'DELETE'),
  deleteInvitation: (id) => call(`/team/invites/${encodeURIComponent(id)}`, undefined, 'DELETE'),
  async getInvite(token) {
    try {
      return ok(await call(`/invite?token=${encodeURIComponent(token)}`, undefined, 'GET'));
    } catch (e) {
      return fail(e);
    }
  },
  async acceptInvite({ token, firstName, lastName, password }) {
    try {
      await call('/invite/accept', { token, firstName, lastName, password });
      await refreshSession();
      emit();
      return ok(currentUser);
    } catch (e) {
      return fail(e);
    }
  },
};

// ---- Email templates (team only) ----
async function emailCall(route, body, method = 'POST') {
  try {
    return ok(await call(route, body, method));
  } catch (e) {
    return fail(e);
  }
}
const emails = {
  list: () => emailCall('/emails', undefined, 'GET'),
  save: (event, t) => emailCall(`/emails/${event}`, t),
  reset: (event) => emailCall(`/emails/${event}/reset`, {}),
  preview: (t) => emailCall('/emails-preview', t),
  test: (t) => emailCall('/emails-test', t),
  log: (event) => emailCall(`/emails-log${event ? `?event=${encodeURIComponent(event)}` : ''}`, undefined, 'GET'),
};

// ---- Invoices ----
const invoices = {
  /** Download a booking's invoice PDF (the neighbour's own, or any for the team). */
  async download(bookingId) {
    try {
      const res = await fetch(`${API}/invoice/${encodeURIComponent(bookingId)}`, { credentials: 'include', headers: nonce ? { 'X-WP-Nonce': nonce } : {} });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message || `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || 'Lotmates-invoice.pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      return ok(true);
    } catch (e) {
      return fail(e);
    }
  },
  send: (bookingId) => functions.invoke('send-invoice', { bookingId }),
  sendForDeal: (dealId, onlyMissing = false) => functions.invoke('send-deal-invoices', { dealId, onlyMissing }),
};

// ---- Photos (team only) ----
const media = {
  async upload(file, title) {
    const fd = new FormData();
    fd.append('file', file);
    if (title) fd.append('title', title);
    try {
      const res = await fetch(API + '/media', { method: 'POST', body: fd, credentials: 'include', headers: nonce ? { 'X-WP-Nonce': nonce } : {} });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message || `Upload failed (${res.status})`);
      return ok(json);
    } catch (e) {
      return fail(e);
    }
  },
};

// ---- Server functions (payments and other trusted actions) ----
const functions = {
  async invoke(name, body) {
    try {
      return ok(await call('/fn/' + encodeURIComponent(name), body ?? {}));
    } catch (e) {
      return fail(e);
    }
  },
};

// Days and time slots that still have room on a deal.
async function availability(dealId) {
  try {
    return ok(await call(`/availability/${encodeURIComponent(dealId)}`, undefined, 'GET'));
  } catch (e) {
    return fail(e);
  }
}

// The timeline on a proposal: team notes, ambassador updates, status and head-count changes.
const proposals = {
  async thread(id) {
    try {
      return ok(await call(`/proposal-thread/${encodeURIComponent(id)}`, undefined, 'GET'));
    } catch (e) {
      return fail(e);
    }
  },
  async reply(proposalId, { body, status, homes } = {}) {
    try {
      return ok(await call('/fn/proposal-reply', { proposalId, body, status, homes }));
    } catch (e) {
      return fail(e);
    }
  },
};

// Ambassador applications: anyone can apply; the team reviews, gets in touch, then decides.
const ambassadors = {
  async apply(form) {
    try {
      return ok(await call('/ambassador/apply', form));
    } catch (e) {
      return fail(e);
    }
  },
  async decide(id, action, { note, notify } = {}) {
    try {
      return ok(await call('/fn/ambassador-decide', { id, action, note, notify }));
    } catch (e) {
      return fail(e);
    }
  },
};

// Neighbour accounts, for the team.
const qs = (o) => {
  const p = new URLSearchParams();
  Object.entries(o ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== 'all') p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
};
const neighbours = {
  async list(params) {
    try {
      return ok(await call(`/neighbours${qs(params)}`, undefined, 'GET'));
    } catch (e) {
      return fail(e);
    }
  },
  async get(id) {
    try {
      return ok(await call(`/neighbours/${encodeURIComponent(id)}`, undefined, 'GET'));
    } catch (e) {
      return fail(e);
    }
  },
  async lookup(email) {
    try {
      return ok(await call(`/accounts/lookup${qs({ email })}`, undefined, 'GET'));
    } catch (e) {
      return fail(e);
    }
  },
};

// Vendor applications: any business can apply; the team checks them before approving.
const vendorApps = {
  async apply(form) {
    try {
      return ok(await call('/vendor/apply', form));
    } catch (e) {
      return fail(e);
    }
  },
  async decide(id, action, extra = {}) {
    try {
      return ok(await call('/fn/vendor-decide', { id, action, ...extra }));
    } catch (e) {
      return fail(e);
    }
  },
};

// Photos for a review: uploaded one at a time after the browser has shrunk them.
const reviewPhotos = {
  async upload(blob, name = 'photo') {
    const fd = new FormData();
    const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
    fd.append('file', blob, `${name}.${ext}`);
    try {
      const res = await fetch(API + '/review-photos', { method: 'POST', body: fd, credentials: 'include', headers: nonce ? { 'X-WP-Nonce': nonce } : {} });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message || `Upload failed (${res.status})`);
      return ok(json);
    } catch (e) {
      return fail(e);
    }
  },
  async discard(id) {
    try {
      return ok(await call(`/review-photos/${encodeURIComponent(id)}`, undefined, 'DELETE'));
    } catch (e) {
      return fail(e);
    }
  },
};

export const sdk = {
  availability,
  reviewPhotos,
  vendorApps,
  proposals,
  ambassadors,
  neighbours,
  table: (name) => new Query(name),
  session,
  functions,
  account,
  media,
  invoices,
  emails,
  teams,
};

// Resolve the session before the app renders, as the Apper SDK did.
try {
  await refreshSession();
} catch {
  session.initFailed = true;
}

export const demoAccounts = [];
