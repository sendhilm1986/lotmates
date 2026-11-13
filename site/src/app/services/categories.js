import { sdk } from '@/services/sdk';
import { applyCategories, CATEGORY_VALUES, CATEGORY_META } from '@/services/dealRules';

// The team's deal categories. Loaded once on start; the admin page reloads after every change.
const EVENT = 'lotmates:categories';
let inflight = null;

const signature = () => JSON.stringify([CATEGORY_VALUES, CATEGORY_META]);

export function loadCategories(force = false) {
  if (inflight && !force) return inflight;
  inflight = sdk
    .table('categories_c')
    .select(['Name', 'key_c', 'icon_c', 'repeat_c', 'fulfilment_c', 'schedule_c', 'status_c', 'order_c'])
    .orderBy('order_c')
    .page(1, 200)
    .fetch()
    .then((r) => {
      if (!r.success || !r.data?.length) return [];
      const before = signature();
      applyCategories(r.data);
      if (before !== signature()) window.dispatchEvent(new Event(EVENT));
      return r.data;
    })
    .catch(() => []);
  return inflight;
}

export const CATEGORIES_EVENT = EVENT;
