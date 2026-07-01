import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Autocomplete,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import BrushIcon from '@mui/icons-material/Brush';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type MouseEventParams,
} from 'lightweight-charts';
import { SMA, EMA, RSI, MACD, BollingerBands } from 'technicalindicators';
import {
  CHART_INTERVALS,
  useGetMarketCandlesQuery,
  useGetMarketSymbolsQuery,
  useGetMarketQuoteQuery,
  useLazySearchMarketSymbolsQuery,
  type CandleBar,
  type ChartInterval,
  type IndicatorId,
  type SymbolSearchHit,
  type MarketQuoteResponse,
} from '../store/marketApi';
import {
  drawStrokesOnCanvas,
  projectChartPoint,
  STROKE_MIN_POINT_DIST_PX,
  STROKE_MIN_TOTAL_DIST_PX,
  syncStrokeCanvasSize,
  strokeTotalPixelLength,
  timeToUnix,
  type ChartPoint,
  type ChartStroke,
} from './chart/trendLineUtils';

const INDICATOR_OPTIONS: IndicatorId[] = ['sma20', 'ema20', 'bb20', 'rsi14', 'macd'];
const DEFAULT_SYMBOL = 'XAUUSD';
const TREND_LINE_COLORS = ['#fcd34d', '#00d4aa', '#38bdf8', '#f472b6', '#fb923c', '#ffffff'] as const;

/** Vivid, color-coded UI palette for the chart panel (not flat white/gray). */
const CHART_COLORS = {
  title: '#ecfdf5',
  accent: '#00d4aa',
  meta: '#67e8f9',
  label: '#a5f3fc',
  input: '#f1f5f9',
  hint: '#93c5fd',
  dropdownSymbol: '#fef08a',
  dropdownMeta: '#a5b4fc',
  sectionLabel: '#c4b5fd',
  intervalIdle: '#bae6fd',
  intervalActiveText: '#022c22',
  tradeChipIdle: '#fde68a',
  indicatorIdle: '#c4b5fd',
  indicatorActive: '#f0abfc',
  ohlcTime: '#7dd3fc',
  ohlcOpen: '#fcd34d',
  ohlcHigh: '#34d399',
  ohlcLow: '#fb7185',
  chartAxis: '#cbd5e1',
  macdTitle: '#a78bfa',
  bid: '#34d399',
  ask: '#fb7185',
} as const;

type CrosshairDisplayMode = 'ohlc' | 'simple';

function buildCrosshairOptions(mode: CrosshairDisplayMode) {
  if (mode === 'ohlc') {
    return {
      mode: CrosshairMode.Magnet,
      vertLine: {
        visible: true,
        width: 1 as const,
        color: 'rgba(103,232,249,0.55)',
        labelVisible: false,
      },
      horzLine: {
        visible: true,
        width: 1 as const,
        color: 'rgba(103,232,249,0.55)',
        labelVisible: false,
      },
    };
  }
  return {
    mode: CrosshairMode.Normal,
    vertLine: {
      visible: true,
      width: 1 as const,
      color: 'rgba(148,163,184,0.7)',
      labelVisible: false,
    },
    horzLine: {
      visible: true,
      width: 1 as const,
      color: 'rgba(148,163,184,0.7)',
      labelVisible: true,
    },
  };
}

interface OhlcSnapshot {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface CrosshairHud {
  x: number;
  y: number;
  ohlc: OhlcSnapshot;
}

/** Match chart date/time labels to app UI language, not browser default. */
function chartLocaleForLanguage(language: string): string {
  return language.startsWith('zh') ? 'zh-CN' : 'en-US';
}

function chartLocalizationOptions(language: string) {
  const locale = chartLocaleForLanguage(language);
  return { localization: { locale } };
}

function formatChartPrice(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) return value.toFixed(2);
  if (abs >= 10) return value.toFixed(2);
  if (abs >= 1) return value.toFixed(4);
  return value.toFixed(5);
}

function formatChartTime(timeSec: number, locale: string): string {
  const localeTag = chartLocaleForLanguage(locale);
  return new Intl.DateTimeFormat(localeTag, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timeSec * 1000));
}

interface SymbolChartPanelProps {
  /** Pre-select symbol from dashboard filter when available */
  preferredSymbol?: string;
}

function alignSeries<T>(values: T[], total: number): (T | null)[] {
  const pad = total - values.length;
  return [...Array(Math.max(0, pad)).fill(null), ...values];
}

function buildIndicatorSeries(
  candles: CandleBar[],
  indicator: IndicatorId,
): {
  lines?: Array<{ data: { time: UTCTimestamp; value: number }[]; color: string }>;
  histogram?: { data: { time: UTCTimestamp; value: number; color?: string }[] };
} {
  const closes = candles.map((c) => c.close);
  const times = candles.map((c) => c.time as UTCTimestamp);

  if (indicator === 'sma20') {
    const values = SMA.calculate({ period: 20, values: closes });
    const aligned = alignSeries(values, candles.length);
    return {
      lines: [{
        color: '#fbbf24',
        data: aligned
          .map((v, i) => (v == null ? null : { time: times[i], value: v }))
          .filter(Boolean) as { time: UTCTimestamp; value: number }[],
      }],
    };
  }

  if (indicator === 'ema20') {
    const values = EMA.calculate({ period: 20, values: closes });
    const aligned = alignSeries(values, candles.length);
    return {
      lines: [{
        color: '#38bdf8',
        data: aligned
          .map((v, i) => (v == null ? null : { time: times[i], value: v }))
          .filter(Boolean) as { time: UTCTimestamp; value: number }[],
      }],
    };
  }

  if (indicator === 'bb20') {
    const bb = BollingerBands.calculate({ period: 20, stdDev: 2, values: closes });
    const aligned = alignSeries(bb, candles.length);
    const upper: { time: UTCTimestamp; value: number }[] = [];
    const middle: { time: UTCTimestamp; value: number }[] = [];
    const lower: { time: UTCTimestamp; value: number }[] = [];
    aligned.forEach((band, i) => {
      if (!band) return;
      upper.push({ time: times[i], value: band.upper });
      middle.push({ time: times[i], value: band.middle });
      lower.push({ time: times[i], value: band.lower });
    });
    return {
      lines: [
        { color: 'rgba(167,139,250,0.9)', data: upper },
        { color: 'rgba(167,139,250,0.55)', data: middle },
        { color: 'rgba(167,139,250,0.9)', data: lower },
      ],
    };
  }

  if (indicator === 'rsi14') {
    const values = RSI.calculate({ period: 14, values: closes });
    const aligned = alignSeries(values, candles.length);
    return {
      lines: [{
        color: '#f472b6',
        data: aligned
          .map((v, i) => (v == null ? null : { time: times[i], value: v }))
          .filter(Boolean) as { time: UTCTimestamp; value: number }[],
      }],
    };
  }

  const macd = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const aligned = alignSeries(macd, candles.length);
  const macdLine: { time: UTCTimestamp; value: number }[] = [];
  const signalLine: { time: UTCTimestamp; value: number }[] = [];
  const hist: { time: UTCTimestamp; value: number; color?: string }[] = [];
  aligned.forEach((row, i) => {
    if (!row || row.MACD == null || row.signal == null || row.histogram == null) return;
    macdLine.push({ time: times[i], value: row.MACD });
    signalLine.push({ time: times[i], value: row.signal });
    hist.push({
      time: times[i],
      value: row.histogram,
      color: row.histogram >= 0 ? 'rgba(0,212,170,0.5)' : 'rgba(244,63,94,0.5)',
    });
  });
  return {
    lines: [
      { color: '#a78bfa', data: macdLine },
      { color: '#fb923c', data: signalLine },
    ],
    histogram: { data: hist },
  };
}

function LiveQuoteBar({
  quote,
  t,
}: {
  quote: MarketQuoteResponse | undefined;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const prevRef = useRef<{ bid: number; ask: number } | null>(null);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (!quote) return;
    const prev = prevRef.current;
    if (prev) {
      if (quote.mid > (prev.bid + prev.ask) / 2) setFlash('up');
      else if (quote.mid < (prev.bid + prev.ask) / 2) setFlash('down');
      const timer = window.setTimeout(() => setFlash(null), 600);
      prevRef.current = { bid: quote.bid, ask: quote.ask };
      return () => window.clearTimeout(timer);
    }
    prevRef.current = { bid: quote.bid, ask: quote.ask };
    return undefined;
  }, [quote?.bid, quote?.ask, quote?.mid]);

  if (!quote) return null;

  const flashBg = flash === 'up'
    ? 'rgba(52,211,153,0.18)'
    : flash === 'down'
      ? 'rgba(251,113,133,0.18)'
      : 'rgba(15,23,42,0.75)';

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 0.35,
      px: 1.25,
      py: 1,
      borderRadius: 1,
      bgcolor: flashBg,
      border: '1px solid rgba(255,255,255,0.1)',
      transition: 'background-color 0.35s ease',
      minWidth: 118,
      flexShrink: 0,
    }}>
      <Typography sx={{ color: CHART_COLORS.meta, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.08em' }}>
        {t('dashboard.chart.liveQuote', 'Live')}
      </Typography>
      <Box sx={{ textAlign: 'right' }}>
        <Typography sx={{ color: CHART_COLORS.hint, fontSize: '0.72rem', fontWeight: 600, lineHeight: 1.2 }}>
          {t('dashboard.chart.ask', 'Ask')}
        </Typography>
        <Typography sx={{
          fontFamily: 'monospace',
          color: CHART_COLORS.ask,
          fontWeight: 800,
          fontSize: '1.25rem',
          lineHeight: 1.15,
          letterSpacing: '0.02em',
        }}>
          {formatChartPrice(quote.ask)}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right' }}>
        <Typography sx={{ color: CHART_COLORS.hint, fontSize: '0.72rem', fontWeight: 600, lineHeight: 1.2 }}>
          {t('dashboard.chart.bid', 'Bid')}
        </Typography>
        <Typography sx={{
          fontFamily: 'monospace',
          color: CHART_COLORS.bid,
          fontWeight: 800,
          fontSize: '1.25rem',
          lineHeight: 1.15,
          letterSpacing: '0.02em',
        }}>
          {formatChartPrice(quote.bid)}
        </Typography>
      </Box>
      <Typography sx={{
        color: CHART_COLORS.hint,
        fontFamily: 'monospace',
        fontSize: '0.68rem',
        textAlign: 'right',
        mt: 0.25,
      }}>
        {t('dashboard.chart.spread', 'Spread')}: {formatChartPrice(quote.spread)}
        {quote.spreadEstimated ? ` · ${t('dashboard.chart.spreadEstimated', 'est.')}` : ''}
      </Typography>
    </Box>
  );
}

export default function SymbolChartPanel({ preferredSymbol }: SymbolChartPanelProps) {
  const { t, i18n } = useTranslation();
  const chartLocale = chartLocaleForLanguage(i18n.language);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const strokeCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const overlaySeriesRef = useRef<ISeriesApi<'Line'>[]>([]);
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const trendLineDrawingRef = useRef(false);
  const trendLineColorRef = useRef<string>(TREND_LINE_COLORS[0]);
  const strokeActiveRef = useRef(false);
  const currentStrokeRef = useRef<ChartStroke | null>(null);
  const chartStrokesRef = useRef<ChartStroke[]>([]);
  const redrawStrokesRef = useRef<() => void>(() => {});
  const crosshairModeRef = useRef<CrosshairDisplayMode>('ohlc');

  const { data: symbolsData } = useGetMarketSymbolsQuery();
  const suggestedSymbols = symbolsData?.symbols ?? [];
  const [searchSymbols, { isFetching: searchingSymbols }] = useLazySearchMarketSymbolsQuery();

  const [symbolInput, setSymbolInput] = useState(DEFAULT_SYMBOL);
  const [querySymbol, setQuerySymbol] = useState(DEFAULT_SYMBOL);
  const [searchOptions, setSearchOptions] = useState<SymbolSearchHit[]>([]);
  const [interval, setInterval] = useState<ChartInterval>('H1');
  const [indicators, setIndicators] = useState<IndicatorId[]>(['sma20', 'ema20']);
  const [crosshairMode, setCrosshairMode] = useState<CrosshairDisplayMode>('ohlc');
  const [crosshairHud, setCrosshairHud] = useState<CrosshairHud | null>(null);
  const [trendLineDrawing, setTrendLineDrawing] = useState(false);
  const [trendLineColor, setTrendLineColor] = useState<string>(TREND_LINE_COLORS[0]);
  const [chartStrokes, setChartStrokes] = useState<ChartStroke[]>([]);
  const [isStrokeDrawing, setIsStrokeDrawing] = useState(false);

  trendLineDrawingRef.current = trendLineDrawing;
  trendLineColorRef.current = trendLineColor;
  chartStrokesRef.current = chartStrokes;
  crosshairModeRef.current = crosshairMode;

  useEffect(() => {
    const preferred = preferredSymbol?.trim();
    if (!preferred) return;
    const normalized = preferred.toUpperCase();
    setSymbolInput(normalized);
    setQuerySymbol(normalized);
  }, [preferredSymbol]);

  useEffect(() => {
    const q = symbolInput.trim();
    if (q.length < 1) {
      setSearchOptions([]);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      searchSymbols(q)
        .unwrap()
        .then((res) => setSearchOptions(res.results))
        .catch(() => setSearchOptions([]));
    }, 300);

    return () => window.clearTimeout(timer);
  }, [symbolInput, searchSymbols]);

  const applySymbol = (raw?: string) => {
    const trimmed = (raw ?? symbolInput).trim();
    if (trimmed) setQuerySymbol(trimmed.toUpperCase());
  };

  const selectSymbolHit = (hit: SymbolSearchHit) => {
    setSymbolInput(hit.symbol);
    setQuerySymbol(hit.symbol);
  };

  const {
    data: candleData,
    isLoading: candlesLoading,
    isFetching,
    error,
  } = useGetMarketCandlesQuery(
    { symbol: querySymbol, interval },
    { skip: !querySymbol.trim() },
  );

  const { data: quoteData } = useGetMarketQuoteQuery(querySymbol, {
    skip: !querySymbol.trim(),
    pollingInterval: 3000,
  });

  const candles = candleData?.candles ?? [];
  const showRsiPane = indicators.includes('rsi14');
  const showMacdPane = indicators.includes('macd');

  const indicatorLabel = (id: IndicatorId) => t(`dashboard.chart.indicators.${id}`, id.toUpperCase());

  const toggleIndicator = (id: IndicatorId) => {
    setIndicators((prev) => (
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    ));
  };

  const candlestickData = useMemo(
    () => candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    })),
    [candles],
  );

  useEffect(() => {
    setCrosshairHud(null);
    setChartStrokes([]);
    setIsStrokeDrawing(false);
    strokeActiveRef.current = false;
    currentStrokeRef.current = null;
    setTrendLineDrawing(false);
  }, [querySymbol, interval, candles.length]);

  const redrawStrokes = () => {
    const canvas = strokeCanvasRef.current;
    const container = chartWrapRef.current;
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!canvas || !container || !chart || !series) return;

    const ctx = syncStrokeCanvasSize(canvas, container);
    if (!ctx) return;

    const project = (time: number, price: number) => projectChartPoint(chart, series, time, price);
    drawStrokesOnCanvas(ctx, chartStrokesRef.current, currentStrokeRef.current, project);
  };

  redrawStrokesRef.current = redrawStrokes;

  useEffect(() => {
    redrawStrokes();
  }, [chartStrokes, trendLineDrawing, candles.length]);

  useEffect(() => {
    const canvas = strokeCanvasRef.current;
    if (!canvas || !trendLineDrawing) return undefined;

    let lastPixel: { x: number; y: number } | null = null;

    const pixelToChartPoint = (clientX: number, clientY: number): ChartPoint | null => {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const chart = chartRef.current;
      const series = candleSeriesRef.current;
      if (!chart || !series) return null;

      const price = series.coordinateToPrice(y);
      const rawTime = chart.timeScale().coordinateToTime(x);
      if (price == null || rawTime == null || !Number.isFinite(price)) return null;

      const time = timeToUnix(rawTime);
      if (time == null) return null;
      return { time, price };
    };

    const appendPoint = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      if (lastPixel && Math.hypot(x - lastPixel.x, y - lastPixel.y) < STROKE_MIN_POINT_DIST_PX) {
        return;
      }
      lastPixel = { x, y };

      const pt = pixelToChartPoint(clientX, clientY);
      if (!pt || !currentStrokeRef.current) return;
      currentStrokeRef.current.points.push(pt);
      redrawStrokesRef.current();
    };

    const startStroke = (clientX: number, clientY: number) => {
      const pt = pixelToChartPoint(clientX, clientY);
      if (!pt) return;

      const rect = canvas.getBoundingClientRect();
      lastPixel = { x: clientX - rect.left, y: clientY - rect.top };
      strokeActiveRef.current = true;
      currentStrokeRef.current = {
        id: 'preview',
        points: [pt],
        color: trendLineColorRef.current,
      };
      setIsStrokeDrawing(true);
      redrawStrokesRef.current();
    };

    const finishStroke = (clientX: number, clientY: number) => {
      if (!strokeActiveRef.current || !currentStrokeRef.current) return;

      appendPoint(clientX, clientY);
      const stroke = currentStrokeRef.current;
      strokeActiveRef.current = false;
      currentStrokeRef.current = null;
      lastPixel = null;
      setIsStrokeDrawing(false);

      const chart = chartRef.current;
      const series = candleSeriesRef.current;
      if (!chart || !series || stroke.points.length < 2) {
        redrawStrokesRef.current();
        return;
      }

      const project = (time: number, price: number) => projectChartPoint(chart, series, time, price);
      if (strokeTotalPixelLength(stroke.points, project) < STROKE_MIN_TOTAL_DIST_PX) {
        redrawStrokesRef.current();
        return;
      }

      setChartStrokes((prev) => [
        ...prev,
        { ...stroke, id: `${Date.now()}-${prev.length}` },
      ]);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      startStroke(e.clientX, e.clientY);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!strokeActiveRef.current) return;
      appendPoint(e.clientX, e.clientY);
    };

    const onMouseUp = (e: MouseEvent) => {
      finishStroke(e.clientX, e.clientY);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      e.preventDefault();
      startStroke(e.touches[0].clientX, e.touches[0].clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!strokeActiveRef.current || e.touches.length !== 1) return;
      e.preventDefault();
      appendPoint(e.touches[0].clientX, e.touches[0].clientY);
    };

    const onTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      if (!touch) return;
      finishStroke(touch.clientX, touch.clientY);
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      strokeActiveRef.current = false;
      currentStrokeRef.current = null;
      lastPixel = null;
      redrawStrokesRef.current();
    };
  }, [trendLineDrawing, trendLineColor]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const drawing = trendLineDrawing || isStrokeDrawing;
    chart.applyOptions({
      handleScroll: drawing ? false : {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: drawing ? false : {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });
  }, [trendLineDrawing, isStrokeDrawing]);

  useEffect(() => {
    if (!quoteData || !candleSeriesRef.current || candles.length === 0) return;
    const last = candles[candles.length - 1];
    const mid = quoteData.mid;
    candleSeriesRef.current.update({
      time: last.time as UTCTimestamp,
      open: last.open,
      high: Math.max(last.high, mid),
      low: Math.min(last.low, mid),
      close: mid,
    });
  }, [quoteData, candles]);

  useEffect(() => {
    chartRef.current?.applyOptions({ crosshair: buildCrosshairOptions(crosshairMode) });
  }, [crosshairMode]);

  useEffect(() => {
    if (!chartContainerRef.current) return undefined;

    const chart = createChart(chartContainerRef.current, {
      ...chartLocalizationOptions(i18n.language),
      crosshair: buildCrosshairOptions(crosshairModeRef.current),
      layout: {
        background: { type: ColorType.Solid, color: '#111827' },
        textColor: CHART_COLORS.chartAxis,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.05)' },
        horzLines: { color: 'rgba(255,255,255,0.05)' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false },
      width: chartContainerRef.current.clientWidth,
      height: showRsiPane || showMacdPane ? 360 : 420,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00d4aa',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#00d4aa',
      wickDownColor: '#f43f5e',
    });
    candleSeries.setData(candlestickData);
    chart.timeScale().fitContent();
    candleSeriesRef.current = candleSeries;

    let lastHudKey = '';
    const onCrosshairMove = (param: MouseEventParams) => {
      if (!param.point) {
        lastHudKey = '';
        setCrosshairHud(null);
        return;
      }
      if (trendLineDrawingRef.current || crosshairModeRef.current === 'simple') {
        lastHudKey = '';
        setCrosshairHud(null);
        return;
      }
      if (!param.time) {
        lastHudKey = '';
        setCrosshairHud(null);
        return;
      }
      const bar = param.seriesData.get(candleSeries);
      if (!bar || !('open' in bar)) {
        lastHudKey = '';
        setCrosshairHud(null);
        return;
      }

      const hudKey = `${param.point.x}|${param.point.y}|${param.time}|${bar.open}|${bar.high}|${bar.low}|${bar.close}`;
      if (hudKey === lastHudKey) return;
      lastHudKey = hudKey;

      setCrosshairHud({
        x: param.point.x,
        y: param.point.y,
        ohlc: {
          time: param.time as number,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
        },
      });
    };
    chart.subscribeCrosshairMove(onCrosshairMove);

    const onVisibleRangeChange = () => {
      redrawStrokesRef.current();
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleRangeChange);

    chartRef.current = chart;
    overlaySeriesRef.current = [];

    const overlayIndicators = indicators.filter((id) => id !== 'rsi14' && id !== 'macd');
    overlayIndicators.forEach((id) => {
      const built = buildIndicatorSeries(candles, id);
      built.lines?.forEach((line) => {
        const series = chart.addSeries(LineSeries, {
          color: line.color,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        series.setData(line.data);
        overlaySeriesRef.current.push(series);
      });
    });

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      chart.applyOptions({ width: entry.contentRect.width });
      redrawStrokesRef.current();
    });
    resizeObserver.observe(chartContainerRef.current);

    requestAnimationFrame(() => redrawStrokesRef.current());

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleRangeChange);
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      overlaySeriesRef.current = [];
    };
  }, [candlestickData, candles, indicators, showMacdPane, showRsiPane, i18n.language]);

  useEffect(() => {
    if (!showRsiPane || !rsiContainerRef.current) {
      rsiChartRef.current?.remove();
      rsiChartRef.current = null;
      rsiSeriesRef.current = null;
      return undefined;
    }

    const chart = createChart(rsiContainerRef.current, {
      ...chartLocalizationOptions(i18n.language),
      layout: {
        background: { type: ColorType.Solid, color: '#0f172a' },
        textColor: CHART_COLORS.chartAxis,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', visible: false },
      width: rsiContainerRef.current.clientWidth,
      height: 120,
    });

    const rsiSeries = chart.addSeries(LineSeries, {
      color: '#f472b6',
      lineWidth: 2,
      priceLineVisible: false,
    });
    const built = buildIndicatorSeries(candles, 'rsi14');
    rsiSeries.setData(built.lines?.[0]?.data ?? []);
    chart.timeScale().fitContent();

    rsiChartRef.current = chart;
    rsiSeriesRef.current = rsiSeries;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      chart.applyOptions({ width: entry.contentRect.width });
    });
    resizeObserver.observe(rsiContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      rsiChartRef.current = null;
      rsiSeriesRef.current = null;
    };
  }, [candles, showRsiPane, i18n.language]);

  const errorMessage = (() => {
    if (!error || typeof error !== 'object') return null;
    const err = error as { status?: number; data?: { error?: string; message?: string } };
    return err.data?.message || err.data?.error || t('dashboard.chart.loadError', 'Failed to load chart data');
  })();

  return (
    <Card sx={{ bgcolor: '#111827', border: '1px solid rgba(255,255,255,0.06)' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
          <Typography variant="h6" sx={{ color: CHART_COLORS.title, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <ShowChartIcon sx={{ color: CHART_COLORS.accent, fontSize: 22 }} />
            {t('dashboard.chart.title', 'Symbol Chart')}
          </Typography>
          {candleData?.providerSymbol && (
            <Typography variant="caption" sx={{ color: CHART_COLORS.meta }}>
              {t('dashboard.chart.providerSymbol', 'Data')}: {candleData.providerSymbol}
              {candleData.cached ? ` · ${t('dashboard.chart.cached', 'cached')}` : ''}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: suggestedSymbols.length ? 1 : 2, alignItems: 'flex-start' }}>
          <Autocomplete
            freeSolo
            options={searchOptions}
            inputValue={symbolInput}
            onInputChange={(_event, value, reason) => {
              if (reason === 'reset') return;
              setSymbolInput(value.toUpperCase());
            }}
            onChange={(_event, value) => {
              if (!value) return;
              if (typeof value === 'string') {
                setSymbolInput(value.toUpperCase());
                applySymbol(value);
                return;
              }
              selectSymbolHit(value);
            }}
            filterOptions={(options) => options}
            getOptionLabel={(option) => (typeof option === 'string' ? option : option.symbol)}
            isOptionEqualToValue={(option, value) => (
              typeof option !== 'string'
              && typeof value !== 'string'
              && option.symbol === value.symbol
            )}
            loading={searchingSymbols}
            sx={{
              minWidth: 280,
              flex: '1 1 280px',
              maxWidth: 420,
              '& .MuiAutocomplete-popupIndicator': { color: CHART_COLORS.label },
              '& .MuiAutocomplete-clearIndicator': { color: CHART_COLORS.label },
              '& .MuiAutocomplete-popup': {
                '& .MuiPaper-root': {
                  bgcolor: '#1a1f2e',
                  border: '1px solid rgba(255,255,255,0.12)',
                },
              },
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                label={t('dashboard.chart.symbol', 'Symbol')}
                placeholder={t('dashboard.chart.symbolPlaceholder', 'e.g. XAUUSD, EURUSD, BTCUSD')}
                helperText={t('dashboard.chart.symbolHint', 'Type to search, then select a symbol')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applySymbol();
                }}
                sx={{
                  '& .MuiInputBase-input': {
                    color: CHART_COLORS.input,
                    fontFamily: 'monospace',
                    letterSpacing: '0.04em',
                  },
                  '& .MuiFormHelperText-root': { color: CHART_COLORS.hint },
                  '& .MuiInputLabel-root': { color: CHART_COLORS.label },
                  '& .MuiInputLabel-root.Mui-focused': { color: CHART_COLORS.accent },
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(255,255,255,0.02)',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                    '&:hover fieldset': { borderColor: 'rgba(103,232,249,0.45)' },
                    '&.Mui-focused fieldset': { borderColor: CHART_COLORS.accent },
                  },
                }}
              />
            )}
            renderOption={(props, option) => (
              <Box
                component="li"
                {...props}
                key={`${option.symbol}-${option.exchange ?? ''}`}
                sx={{ color: CHART_COLORS.input, '&:hover': { bgcolor: 'rgba(103,232,249,0.08)' } }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, color: CHART_COLORS.dropdownSymbol }}>
                    {option.symbol}
                  </Typography>
                  <Typography variant="caption" sx={{ color: CHART_COLORS.dropdownMeta }}>
                    {option.name}
                    {option.exchange ? ` · ${option.exchange}` : ''}
                  </Typography>
                </Box>
              </Box>
            )}
          />

          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', pt: 0.5 }}>
            {CHART_INTERVALS.map((iv) => (
              <Chip
                key={iv}
                label={iv}
                size="small"
                clickable
                onClick={() => setInterval(iv)}
                sx={{
                  bgcolor: interval === iv ? CHART_COLORS.accent : 'transparent',
                  color: interval === iv ? CHART_COLORS.intervalActiveText : CHART_COLORS.intervalIdle,
                  border: `1px solid ${interval === iv ? CHART_COLORS.accent : 'rgba(125,211,252,0.35)'}`,
                  fontWeight: interval === iv ? 700 : 500,
                }}
              />
            ))}
          </Box>
        </Box>

        {suggestedSymbols.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
            <Typography variant="caption" sx={{ color: CHART_COLORS.sectionLabel, fontWeight: 600 }}>
              {t('dashboard.chart.recentSymbols', 'Your symbols')}:
            </Typography>
            {suggestedSymbols.slice(0, 8).map((s) => (
              <Chip
                key={s.symbol}
                label={s.symbol}
                size="small"
                clickable
                onClick={() => selectSymbolHit({
                  symbol: s.symbol,
                  providerSymbol: s.providerSymbol,
                  name: s.symbol,
                  exchange: 'TRADES',
                })}
                sx={{
                  bgcolor: querySymbol === s.symbol ? 'rgba(0,212,170,0.2)' : 'transparent',
                  color: querySymbol === s.symbol ? CHART_COLORS.accent : CHART_COLORS.tradeChipIdle,
                  border: `1px solid ${querySymbol === s.symbol ? CHART_COLORS.accent : 'rgba(253,230,138,0.45)'}`,
                  fontFamily: 'monospace',
                }}
              />
            ))}
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2 }}>
          {INDICATOR_OPTIONS.map((id) => (
            <Chip
              key={id}
              label={indicatorLabel(id)}
              size="small"
              clickable
              onClick={() => toggleIndicator(id)}
              variant={indicators.includes(id) ? 'filled' : 'outlined'}
              sx={{
                bgcolor: indicators.includes(id) ? 'rgba(167,139,250,0.25)' : 'transparent',
                color: indicators.includes(id) ? CHART_COLORS.indicatorActive : CHART_COLORS.indicatorIdle,
                borderColor: indicators.includes(id) ? 'rgba(240,171,252,0.5)' : 'rgba(196,181,253,0.45)',
              }}
            />
          ))}
        </Box>

        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2, alignItems: 'center' }}>
          <Chip
            label={t('dashboard.chart.crosshairOhlc', 'Crosshair OHLC')}
            size="small"
            clickable
            onClick={() => setCrosshairMode('ohlc')}
            sx={{
              bgcolor: crosshairMode === 'ohlc' ? 'rgba(103,232,249,0.2)' : 'transparent',
              color: crosshairMode === 'ohlc' ? CHART_COLORS.meta : CHART_COLORS.intervalIdle,
              border: `1px solid ${crosshairMode === 'ohlc' ? CHART_COLORS.meta : 'rgba(125,211,252,0.35)'}`,
            }}
          />
          <Chip
            label={t('dashboard.chart.crosshairSimple', 'Price line')}
            size="small"
            clickable
            onClick={() => setCrosshairMode('simple')}
            sx={{
              bgcolor: crosshairMode === 'simple' ? 'rgba(148,163,184,0.2)' : 'transparent',
              color: crosshairMode === 'simple' ? CHART_COLORS.chartAxis : CHART_COLORS.intervalIdle,
              border: `1px solid ${crosshairMode === 'simple' ? CHART_COLORS.chartAxis : 'rgba(125,211,252,0.35)'}`,
            }}
          />
          <Chip
            icon={<BrushIcon sx={{ fontSize: '16px !important' }} />}
            label={t('dashboard.chart.trendLineDraw', 'Draw trend line')}
            size="small"
            clickable
            onClick={() => {
              setTrendLineDrawing((v) => {
                const next = !v;
                if (!next) {
                  strokeActiveRef.current = false;
                  currentStrokeRef.current = null;
                  setIsStrokeDrawing(false);
                }
                return next;
              });
            }}
            sx={{
              bgcolor: trendLineDrawing ? 'rgba(252,211,77,0.25)' : 'transparent',
              color: trendLineDrawing ? trendLineColor : CHART_COLORS.tradeChipIdle,
              border: `1px solid ${trendLineDrawing ? trendLineColor : 'rgba(253,230,138,0.45)'}`,
              '& .MuiChip-icon': { color: trendLineDrawing ? trendLineColor : CHART_COLORS.tradeChipIdle },
            }}
          />
          {trendLineDrawing && TREND_LINE_COLORS.map((color) => (
            <Box
              key={color}
              component="button"
              type="button"
              aria-label={t('dashboard.chart.trendLineColor', 'Line color')}
              onClick={() => setTrendLineColor(color)}
              sx={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                bgcolor: color,
                border: trendLineColor === color ? '2px solid #fff' : '2px solid rgba(255,255,255,0.2)',
                cursor: 'pointer',
                p: 0,
                flexShrink: 0,
              }}
            />
          ))}
          {chartStrokes.length > 0 && (
            <Chip
              label={t('dashboard.chart.clearTrendLines', 'Clear lines')}
              size="small"
              clickable
              onClick={() => setChartStrokes([])}
              sx={{
                color: CHART_COLORS.ohlcLow,
                border: '1px solid rgba(251,113,133,0.45)',
              }}
            />
          )}
        </Box>

        {trendLineDrawing && (
          <Typography variant="caption" sx={{ color: trendLineColor, display: 'block' }}>
            {isStrokeDrawing
              ? t('dashboard.chart.trendLineDragging', 'Drawing…')
              : t('dashboard.chart.trendLineHint', 'Hold and drag to draw freely on the chart')}
          </Typography>
        )}
          </Box>

          <LiveQuoteBar quote={quoteData} t={t} />
        </Box>

        {errorMessage && (
          <Alert severity="warning" sx={{ mb: 2 }}>{errorMessage}</Alert>
        )}

        <Box ref={chartAreaRef} sx={{ position: 'relative', minHeight: 420 }}>
          {(candlesLoading || isFetching) && (
            <Box sx={{
              position: 'absolute', inset: 0, zIndex: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: 'rgba(17,24,39,0.55)',
            }}>
              <CircularProgress size={28} sx={{ color: '#00d4aa' }} />
            </Box>
          )}
          {crosshairHud && crosshairMode === 'ohlc' && (() => {
            const areaW = chartAreaRef.current?.clientWidth ?? 480;
            const areaH = chartAreaRef.current?.clientHeight ?? 420;
            const panelW = 220;
            const panelH = 72;
            const left = Math.min(Math.max(crosshairHud.x + 14, 6), areaW - panelW - 6);
            const top = crosshairHud.y < panelH + 16
              ? Math.min(crosshairHud.y + 14, areaH - panelH - 6)
              : Math.max(6, crosshairHud.y - panelH - 10);
            return (
            <Box sx={{
              position: 'absolute',
              left,
              top,
              zIndex: 3,
              px: 1.25,
              py: 0.75,
              borderRadius: 1,
              bgcolor: 'rgba(15,23,42,0.94)',
              border: '1px solid rgba(103,232,249,0.25)',
              pointerEvents: 'none',
              boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
            }}>
              <Typography variant="caption" sx={{ color: CHART_COLORS.ohlcTime, display: 'block', mb: 0.5 }}>
                {formatChartTime(crosshairHud.ohlc.time, i18n.language)}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                {([
                  ['open', crosshairHud.ohlc.open, CHART_COLORS.ohlcOpen, CHART_COLORS.ohlcOpen],
                  ['high', crosshairHud.ohlc.high, CHART_COLORS.ohlcHigh, CHART_COLORS.ohlcHigh],
                  ['low', crosshairHud.ohlc.low, CHART_COLORS.ohlcLow, CHART_COLORS.ohlcLow],
                  ['close', crosshairHud.ohlc.close, CHART_COLORS.meta, crosshairHud.ohlc.close >= crosshairHud.ohlc.open ? CHART_COLORS.ohlcHigh : CHART_COLORS.ohlcLow],
                ] as const).map(([key, value, labelColor, valueColor]) => (
                  <Typography key={key} variant="caption" sx={{ fontFamily: 'monospace' }}>
                    <Box component="span" sx={{ color: labelColor, mr: 0.5, fontWeight: 600 }}>
                      {t(`dashboard.chart.ohlc.${key}`, key.toUpperCase())}
                    </Box>
                    <Box component="span" sx={{ color: valueColor, fontWeight: 700 }}>
                      {formatChartPrice(value)}
                    </Box>
                  </Typography>
                ))}
              </Box>
            </Box>
            );
          })()}
          {trendLineDrawing && (
            <Box sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              zIndex: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.25,
              py: 0.5,
              borderRadius: 1,
              bgcolor: 'rgba(15,23,42,0.9)',
              border: `1px solid ${trendLineColor}`,
              pointerEvents: 'none',
            }}>
              <BrushIcon sx={{ fontSize: 18, color: trendLineColor }} />
              <Typography variant="caption" sx={{ color: trendLineColor, fontWeight: 700 }}>
                {t('dashboard.chart.trendLineActive', 'Drawing mode')}
              </Typography>
            </Box>
          )}
          <Box ref={chartWrapRef} sx={{ position: 'relative', width: '100%' }}>
            <Box ref={chartContainerRef} sx={{ width: '100%' }} />
            <Box
              component="canvas"
              ref={strokeCanvasRef}
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 3,
                pointerEvents: trendLineDrawing ? 'auto' : 'none',
                touchAction: trendLineDrawing ? 'none' : 'auto',
                cursor: trendLineDrawing ? 'crosshair' : 'default',
              }}
            />
          </Box>
          {showMacdPane && candles.length > 0 && (
            <Box sx={{ mt: 1, px: 0.5 }}>
              <Typography variant="caption" sx={{ color: CHART_COLORS.macdTitle, mb: 0.5, display: 'block', fontWeight: 600 }}>
                MACD
              </Typography>
              <MacdMiniPane candles={candles} locale={chartLocale} />
            </Box>
          )}
          {showRsiPane && <Box ref={rsiContainerRef} sx={{ width: '100%', mt: 1 }} />}
        </Box>
      </CardContent>
    </Card>
  );
}

function MacdMiniPane({ candles, locale }: { candles: CandleBar[]; locale: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !candles.length) return undefined;
    const built = buildIndicatorSeries(candles, 'macd');

    const chart = createChart(ref.current, {
      ...chartLocalizationOptions(locale),
      layout: { background: { type: ColorType.Solid, color: '#0f172a' }, textColor: CHART_COLORS.chartAxis },
      grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { visible: false },
      width: ref.current.clientWidth,
      height: 100,
    });

    if (built.histogram) {
      const hist = chart.addSeries(HistogramSeries, {
        priceLineVisible: false,
        lastValueVisible: false,
      });
      hist.setData(built.histogram.data);
    }
    built.lines?.forEach((line) => {
      const series = chart.addSeries(LineSeries, {
        color: line.color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      series.setData(line.data);
    });
    chart.timeScale().fitContent();

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) chart.applyOptions({ width: w });
    });
    ro.observe(ref.current);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [candles, locale]);

  return <Box ref={ref} sx={{ width: '100%' }} />;
}
