import { useId } from 'react';
import { cn } from '@/lib/utils';
import { dealState, inr } from '@/services/dealRules';

// The Lotmates Rooftops meter.
// One house per price tier, sized by the saving it unlocks: the first price is the smallest house,
// the best price the biggest. Each house fills with water from the bottom up as homes book, and the
// level rises with every booking. The fill is pale green until the deal unlocks, solid green after.

const SIZES = {
  sm: { W: 160, H: 36, gap: 5, base: 36, mb: 22, roof: 9, amp: 0, flag: false },
  md: { W: 320, H: 80, gap: 14, base: 80, mb: 44, roof: 16, amp: 1.6, flag: true },
  lg: { W: 420, H: 150, gap: 20, base: 150, mb: 92, roof: 26, amp: 2.4, flag: true },
  xl: { W: 580, H: 216, gap: 28, base: 216, mb: 140, roof: 36, amp: 3.4, flag: true },
};

const FLAG = {
  md: 'px-2 py-0.5 text-[11px]',
  lg: 'px-2.5 py-1 text-xs',
  xl: 'px-3 py-1 text-sm md:text-base',
};

const TOP_ROOM = {
  sm: '',
  md: 'pt-5',
  lg: 'pt-8',
  xl: 'pt-9 md:pt-10',
};

const LABEL_TEXT = {
  sm: 'text-[11px]',
  md: 'text-xs',
  lg: 'text-sm',
  xl: 'text-sm md:text-base',
};

// One continuous outline: rounded base, straight walls, roof with a small overhang.
function housePath(x, y, w, base, roof, ov) {
  const r = Math.min(4, w * 0.06);
  return [
    `M${x + r} ${base}`,
    `H${x + w - r}`,
    `Q${x + w} ${base} ${x + w} ${base - r}`,
    `V${y}`,
    `H${x + w + ov}`,
    `L${x + w / 2} ${y - roof}`,
    `L${x - ov} ${y}`,
    `H${x}`,
    `V${base - r}`,
    `Q${x} ${base} ${x + r} ${base}`,
    'Z',
  ].join(' ');
}

// A water body whose surface sits at y = 0, with a soft repeating wave of the given wavelength.
// It is wider than the house on both sides so it can drift sideways without showing an edge.
function waterPath(x0, x1, amp, lambda, depth) {
  const parts = [`M${x0} 0`];
  let x = x0;
  let up = true;
  while (x < x1) {
    const half = lambda / 2;
    parts.push(`Q${x + half / 2} ${up ? -amp : amp} ${x + half} 0`);
    x += half;
    up = !up;
  }
  parts.push(`V${depth}`, `H${x0}`, 'Z');
  return parts.join(' ');
}

/** Column layout of the price labels under each house, for pages that draw the labels themselves. */
export function meterLabels(deal, size = 'md') {
  const o = SIZES[size] ?? SIZES.md;
  const st = dealState(deal);
  const steps = st.tiers.length ? st.tiers : [{ n: 1, from: 1, to: Math.max(1, st.scaleMax), price: null }];
  const count = steps.length;
  const ov = o.gap * 0.22;
  const slots = Math.max(count, 3);
  const w = (o.W - ov * 2 - o.gap * (slots - 1)) / slots;
  const ox = (o.W - (count * w + (count - 1) * o.gap + ov * 2)) / 2;
  return {
    steps,
    current: Math.max(0, st.reached - 1),
    style: {
      gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
      columnGap: `${(o.gap / o.W) * 100}%`,
      paddingInline: `${((ox + ov) / o.W) * 100}%`,
    },
  };
}

export default function DotMeter({ deal, size = 'md', labels, className }) {
  const uid = useId().replace(/:/g, '');
  const o = SIZES[size] ?? SIZES.md;
  const st = dealState(deal);
  const showLabels = (labels ?? (size === 'lg' || size === 'xl')) && st.tiers.length > 1;
  const steps = st.tiers.length ? st.tiers : [{ n: 1, from: 1, to: Math.max(1, st.scaleMax), price: null }];
  const count = steps.length;
  const ov = o.gap * 0.22;
  const slots = Math.max(count, 3);
  const w = (o.W - ov * 2 - o.gap * (slots - 1)) / slots;
  const ox = (o.W - (count * w + (count - 1) * o.gap + ov * 2)) / 2;
  const roof = Math.min(Math.max(o.roof, w * 0.26), o.base - o.mb);
  const booked = st.booked;
  const unlocked = st.unlocked;
  const curIdx = Math.max(0, st.reached - 1);

  const firstPrice = steps[0].price ?? 0;
  const regular = Number(deal?.regularPrice_c || 0);
  const baseline = regular > firstPrice ? regular : firstPrice;
  const saving = (p) => (p === null || p === undefined ? 0 : Math.max(0, baseline - p));
  const sMin = saving(steps[0].price);
  const sMax = saving(steps.at(-1).price);
  const bodyH = (p) => (sMax === sMin ? o.mb : o.mb * (0.5 + 0.5 * ((saving(p) - sMin) / (sMax - sMin))));

  const water = unlocked ? 'fill-primary' : 'fill-primary/50';
  const lambda = Math.max(12, w * 0.55);

  const cur = steps[curIdx];
  const curX = ox + ov + curIdx * (w + o.gap);
  const flagX = (curX + w / 2) / o.W;
  const flagY = (o.base - bodyH(cur?.price) - roof - 4) / o.H;
  const total = steps.at(-1).to;
  const curSaving = saving(st.current?.price);
  const valueText = `${booked} booked. Price now ${inr(st.current?.price)}${curSaving ? `, ${inr(curSaving)} off` : ''}.${unlocked ? '' : ` Unlocks at ${st.min}.`}`;

  return (
    <div
      role="meter"
      aria-label="Homes booked and savings unlocked"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={Math.min(booked, total)}
      aria-valuetext={valueText}
      className={cn('w-full', size === 'sm' && 'max-w-56', className)}
    >
      <div className={TOP_ROOM[size] ?? TOP_ROOM.md}>
        <div className="relative">
          <svg viewBox={`0 0 ${o.W} ${o.H}`} className="block h-auto w-full overflow-visible" aria-hidden="true">
            <defs>
              {steps.map((s, i) => {
                const x = ox + ov + i * (w + o.gap);
                return (
                  <clipPath key={s.n} id={`${uid}-h${i}`}>
                    <path d={housePath(x, o.base - bodyH(s.price), w, o.base, roof, ov)} />
                  </clipPath>
                );
              })}
            </defs>
            {steps.map((s, i) => {
              const x = ox + ov + i * (w + o.gap);
              const h = bodyH(s.price);
              const y = o.base - h;
              const full = h + roof;
              const range = Math.max(1, s.to - s.from + 1);
              const inStep = Math.min(range, Math.max(0, booked - (s.from - 1)));
              const pct = inStep / range;
              const filling = pct > 0 && pct < 1;
              const level = o.base - full * pct - (pct >= 1 ? o.amp * 2 + 2 : 0);
              return (
                <g key={s.n}>
                  {/* A house nobody has reached yet is drawn as a dashed outline: a price still to unlock. */}
                  <path
                    d={housePath(x, y, w, o.base, roof, ov)}
                    className={pct > 0 || size === 'sm' ? 'fill-primary/12' : 'fill-primary/[0.04] stroke-primary/45'}
                    strokeWidth={pct > 0 || size === 'sm' ? undefined : 1.5}
                    strokeDasharray={pct > 0 || size === 'sm' ? undefined : '6 5'}
                    vectorEffect="non-scaling-stroke"
                  />
                  {pct > 0 && (
                    <g clipPath={`url(#${uid}-h${i})`}>
                      <g
                        className="transition-transform duration-500 ease-out motion-reduce:transition-none"
                        style={{ transform: `translateY(${level}px)` }}
                      >
                        <g className={filling && o.amp > 0 ? 'lm-wave' : undefined} style={{ '--lm-wave': `${lambda}px` }}>
                          <path
                            d={waterPath(x - ov - lambda, x + w + ov + lambda, filling ? o.amp : 0, lambda, full + o.amp * 4 + 4)}
                            className={cn(water, 'transition-[fill] duration-300 motion-reduce:transition-none')}
                          />
                        </g>
                      </g>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
          {o.flag && st.tiers.length > 0 && (
            <span
              className={cn(
                'pointer-events-none absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-foreground font-semibold tabular-nums text-background transition-[left,top] duration-300 motion-reduce:transition-none',
                FLAG[size] ?? FLAG.md,
              )}
              style={{ left: `${flagX * 100}%`, top: `${flagY * 100}%` }}
              aria-hidden="true"
            >
              {curSaving > 0 ? `${inr(curSaving)} off` : inr(cur?.price)}
            </span>
          )}
        </div>
      </div>
      {showLabels && (
        <div
          className="mt-3 grid"
          style={{
            gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
            columnGap: `${(o.gap / o.W) * 100}%`,
            paddingInline: `${((ox + ov) / o.W) * 100}%`,
          }}
          aria-hidden="true"
        >
          {steps.map((s, i) => (
            <p
              key={s.n}
              className={cn(
                'min-w-0 whitespace-nowrap text-center tabular-nums',
                LABEL_TEXT[size],
                i === curIdx ? 'font-semibold text-foreground' : 'text-muted-foreground',
              )}
            >
              {inr(s.price)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
