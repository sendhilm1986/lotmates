import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { cn } from '@/lib/utils';
import ApperIcon from '@/components/ApperIcon';
import MarkLogo from '@/components/MarkLogo';

/**
 * A short guided tour for first-time visitors. Each step points at an element marked with
 * data-tour="…"; steps whose element isn't on screen (say, a desktop-only link on a phone)
 * are left out. Seen or skipped once, it doesn't come back on its own, but the footer link
 * "Take the tour" replays it.
 */

const KEY = 'lotmates.tour';
const START_EVENT = 'lotmates:tour';

export const TOURS = {
  home: [
    {
      title: 'Welcome to Lotmates',
      body: 'Neighbours book the same service together, and the price drops for everyone. Here is how it works, in five quick steps.',
      intro: true,
    },
    { target: 'locality', title: 'Pick your locality', body: "Deals are run for each area. Choose yours once and we'll show what's on near you." },
    { target: 'hero-deal', title: 'Watch the price fall', body: 'Each house is a price. As more homes book, the deal moves to the next, cheaper house.' },
    { target: 'how-it-works', title: 'Pay now, get money back', body: 'Everyone pays the first price when they book. When the deal closes, you get back the difference to the final price.' },
    { target: 'deals-link', title: 'Find a deal', body: "Browse what's open in your area and book in a few taps." },
    { target: 'join', title: 'Join when you are ready', body: 'A free neighbour account is all you need to book. No fees to join.', done: 'Got it' },
  ],
  deal: [
    {
      title: 'How this deal works',
      body: 'A quick look at the price, what you pay and how to book. Four steps.',
      intro: true,
    },
    { target: 'deal-meter', title: 'The price ladder', body: 'Each house is a price. Filled houses are reached; the dashed one is the next drop.' },
    { target: 'price-story', title: 'What you pay', body: 'You pay the first price now. When the deal closes, the refund brings it down to the final cost.' },
    { target: 'book', title: 'Book your spot', body: "Choose how many homes and a date. If the deal doesn't go ahead, every rupee comes back." },
    { target: 'share', title: 'Bring your neighbours', body: 'Every neighbour who joins lowers the price for you too. Share the deal on WhatsApp.', done: 'Got it' },
  ],
};

function readSeen() {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}
function markSeen(patch) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...readSeen(), ...patch }));
  } catch {
    /* the tour may show again; that's all */
  }
}

/** Start a tour from anywhere, e.g. the footer link. */
export function startTour(id) {
  window.dispatchEvent(new CustomEvent(START_EVENT, { detail: { id } }));
}

function findTarget(key) {
  if (!key) return null;
  for (const el of document.querySelectorAll(`[data-tour="${key}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') return el;
  }
  return null;
}

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Put this on a page: it starts the tour automatically for a first visit (signed-out people
 * only), and whenever startTour(id) is called.
 */
export function TourLauncher({ id }) {
  const user = useSelector((s) => s.user.user);
  const location = useLocation();
  const [steps, setSteps] = useState(null);

  const begin = useCallback(() => {
    // Wait for the page to finish drawing so every step can find its spot.
    let tries = 0;
    const attempt = () => {
      const all = TOURS[id] ?? [];
      const ready = all.filter((s) => s.intro || findTarget(s.target));
      if (ready.length >= Math.min(3, all.length) || tries++ > 20) {
        if (ready.length > 1) setSteps(ready);
      } else {
        setTimeout(attempt, 200);
      }
    };
    attempt();
  }, [id]);

  useEffect(() => {
    const onStart = (e) => {
      if (e.detail?.id === id) begin();
    };
    window.addEventListener(START_EVENT, onStart);
    return () => window.removeEventListener(START_EVENT, onStart);
  }, [id, begin]);

  useEffect(() => {
    const ask = new URLSearchParams(location.search).get('tour') === '1';
    if (ask) {
      const t = setTimeout(begin, 700);
      return () => clearTimeout(t);
    }
    const seen = readSeen();
    if (user || seen.skipped || seen[id]) return undefined;
    const t = setTimeout(begin, 1400);
    return () => clearTimeout(t);
  }, [id, user, begin, location.search]);

  if (!steps) return null;
  return (
    <GuidedTour
      steps={steps}
      onClose={(how) => {
        markSeen(how === 'skip' ? { skipped: true, [id]: true } : { [id]: true });
        setSteps(null);
      }}
    />
  );
}

const PAD = 10;

export default function GuidedTour({ steps, onClose }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const [card, setCard] = useState({ top: 0, left: 0, place: 'center' });
  const [entered, setEntered] = useState(false);
  const cardRef = useRef(null);
  const nextRef = useRef(null);
  const step = steps[i];
  const last = i === steps.length - 1;
  const counted = steps.filter((s) => !s.intro);
  const n = counted.indexOf(step) + 1;

  const measure = useCallback(() => {
    const el = findTarget(step.target);
    if (!el) {
      setRect(null);
      setCard({ place: 'center' });
      return;
    }
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const box = { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
    // Very tall targets (a whole section): spotlight the part on screen.
    if (box.top < 8) {
      box.height += box.top - 8;
      box.top = 8;
    }
    if (box.top + box.height > vh - 8) box.height = vh - 8 - box.top;
    setRect(box);
    const cw = Math.min(360, vw - 32);
    const ch = cardRef.current?.offsetHeight ?? 220;
    if (vw < 640) {
      setCard({ place: 'sheet' });
      return;
    }
    let place = 'below';
    let top = box.top + box.height + 14;
    if (top + ch > vh - 16) {
      place = 'above';
      top = box.top - ch - 14;
    }
    if (top < 16) {
      place = 'side';
      top = Math.max(16, Math.min(vh - ch - 16, box.top));
    }
    let left = box.left + box.width / 2 - cw / 2;
    if (place === 'side') left = box.left + box.width + 14 + cw > vw - 16 ? box.left - cw - 14 : box.left + box.width + 14;
    left = Math.max(16, Math.min(vw - cw - 16, left));
    setCard({ top, left, width: cw, place });
  }, [step]);

  // Bring the step's target into view, then measure once scrolling settles.
  useLayoutEffect(() => {
    const el = findTarget(step.target);
    if (el) {
      const r = el.getBoundingClientRect();
      const fits = r.top >= 80 && r.bottom <= window.innerHeight - 260;
      if (!fits) el.scrollIntoView({ block: r.height > window.innerHeight * 0.6 ? 'start' : 'center', behavior: reduceMotion() ? 'instant' : 'smooth' });
    }
    measure();
    const t1 = setTimeout(measure, 350);
    const t2 = setTimeout(measure, 700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [step, measure]);

  useEffect(() => {
    const on = () => measure();
    window.addEventListener('resize', on);
    window.addEventListener('scroll', on, { passive: true });
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('scroll', on);
    };
  }, [measure]);

  useEffect(() => {
    const r = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(r);
  }, []);

  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, [i]);

  const next = () => (last ? onClose('done') : setI((v) => v + 1));
  const back = () => setI((v) => Math.max(0, v - 1));

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose('skip');
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const centered = !rect || card.place === 'center';
  const sheet = card.place === 'sheet';
  const motion = 'transition-[top,left,width,height,opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none';

  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body">
      {/* Clicks outside the card do nothing, so the page can't move under the tour. */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />
      {centered ? (
        <div className={cn('absolute inset-0 bg-scrim transition-opacity duration-300', entered ? 'opacity-100' : 'opacity-0')} />
      ) : (
        <div
          aria-hidden
          className={cn('pointer-events-none absolute rounded-[20px] ring-2 ring-white/80', motion)}
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, boxShadow: '0 0 0 9999px var(--scrim)' }}
        />
      )}

      <div
        ref={cardRef}
        className={cn(
          'absolute rounded-[24px] border border-elevated-edge bg-elevated p-6 text-foreground shadow-[0_24px_60px_-12px_rgba(15,42,32,0.45)] dark:shadow-[0_24px_70px_-10px_rgba(0,0,0,0.75)]',
          motion,
          entered ? 'opacity-100' : cn('opacity-0', !centered && 'translate-y-2'),
          centered && 'left-1/2 top-1/2 w-[min(400px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2',
          sheet && !centered && 'inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+12px)]',
        )}
        style={!centered && !sheet ? { top: card.top, left: card.left, width: card.width } : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          {step.intro ? (
            <MarkLogo className="[&_svg]:h-8" />
          ) : (
            <p className="text-sm tabular-nums text-muted-foreground">
              {n} of {counted.length}
            </p>
          )}
          <button
            type="button"
            onClick={() => onClose('skip')}
            className="-mr-2 -mt-2 flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
            aria-label="Close the tour"
          >
            <ApperIcon name="X" size={18} />
          </button>
        </div>
        <h2 id="tour-title" className={cn('font-heading font-bold leading-tight text-foreground', step.intro ? 'mt-4 text-2xl' : 'mt-1 text-xl')}>
          {step.title}
        </h2>
        <p id="tour-body" className="mt-2 text-[15px] leading-6 text-muted-foreground">{step.body}</p>

        {!step.intro && (
          <div className="mt-5 flex gap-1.5" aria-hidden>
            {counted.map((s, k) => (
              <span key={k} className={cn('h-1.5 rounded-full transition-all duration-300', k + 1 === n ? 'w-6 bg-primary' : k + 1 < n ? 'w-1.5 bg-primary/50' : 'w-1.5 bg-muted-foreground/30')} />
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          {step.intro ? (
            <button type="button" onClick={() => onClose('skip')} className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Skip for now
            </button>
          ) : i > 0 && !steps[i - 1].intro ? (
            <button type="button" onClick={back} className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Back
            </button>
          ) : (
            <button type="button" onClick={() => onClose('skip')} className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Skip tour
            </button>
          )}
          <button
            ref={nextRef}
            type="button"
            onClick={next}
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {step.intro ? 'Show me' : last ? step.done ?? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
