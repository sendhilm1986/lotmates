import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { sdk } from '@/services/sdk';

const { isIn, eq, and } = window.ApperSDK.CoreSDK;

// A signed-in neighbour's (or ambassador's) own active bookings, fetched once and shared by every deal card and page.
const ACTIVE = ['Booked', 'Confirmed', 'Done'];
let cache = { key: null, promise: null };
const listeners = new Set();

function load(userId) {
  if (cache.key !== userId || !cache.promise) {
    cache = {
      key: userId,
      promise: sdk
        .table('bookings_c')
        .select(['Name', 'deal_c', 'homes_c', 'unitPrice_c', 'amountPaid_c', 'refundDue_c', 'refundStatus_c', 'status_c', 'paymentStatus_c', 'CreatedOn'])
        .where(and(isIn('status_c', ACTIVE), eq('Owner', userId)))
        .orderByDesc('CreatedOn')
        .page(1, 200)
        .fetch()
        .then((r) => (r.success ? r.data : [])),
    };
  }
  return cache.promise;
}

/** Call after booking or cancelling so cards and pages pick up the change. */
export function forgetMyBookings() {
  cache = { key: null, promise: null };
  listeners.forEach((fn) => fn());
}

export function useMyBookings() {
  const user = useSelector((s) => s.user.user);
  const userId = ['Customer_c', 'Ambassador_c'].includes(user?.profile) ? user.userId : null;
  const [rows, setRows] = useState([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  useEffect(() => {
    let live = true;
    if (!userId) {
      setRows([]);
      return undefined;
    }
    load(userId).then((r) => live && setRows(r));
    return () => {
      live = false;
    };
  }, [userId, tick]);

  return rows;
}
