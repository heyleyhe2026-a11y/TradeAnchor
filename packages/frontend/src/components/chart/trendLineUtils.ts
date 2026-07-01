import type { Time, UTCTimestamp } from 'lightweight-charts';

export interface ChartPoint {
  time: number;
  price: number;
}

export interface ChartStroke {
  id: string;
  points: ChartPoint[];
  color: string;
}

/** Normalize lightweight-charts Time to unix seconds. */
export function timeToUnix(time: Time): number | null {
  if (typeof time === 'number') return time;
  if (typeof time === 'string') {
    const normalized = time.includes('T') ? time : `${time}T00:00:00Z`;
    const ms = Date.parse(normalized);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  }
  if (typeof time === 'object' && time !== null && 'year' in time) {
    return Math.floor(Date.UTC(time.year, time.month - 1, time.day) / 1000);
  }
  return null;
}

export const STROKE_MIN_POINT_DIST_PX = 3;
export const STROKE_MIN_TOTAL_DIST_PX = 6;

export function syncStrokeCanvasSize(canvas: HTMLCanvasElement, container: HTMLElement): CanvasRenderingContext2D | null {
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (w <= 0 || h <= 0) return null;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function strokeTotalPixelLength(
  points: ChartPoint[],
  project: (time: number, price: number) => { x: number; y: number } | null,
): number {
  let total = 0;
  let prev: { x: number; y: number } | null = null;
  for (const pt of points) {
    const pixel = project(pt.time, pt.price);
    if (!pixel) continue;
    if (prev) total += Math.hypot(pixel.x - prev.x, pixel.y - prev.y);
    prev = pixel;
  }
  return total;
}

export function drawStrokesOnCanvas(
  ctx: CanvasRenderingContext2D,
  strokes: ChartStroke[],
  currentStroke: ChartStroke | null,
  project: (time: number, price: number) => { x: number; y: number } | null,
): void {
  const w = ctx.canvas.width / (window.devicePixelRatio || 1);
  const h = ctx.canvas.height / (window.devicePixelRatio || 1);
  ctx.clearRect(0, 0, w, h);

  const all = currentStroke ? [...strokes, currentStroke] : strokes;
  for (const stroke of all) {
    if (stroke.points.length < 2) continue;

    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    let started = false;
    for (const pt of stroke.points) {
      const pixel = project(pt.time, pt.price);
      if (!pixel) continue;
      if (!started) {
        ctx.moveTo(pixel.x, pixel.y);
        started = true;
      } else {
        ctx.lineTo(pixel.x, pixel.y);
      }
    }
    if (started) ctx.stroke();
  }
}

export function projectChartPoint(
  chart: { timeScale: () => { timeToCoordinate: (time: UTCTimestamp) => number | null } },
  series: { priceToCoordinate: (price: number) => number | null },
  time: number,
  price: number,
): { x: number; y: number } | null {
  const x = chart.timeScale().timeToCoordinate(time as UTCTimestamp);
  const y = series.priceToCoordinate(price);
  if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}
