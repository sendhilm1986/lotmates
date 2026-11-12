import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Where each history entry was scrolled to, so Back and Forward return to the same spot.
const positions = new Map();

/**
 * Every new page opens at the top. Exceptions:
 * - Back and Forward restore where you were.
 * - A link to a section (#how-it-works) is left to the page to scroll to.
 * - Changing filters on the same page (only the ?query changes) keeps your place.
 */
export default function ScrollManager() {
  const location = useLocation();
  const type = useNavigationType();
  const prev = useRef(location);

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  }, []);

  useEffect(() => {
    const key = location.key;
    const save = () => positions.set(key, window.scrollY);
    window.addEventListener('scroll', save, { passive: true });
    return () => window.removeEventListener('scroll', save);
  }, [location.key]);

  useLayoutEffect(() => {
    const before = prev.current;
    prev.current = location;
    if (before.key === location.key) return;

    if (type === 'POP') {
      const y = positions.get(location.key);
      if (y == null) return;
      // Content often loads a moment later; keep trying until the page is tall enough.
      let tries = 0;
      const restore = () => {
        window.scrollTo(0, y);
        if (Math.abs(window.scrollY - y) > 2 && tries++ < 40) requestAnimationFrame(restore);
      };
      restore();
      return;
    }

    if (location.hash) return;
    if (before.pathname !== location.pathname) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location, type]);

  return null;
}
