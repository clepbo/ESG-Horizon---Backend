/**
 * Deterministic pseudo-random helpers.
 *
 * The demo seed must produce identical data on every run so that screenshots,
 * recorded walkthroughs and client demos stay consistent. Math.random() would
 * break that, so everything random-looking here comes from a seeded generator.
 */

/** mulberry32 — small, fast, good enough for fixture data. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private next: () => number;

  constructor(seed = 20260921) {
    this.next = mulberry32(seed);
  }

  /** Float in [min, max). */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Float in [min, max), rounded to `dp` decimal places. */
  round(min: number, max: number, dp = 2): number {
    const factor = 10 ** dp;
    return Math.round(this.float(min, max) * factor) / factor;
  }

  /** Integer in [min, max]. */
  int(min: number, max: number): number {
    return Math.floor(this.float(min, max + 1));
  }

  /** Picks one element. */
  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  /** True with the given probability. */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /**
   * Applies +/- `spread` jitter to a value, so repeated figures across a demo
   * dataset do not look copy-pasted.
   */
  jitter(value: number, spread = 0.12): number {
    return value * (1 + this.float(-spread, spread));
  }
}

/**
 * Builds a year-on-year series that trends downward by `annualReduction`,
 * with mild noise. Used for emissions so the demo dashboards show a company
 * that is visibly improving — which is the story a sales demo wants to tell.
 */
export function decliningSeries(
  rng: Rng,
  baseline: number,
  years: number,
  annualReduction = 0.08,
): number[] {
  const out: number[] = [];
  let current = baseline;
  for (let i = 0; i < years; i += 1) {
    out.push(Math.round(rng.jitter(current, 0.04) * 100) / 100);
    current *= 1 - annualReduction;
  }
  return out;
}
