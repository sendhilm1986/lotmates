import { useEffect, useState } from 'react';
import { sdk } from '@/services/sdk';

// The visitor's chosen locality, shared by the homepage picker, the deals page and the header.
const KEY = 'lotmates.locality';
const EVENT = 'lotmates:locality';
let listPromise = null;

export function readLocality() {
  try {
    const v = window.localStorage.getItem(KEY);
    return v && v !== 'all' ? v : '';
  } catch {
    return '';
  }
}

export function saveLocality(id) {
  try {
    window.localStorage.setItem(KEY, id || 'all');
  } catch {
    /* not remembered, still works for this visit */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function loadLocalities() {
  if (!listPromise) {
    listPromise = sdk
      .table('localities_c')
      .select(['Name', 'status_c', 'pincode_c', 'city_c'])
      .orderBy('Name')
      .fetch()
      .then((r) => (r.success ? r.data : []))
      .catch(() => []);
  }
  return listPromise;
}

/** { id, name } of the chosen locality, or nulls when none is chosen. */
export function useLocality() {
  const [id, setId] = useState(readLocality);
  const [list, setList] = useState([]);
  useEffect(() => {
    const sync = () => setId(readLocality());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    loadLocalities().then(setList);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const found = list.find((l) => String(l.Id) === String(id));
  return { id: found ? id : null, name: found?.Name?.replace(/\s*\(demo\)$/, '') ?? null, list };
}
