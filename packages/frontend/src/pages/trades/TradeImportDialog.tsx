import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Stepper, Step, StepLabel,
  Table, TableHead, TableBody, TableRow, TableCell,
  Select, MenuItem, FormControl, TextField,
  Alert, CircularProgress, Chip,
  TableContainer, InputLabel,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import { useImportTradesMutation, type ImportTradesRequest } from '../../store/tradeApi';
import {
  BROKER_PRESETS, getBrokerPreset, autoMapColumns as autoMapWithPreset,
  resolveDirection, resolveDerivedPrice, normalizeBrokerImportAmounts, normalizeBrokerImportQuantity,
  type BrokerPresetKey,
} from '../../utils/brokerPresets';
import { parseImportCsv } from '../../utils/csvImport';
import { COMMON_TIMEZONES, SUPPORTED_CURRENCIES } from '../../utils/format';

// Target field definitions
const TARGET_FIELDS = [
  { key: 'symbol', label: 'Symbol / 代码', required: true, aliases: ['symbol', 'ticker', 'stock', 'code', 'instrument', '代码', '股票代码', '合约代码'] },
  { key: 'direction', label: 'Direction / 方向', required: true, aliases: ['direction', 'side', 'type', 'buy/sell', '方向', '持仓方向', '买卖'] },
  { key: 'entryPrice', label: 'Entry Price / 入场价', required: true, aliases: ['entry', 'entryprice', 'buyprice', 'buy_price', 'openprice', '入场价', '开仓价', '买入价'] },
  { key: 'exitPrice', label: 'Exit Price / 出场价', required: false, aliases: ['exit', 'exitprice', 'sellprice', 'sell_price', 'closeprice', '出场价', '平仓价', '卖出价'] },
  { key: 'quantity', label: 'Quantity / 数量', required: true, aliases: ['quantity', 'qty', 'shares', 'contracts', 'size', 'volume', '数量', '手数', '股数'] },
  { key: 'leverage', label: 'Leverage / 杠杆', required: false, aliases: ['leverage', 'lever', 'lv', '杠杆', '倍数', 'margin'] },
  { key: 'pnl', label: 'P&L / 盈亏', required: false, aliases: ['pnl', 'profit', 'loss', 'pl', 'profit_loss', '盈亏', '利润', '亏损', '净盈亏'] },
  { key: 'commission', label: 'Commission / 手续费', required: false, aliases: ['commission', 'fee', 'fees', 'cost', 'charges', '手续费', '佣金', '费用', '交易费用'] },
  { key: 'swap', label: 'Swap / 隔夜费', required: false, aliases: ['swap', 'overnight', 'rollover', '隔夜费', '库存费'] },
  { key: 'quoteCurrency', label: 'Currency / 货币', required: false, aliases: ['currency', 'quote', 'quote_currency', '货币', '计价货币'] },
  { key: 'entryDate', label: 'Entry Time / 入场时间', required: true, aliases: ['entrydate', 'entry_date', 'entrytime', 'entry_time', 'date', 'opentime', 'opentimestamp', 'open_date', '入场日期', '入场时间', '开仓日期', '开仓时间'] },
  { key: 'exitDate', label: 'Exit Time / 出场时间', required: false, aliases: ['exitdate', 'exit_date', 'exittime', 'exit_time', 'closedate', 'close_date', 'closetime', 'closetimestamp', '出场日期', '出场时间', '平仓日期', '平仓时间'] },
] as const;

type TargetKey = typeof TARGET_FIELDS[number]['key'] | 'skip';

interface ColumnMapping {
  sourceColumn: string;
  targetKey: TargetKey;
  isAutoMapped: boolean;
}

interface ParsedRow {
  [key: string]: string;
}

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else current += ch;
    }
    result.push(current.trim());
    return result;
  };
  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(line => {
    const values = parseRow(line);
    const row: ParsedRow = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
  return { headers, rows };
}

function parseXLSX(buffer: ArrayBuffer): { headers: string[]; rows: ParsedRow[] } {
  try {
    // Simple XLSX/CSV detection - if first bytes are PK (xlsx zip), fall back to CSV parse
    const bytes = new Uint8Array(buffer);
    if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
      // It's a real xlsx - try to extract from shared strings
      // For simplicity, we'll parse the sheet1 XML
      const { readzip } = (window as any).__xlsxUtils || {};
      if (!readzip) {
        // Try simple CSV fallback
        const decoder = new TextDecoder();
        const text = decoder.decode(buffer);
        if (text.includes(',')) return parseCSV(text);
      }
    }
    // Try CSV parse
    const decoder = new TextDecoder();
    const text = decoder.decode(buffer);
    return parseCSV(text);
  } catch {
    return { headers: [], rows: [] };
  }
}

function autoMapColumns(columnNames: string[]): ColumnMapping[] {
  const mappedTargets = new Set<TargetKey>();
  const result: ColumnMapping[] = [];

  // First pass: try exact matches (highest priority)
  for (const col of columnNames) {
    const lower = col.toLowerCase().trim();
    let matched = false;
    for (const field of TARGET_FIELDS) {
      if (mappedTargets.has(field.key as TargetKey)) continue;
      // Exact match: column name exactly equals an alias
      if (field.aliases.some((alias: string) => alias.toLowerCase() === lower)) {
        result.push({ sourceColumn: col, targetKey: field.key as TargetKey, isAutoMapped: true });
        mappedTargets.add(field.key as TargetKey);
        matched = true;
        break;
      }
    }
    if (!matched) {
      result.push({ sourceColumn: col, targetKey: 'skip', isAutoMapped: false });
    }
  }

  // Second pass: try fuzzy/contains match for still-unmapped columns
  for (let i = 0; i < result.length; i++) {
    if (result[i].targetKey !== 'skip') continue;
    const col = result[i].sourceColumn;
    const lower = col.toLowerCase().trim();
    for (const field of TARGET_FIELDS) {
      if (mappedTargets.has(field.key as TargetKey)) continue;
      // Fuzzy match: column name contains an alias OR alias contains column name
      if (field.aliases.some((alias: string) =>
        lower.includes(alias.toLowerCase()) || alias.toLowerCase().includes(lower)
      )) {
        result[i] = { sourceColumn: col, targetKey: field.key as TargetKey, isAutoMapped: true };
        mappedTargets.add(field.key as TargetKey);
        break;
      }
    }
  }

  return result;
}

/** Merge broker preset column map with generic fuzzy mapping. Preset wins; one target field per column. */
function buildColumnMapping(headers: string[], presetKey: BrokerPresetKey): ColumnMapping[] {
  const preset = getBrokerPreset(presetKey);
  const presetMap = autoMapWithPreset(headers, preset);
  const colToField = new Map<string, TargetKey>();
  const usedTargets = new Set<TargetKey>();

  for (const [field, col] of Object.entries(presetMap)) {
    colToField.set(col, field as TargetKey);
    usedTargets.add(field as TargetKey);
  }

  const genericMappings = autoMapColumns(headers);
  for (const gm of genericMappings) {
    if (colToField.has(gm.sourceColumn)) continue;
    if (gm.targetKey === 'skip' || usedTargets.has(gm.targetKey)) {
      colToField.set(gm.sourceColumn, 'skip');
      continue;
    }
    colToField.set(gm.sourceColumn, gm.targetKey);
    usedTargets.add(gm.targetKey);
  }

  const presetColumns = new Set(Object.values(presetMap));
  const genericByCol = new Map(genericMappings.map((gm) => [gm.sourceColumn, gm]));
  return headers.map((header) => {
    const targetKey = colToField.get(header) ?? 'skip';
    const generic = genericByCol.get(header);
    return {
      sourceColumn: header,
      targetKey,
      isAutoMapped:
        targetKey !== 'skip' &&
        (presetColumns.has(header) || generic?.targetKey === targetKey),
    };
  });
}

function normalizeDirection(value: string, presetKey: BrokerPresetKey): 'long' | 'short' | null {
  return resolveDirection(value, getBrokerPreset(presetKey));
}

function parseChineseTime(timeStr: string): { h: number; min: number; sec: number } | null {
  // Support formats like:
  // "22点05分", "22时05分30秒", "22:05:30", "22:05", "22点", "22时"
  const chineseTime = /(\d{1,2})[点时](?:\s*(\d{1,2})[分])?(?:\s*(\d{1,2})[秒])?/.exec(timeStr);
  if (chineseTime) {
    return {
      h: parseInt(chineseTime[1], 10),
      min: parseInt(chineseTime[2] || '0', 10),
      sec: parseInt(chineseTime[3] || '0', 10),
    };
  }

  // Standard time format: HH:mm:ss or HH:mm
  const stdTime = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(timeStr.trim());
  if (stdTime) {
    return {
      h: parseInt(stdTime[1], 10),
      min: parseInt(stdTime[2], 10),
      sec: parseInt(stdTime[3] || '0', 10),
    };
  }

  return null;
}

function parseDate(value: string): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/[\u3000\s]+/g, ' ').trim(); // Normalize full-width spaces
  if (!trimmed) return null;

  // Helper to create date from components
  const createDate = (y: number, m: number, d: number, h = 0, min = 0, sec = 0): string | null => {
    const date = new Date(y, m - 1, d, h, min, sec);
    if (!isNaN(date.getTime()) && date.getFullYear() === y) {
      return date.toISOString();
    }
    return null;
  };

  // Try native Date parsing first (handles ISO format and many standard formats)
  const native = new Date(trimmed);
  if (!isNaN(native.getTime()) && native.getFullYear() > 1900) {
    // Verify it's a reasonable date (not just random text that Date() parsed)
    const yearCheck = /\d{4}/.exec(trimmed);
    if (yearCheck && Math.abs(parseInt(yearCheck[0], 10) - native.getFullYear()) <= 1) {
      return native.toISOString();
    }
  }

  // Format 1: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD (with optional time)
  // Supports: 2025-01-01, 2025/01/01, 2025.01.01, 2025.1.1, etc.
  const ymdSep = /^(\d{4})([-./])(\d{1,2})\2(\d{1,2})(?:\s+(.*))?$/.exec(trimmed);
  if (ymdSep) {
    const [, y, , m, d, rest] = ymdSep;
    let h = 0, min = 0, sec = 0;
    if (rest) {
      const parsedTime = parseChineseTime(rest);
      if (parsedTime) { h = parsedTime.h; min = parsedTime.min; sec = parsedTime.sec; }
    }
    const result = createDate(parseInt(y, 10), parseInt(m, 10), parseInt(d, 10), h, min, sec);
    if (result) return result;
  }

  // Format 2: MM/DD/YYYY or DD/MM/YYYY (with optional time)
  const shortYear = /^(\d{1,2})([-./])(\d{1,2})\2(\d{4})(?:\s+(.*))?$/.exec(trimmed);
  if (shortYear) {
    const [, a, , b, y, rest] = shortYear;
    let h = 0, min = 0, sec = 0;
    if (rest) {
      const parsedTime = parseChineseTime(rest);
      if (parsedTime) { h = parsedTime.h; min = parsedTime.min; sec = parsedTime.sec; }
    }
    // Assume first part is month (US format is more common in finance)
    const result = createDate(parseInt(y, 10), parseInt(a, 10), parseInt(b, 10), h, min, sec);
    if (result) return result;
  }

  // Format 3: Chinese format with various separators
  // Supports: 2025年1月1日, 2025年01月01日, 2025年1月1日 22点05分, 2025年1月1日 22:05:30
  const chineseFull = /^(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日(?:\s+(.*))?$/.exec(trimmed);
  if (chineseFull) {
    const [, y, m, d, rest] = chineseFull;
    let h = 0, min = 0, sec = 0;
    if (rest) {
      const parsedTime = parseChineseTime(rest);
      if (parsedTime) { h = parsedTime.h; min = parsedTime.min; sec = parsedTime.sec; }
    }
    const result = createDate(parseInt(y, 10), parseInt(m, 10), parseInt(d, 10), h, min, sec);
    if (result) return result;
  }

  // Format 4: Pure numeric YYYYMMDD or YYYYMMDDHHmmss
  const pureNum = /^(\d{4})(\d{2})(\d{2})(?:\s*T?\s*(\d{2})(\d{2})(\d{2}))?$/.exec(trimmed);
  if (pureNum) {
    const [, y, m, d, hStr, minStr, secStr] = pureNum;
    const result = createDate(
      parseInt(y, 10), parseInt(m, 10), parseInt(d, 10),
      hStr ? parseInt(hStr, 10) : 0,
      minStr ? parseInt(minStr, 10) : 0,
      secStr ? parseInt(secStr, 10) : 0
    );
    if (result) return result;
  }

  // Format 5: English month names (e.g., Jan 15, 2024, January 15, 2024, 15-Jan-2024)
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                      'july', 'august', 'september', 'october', 'november', 'december'];
  const monthAbbr = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  // Match: "Month DD, YYYY" or "Month DD YYYY"
  const engMonthFirst = new RegExp(`^(${monthNames.join('|')}|${monthAbbr.join('|')})\\s+(\\d{1,2}),?\\s+(\\d{4})(?:\\s+(.*))?$`, 'i').exec(trimmed);
  if (engMonthFirst) {
    const monthStr = engMonthFirst[1].toLowerCase();
    const m = monthNames.indexOf(monthStr) >= 0 ? monthNames.indexOf(monthStr) + 1 :
              monthAbbr.indexOf(monthStr) >= 0 ? monthAbbr.indexOf(monthStr) + 1 : 0;
    if (m > 0) {
      const d = parseInt(engMonthFirst[2], 10);
      const y = parseInt(engMonthFirst[3], 10);
      let h = 0, minT = 0, sec = 0;
      if (engMonthFirst[4]) {
        const parsedTime = parseChineseTime(engMonthFirst[4]);
        if (parsedTime) { h = parsedTime.h; minT = parsedTime.min; sec = parsedTime.sec; }
      }
      const result = createDate(y, m, d, h, minT, sec);
      if (result) return result;
    }
  }

  // Format 6: Excel serial date number (e.g., 45292 for 2024-01-15)
  const excelSerial = /^(\d{4,6})(?:\.\d+)?$/.exec(trimmed);
  if (excelSerial) {
    const serial = parseFloat(excelSerial[1]);
    if (serial > 1 && serial < 100000) {
      // Excel serial date: day 1 = Jan 1, 1900 (with Excel's leap year bug)
      const excelEpoch = new Date(1899, 11, 31);
      const date = new Date(excelEpoch.getTime() + (serial - 1) * 86400000);
      if (!isNaN(date.getTime()) && date.getFullYear() > 1970) {
        return date.toISOString();
      }
    }
  }

  // If we reach here, the date format is not recognized
  return null;
}

/**
 * Returns user-friendly error message for unrecognized date format
 */
export function getDateFormatHint(originalValue: string): string {
  const examples = [
    '2024-01-15 09:30:00',
    '2024/01/15 09:30',
    '2024.01.15 09:30:00',
    '2024年1月15日 09点30分',
    '15-Jan-2024',
  ];
  return `无法识别的日期格式 "${originalValue}"。支持格式: ${examples.join('、')}。请使用以上规范格式重新导入。`;
}

/**
 * Parse number from various string formats
 * Supports: currency symbols, thousand separators, Chinese units, accounting negatives, text prefixes/suffixes, etc.
 */
function parseNumber(value: string): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Check for empty/null-like values that should be treated as null (not zero)
  const nullValues = ['n/a', 'na', 'null', 'undefined', '--', '-', '—', '', '空', '无', 'none',
                      '\\', '/', 'x', '×', '*', '·'];
  if (nullValues.includes(trimmed.toLowerCase())) {
    return null; // Treat as missing value, not error
  }

  let cleaned = trimmed;

  // Remove common text prefixes and suffixes that appear in financial data
  // e.g., "价格: 150.00", "150.00元", "USD 150.00", "Price $150"
  cleaned = cleaned
    .replace(/^(?:价格|单价|金额|成本|费用|数值|value|price|cost|amount|fee)[:：\s]*/i, '') // Remove prefix labels
    .replace(/(?:元|美元|美金|欧元|英镑|港币|日元|韩元|CNY|USD|EUR|GBP|HKD|JPY|KRW)\s*\/?(?:股|手|份| shares?|units?)?$/i, '') // Remove unit suffixes
    .trim();

  // Detect negative sign from various formats
  let isNegative = false;
  if (/^[-−－]/.test(cleaned)) { // Leading minus sign (various Unicode minuses)
    isNegative = true;
    cleaned = cleaned.replace(/^[-−－]+/, '');
  }
  // Accounting format: parentheses indicate negative (300.00) = -300.00
  if (/\(([^)]+)\)/.test(cleaned)) {
    isNegative = true;
    cleaned = cleaned.replace(/\(([^)]+)\)/, '$1');
  }

  // Remove all whitespace
  cleaned = cleaned.replace(/\s+/g, '');

  // Remove currency symbols ($ ¥ € £ ₩ ₽ ₹ ¤)
  cleaned = cleaned.replace(/[$¥€£₩₽₇¤]/g, '');

  // Handle Chinese number characters (simplified)
  // e.g., "一百五十" -> 150, "负三百" -> -300
  const chineseNumMatch = cleaned.match(/^([负零一二三四五六七八九十百千万亿点\.]+)$/);
  if (chineseNumMatch && chineseNumMatch[0].length > 0) {
    const chineseNum = parseChineseNumber(chineseNumMatch[0]);
    if (chineseNum !== null) {
      return isNegative ? -chineseNum : chineseNum;
    }
  }

  // Remove thousand separators (comma or dot based on context)
  // Strategy: If there's a dot followed by exactly 2-3 digits at the end, treat it as decimal separator
  // Otherwise, dots might be thousand separators (European format)
  if (/,/.test(cleaned) && /\./.test(cleaned)) {
    // Has both comma and dot - determine which is decimal
    const lastDotIndex = cleaned.lastIndexOf('.');
    const afterDot = cleaned.substring(lastDotIndex + 1);
    if (afterDot.length <= 3 && /^\d+$/.test(afterDot)) {
      // Dot is likely the decimal separator, remove commas
      cleaned = cleaned.replace(/,/g, '');
    } else {
      // Comma is likely the decimal separator (European), remove dots and convert comma to dot
      cleaned = cleaned.replace(/\./g, '').replace(/,/, '.');
    }
  } else if (/,/.test(cleaned)) {
    // Only has comma - check if it's a decimal or thousand separator
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length <= 3 && /^\d+$/.test(parts[1])) {
      // Could be either - for financial data with small decimal part, treat as thousand separator
      // e.g., "1,500" = 1500 (not 1.5)
      if (parts[1].length <= 2) {
        cleaned = cleaned.replace(',', ''); // Likely thousand separator
      } else {
        // 3 digits - heuristic: if first part is short, likely decimal
        cleaned = parts[0].length <= 3 ? cleaned.replace(',', '.') : cleaned.replace(',', '');
      }
    } else {
      // Multiple commas - definitely thousand separators
      cleaned = cleaned.replace(/,/g, '');
    }
  }
  // Single dot with digits after is fine (standard decimal)

  // Final cleanup: remove any remaining non-numeric chars except dot, minus, plus
  cleaned = cleaned.replace(/[^\d.\-+]/g, '');

  // Ensure valid numeric string
  if (!cleaned || !/^[\d.\-+]+$/.test(cleaned)) {
    return null;
  }

  const num = parseFloat(cleaned);

  if (isNaN(num) || !isFinite(num)) {
    return null;
  }

  // Apply negative flag
  const result = isNegative ? Math.abs(num) * -1 : num;

  // Sanity check: reject obviously wrong values (e.g., dates parsed as numbers)
  if (Math.abs(result) > 1e15 || (result !== 0 && Math.abs(result) < 1e-10)) {
    return null;
  }

  return result;
}

/**
 * Convert Chinese numerals to Arabic numbers
 * Supports: 零一二三四五六七八九十百千万亿 and combinations like 一百五, 三千二百
 */
function parseChineseNumber(str: string): number | null {
  const numMap: Record<string, number> = {
    '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '百': 100,
    '千': 1000, '万': 10000, '亿': 100000000
  };

  let result = 0;
  let current = 0;
  let isNegative = str.startsWith('负');

  for (const char of str.replace('负', '')) {
    const val = numMap[char];
    if (val === undefined) return null;

    if (char === '点') {
      // Decimal point - handle fractional part specially
      const dotIdx = str.indexOf('点');
      if (dotIdx === -1) continue;
      const fracStr = str.substring(dotIdx + 1).split('').map(c => numMap[c] ?? '').join('');
      const frac = parseFloat('0.' + fracStr);
      return isNegative ? -(result + current + frac) : result + current + frac;
    }

    if (val >= 10) { // Positional character (十, 百, 千, 万, 亿)
      if (current === 0) current = 1; // e.g., 十 = 10, not 0*10
      current *= val;
      if (val >= 10000) { // 万, 亿 reset
        result += current;
        current = 0;
      }
    } else { // Digit 0-9
      current = val;
    }
  }

  result += current;
  return isNegative ? -result : result;
}

/**
 * Returns user-friendly error message for unrecognized number format
 */
export function getNumberFormatHint(originalValue: string, fieldName: string): string {
  const examples = [
    '150.00 或 150（纯数字）',
    '$150.00 或 ¥150.00（带货币符号）',
    '1,000.00（带千分位）',
    '(300.00)（会计负数格式）',
  ];
  return `无法识别的${fieldName}格式 "${originalValue}"。支持格式: ${examples.join('、')}。请使用以上规范格式重新导入。`;
}

interface TradeImportDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function TradeImportDialog({ open, onClose, onSuccess }: TradeImportDialogProps) {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; failed: number; errors: string[] } | null>(null);
  const [error, setError] = useState('');
  const [brokerPreset, setBrokerPreset] = useState<BrokerPresetKey>('generic');
  const [sourceTimezone, setSourceTimezone] = useState('UTC');
  const [defaultQuoteCurrency, setDefaultQuoteCurrency] = useState('USD');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importTrades] = useImportTradesMutation();

  const handleFileSelect = useCallback((file: File) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      setError(t('tradeImport.invalidFileType'));
      return;
    }
    setError('');
    setFileName(file.name);

    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const { headers: h, rows: r } = parseImportCsv(text, brokerPreset);
        setHeaders(h);
        setRows(r.slice(0, 100)); // Preview first 100
        const initialMapping = buildColumnMapping(h, brokerPreset);
        setMapping(initialMapping);
        const preset = getBrokerPreset(brokerPreset);
        setSourceTimezone(preset.defaultTimezone);
        setDefaultQuoteCurrency(preset.defaultQuoteCurrency);
      };
      reader.readAsText(file);
    } else {
      // For xlsx, read as binary then try to parse
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        const { headers: h, rows: r } = parseXLSX(buffer);
        if (h.length === 0) {
          // Fallback: try as text (some xlsx exports are just csv)
          const decoder = new TextDecoder();
          const text = decoder.decode(buffer);
          const parsed = parseImportCsv(text, brokerPreset);
          setHeaders(parsed.headers);
          setRows(parsed.rows.slice(0, 100));
          const initialMapping = buildColumnMapping(parsed.headers, brokerPreset);
          setMapping(initialMapping);
        } else {
          setHeaders(h);
          setRows(r.slice(0, 100));
          const initialMapping = buildColumnMapping(h, brokerPreset);
          setMapping(initialMapping);
        }
        const preset = getBrokerPreset(brokerPreset);
        setSourceTimezone(preset.defaultTimezone);
        setDefaultQuoteCurrency(preset.defaultQuoteCurrency);
      };
      reader.readAsArrayBuffer(file);
    }
  }, [t, brokerPreset]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleMappingChange = (index: number, newKey: TargetKey) => {
    setMapping(prev => prev.map((m, i) => i === index ? { ...m, targetKey: newKey, isAutoMapped: false } : m));
  };

  const downloadTemplate = () => {
    const csv = 'symbol,direction,entryPrice,exitPrice,quantity,leverage,pnl,commission,entryTime,exitTime\nAAPL,long,150.00,155.00,100,1,500.00,5.00,2024-01-15 09:30,2024-01-15 16:00\nTSLA,short,250.00,240.00,50,1,450.00,3.00,2024-01-16 10:00,2024-01-16 14:30\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'trade_import_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const canProceedToMapping = headers.length > 0;
  const hasSymbolMapping = mapping.some(m => m.targetKey === 'symbol');
  const preset = getBrokerPreset(brokerPreset);
  const hasDirectionMapping =
    mapping.some((m) => m.targetKey === 'direction') ||
    !!preset.defaultDirection ||
    !!preset.inferDirectionFromClosingSide;
  const hasEntryPriceMapping = mapping.some(m => m.targetKey === 'entryPrice');
  const hasQuantityMapping = mapping.some(m => m.targetKey === 'quantity');
  const hasEntryDateMapping = mapping.some(m => m.targetKey === 'entryDate');
  const hasRequiredMappings = hasSymbolMapping && hasDirectionMapping && hasEntryPriceMapping && hasQuantityMapping && hasEntryDateMapping;
  const canProceedToConfirm = mapping.some(m => m.targetKey !== 'skip');

  const mappedCount = mapping.filter(m => m.targetKey !== 'skip').length;
  const skippedCount = mapping.filter(m => m.targetKey === 'skip').length;

  const handleImport = async () => {
    setImporting(true);
    setError('');
    try {
      const trades: ImportTradesRequest['trades'] = [];
      const errors: string[] = [];

      const preset = getBrokerPreset(brokerPreset);
      const presetColumnMap = autoMapWithPreset(headers, preset);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const getMappedValue = (key: TargetKey) => {
          const presetCol = presetColumnMap[key];
          if (brokerPreset !== 'generic' && presetCol) {
            return row[presetCol] ?? '';
          }
          const col = mapping.find(m => m.targetKey === key)?.sourceColumn;
          return col ? row[col] : '';
        };
        const getHelperValue = (key: 'costBasis' | 'proceeds') => {
          const col = presetColumnMap[key];
          return col ? row[col] : '';
        };

        const symbol = getMappedValue('symbol');
        const directionStr = getMappedValue('direction');
        const entryPriceStr = getMappedValue('entryPrice');
        const exitPriceStr = getMappedValue('exitPrice');
        const quantityStr = getMappedValue('quantity');
        const pnlStr = getMappedValue('pnl');
        const commissionStr = getMappedValue('commission');
        const swapStr = getMappedValue('swap');
        const quoteCurrencyStr = getMappedValue('quoteCurrency');
        const leverageStr = getMappedValue('leverage');
        const entryDateStr = getMappedValue('entryDate');
        const exitDateStr = getMappedValue('exitDate');

        if (!symbol || !quantityStr || !entryDateStr) {
          errors.push(`Row ${i + 2}: missing required fields`);
          continue;
        }

        const direction = normalizeDirection(directionStr, brokerPreset);
        let entryPrice = parseNumber(entryPriceStr);
        let exitPrice = exitPriceStr ? parseNumber(exitPriceStr) : undefined;
        const quantity = normalizeBrokerImportQuantity(
          preset,
          symbol,
          parseNumber(quantityStr) ?? 0,
        );
        let pnl = pnlStr ? parseNumber(pnlStr) : undefined;
        let commission = commissionStr ? parseNumber(commissionStr) : undefined;
        let swap = swapStr ? parseNumber(swapStr) : undefined;
        ({ pnl, commission, swap } = normalizeBrokerImportAmounts(brokerPreset, {
          pnl: pnl ?? undefined,
          commission: commission ?? undefined,
          swap: swap ?? undefined,
        }));
        const quoteCurrency = quoteCurrencyStr ? quoteCurrencyStr.toUpperCase().trim().slice(0, 3) : undefined;
        const leverage = leverageStr ? parseNumber(leverageStr) : undefined;
        const entryTimestamp = parseDate(entryDateStr);
        const exitTimestamp = exitDateStr ? parseDate(exitDateStr) : undefined;

        if (!entryPrice) {
          entryPrice = resolveDerivedPrice(
            'entryPrice',
            preset,
            { costBasis: getHelperValue('costBasis'), quantity: quantityStr },
            parseNumber,
          ) ?? null;
        }
        if (!exitPrice) {
          exitPrice = resolveDerivedPrice(
            'exitPrice',
            preset,
            { proceeds: getHelperValue('proceeds'), quantity: quantityStr },
            parseNumber,
          );
        }

        // Validate with user-friendly error messages
        if (!direction) {
          errors.push(`第 ${i + 2} 行: 无效的交易方向 "${directionStr}"，支持: 多/买/long/空/卖/short`);
          continue;
        }
        if (!entryPrice) {
          errors.push(getNumberFormatHint(entryPriceStr, '入场价').replace('无法识别的', `第 ${i + 2} 行: 无法识别的`));
          continue;
        }
        if (!quantity) {
          errors.push(getNumberFormatHint(quantityStr, '数量').replace('无法识别的', `第 ${i + 2} 行: 无法识别的`));
          continue;
        }
        if (!entryTimestamp) {
          errors.push(getDateFormatHint(entryDateStr).replace('无法识别的', `第 ${i + 2} 行: 无法识别的`));
          continue;
        }

        trades.push({
          tradingSymbol: symbol.toUpperCase().trim(),
          positionDirection: direction,
          entryPrice,
          exitPrice: exitPrice ?? undefined,
          quantity,
          leverage: leverage ?? preset.defaultLeverage ?? 1,
          entryTimestamp,
          exitTimestamp: exitTimestamp ?? undefined,
          pnl: pnl ?? undefined,
          commission: commission ?? undefined,
          swap: swap ?? undefined,
          quoteCurrency: quoteCurrency || defaultQuoteCurrency,
          pnlSource: pnl !== undefined ? 'broker' : undefined,
        });
      }

      if (trades.length === 0) {
        setError(t('tradeImport.atLeastOneTrade'));
        setImporting(false);
        return;
      }

      const res = await importTrades({
        trades,
        importSource: brokerPreset === 'generic' ? undefined : brokerPreset,
        sourceTimezone,
        defaultQuoteCurrency,
      }).unwrap();
      setResult({ imported: res.imported ?? trades.length, failed: res.failed ?? errors.length, errors });
      setStep(4);
      onSuccess?.();
    } catch (err: any) {
      setError(err?.data?.message || err?.message || t('tradeImport.importError'));
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setStep(0); setHeaders([]); setRows([]); setFileName('');
    setMapping([]); setImporting(false); setResult(null); setError('');
    onClose();
  };

  const steps = [
    t('tradeImport.step1'),
    t('tradeImport.step2'),
  ];

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth
      slotProps={{ paper: { sx: { bgcolor: '#0f172a', color: '#f1f5f9', maxHeight: '90vh' } } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{t('tradeImport.title')}</Typography>
          <Typography variant="caption" sx={{ color: '#64748b' }}>{t('tradeImport.subtitle')}</Typography>
        </Box>
        {step < 4 && (
          <Chip label={t('tradeImport.stepIndicator', { current: step + 1, total: 2 })} size="small"
            sx={{ bgcolor: '#1e293b', color: '#94a3b8', fontSize: 11 }} />
        )}
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        {step < 4 && (
          <Stepper activeStep={step} sx={{ px: 3, py: 2, bgcolor: '#1e293b' }} alternativeLabel>
            {steps.map(label => (
              <Step key={label}><StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: 12, color: '#64748b' } }}>{label}</StepLabel></Step>
            ))}
          </Stepper>
        )}

        <Box sx={{ p: 3 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {/* Step 0: Upload */}
          {step === 0 && (
            <Box>
              <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>{t('tradeImport.brokerPreset')}</InputLabel>
                  <Select
                    label={t('tradeImport.brokerPreset')}
                    value={brokerPreset}
                    onChange={(e) => {
                      const key = e.target.value as BrokerPresetKey;
                      setBrokerPreset(key);
                      const preset = getBrokerPreset(key);
                      setSourceTimezone(preset.defaultTimezone);
                      setDefaultQuoteCurrency(preset.defaultQuoteCurrency);
                      if (headers.length) {
                        setMapping(buildColumnMapping(headers, key));
                      }
                    }}
                  >
                    {BROKER_PRESETS.map((p) => (
                      <MenuItem key={p.key} value={p.key}>
                        {i18n.language.startsWith('zh') ? p.labelZh : p.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>{t('tradeImport.sourceTimezone')}</InputLabel>
                  <Select label={t('tradeImport.sourceTimezone')} value={sourceTimezone} onChange={(e) => setSourceTimezone(e.target.value)}>
                    {COMMON_TIMEZONES.map((tz) => <MenuItem key={tz} value={tz}>{tz}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>{t('tradeImport.defaultCurrency')}</InputLabel>
                  <Select label={t('tradeImport.defaultCurrency')} value={defaultQuoteCurrency} onChange={(e) => setDefaultQuoteCurrency(e.target.value)}>
                    {SUPPORTED_CURRENCIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>
              <Box
                onDrop={handleDrop} onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  border: '2px dashed #334155', borderRadius: 2, p: 6, textAlign: 'center', cursor: 'pointer',
                  bgcolor: '#1e293b', transition: 'all 0.2s',
                  '&:hover': { borderColor: '#3b82f6', bgcolor: '#1e293b' },
                }}
              >
                <CloudUploadIcon sx={{ fontSize: 48, color: '#3b82f6', mb: 2 }} />
                <Typography variant="h6" sx={{ mb: 1 }}>{t('tradeImport.dragDrop')}</Typography>
                <Typography variant="body2" sx={{ color: '#64748b' }}>{t('tradeImport.supportedFormats')}</Typography>
                <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
                  onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
              </Box>

              {fileName && (
                <Box sx={{ mt: 2, p: 2, bgcolor: '#1e293b', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <UploadFileIcon sx={{ color: '#3b82f6' }} />
                    <Typography sx={{ fontSize: 14 }}>{t('tradeImport.fileSelected')} {fileName}</Typography>
                    <Typography sx={{ fontSize: 12, color: '#64748b' }}>({rows.length} {t('common.rows')})</Typography>
                  </Box>
                  <Button size="small" onClick={() => { setHeaders([]); setRows([]); setFileName(''); setMapping([]); }}>{t('tradeImport.clearFile')}</Button>
                </Box>
              )}

              <Box sx={{ mt: 3, p: 2, bgcolor: '#1e293b', borderRadius: 1 }}>
                <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>{t('tradeImport.downloadTemplate')}</Typography>
                <Typography variant="caption" sx={{ color: '#475569', display: 'block', mb: 1 }}>{t('tradeImport.templateDescription')}</Typography>
                <Button size="small" startIcon={<DownloadIcon />} onClick={downloadTemplate} variant="outlined">
                  {t('tradeImport.downloadTemplate')}
                </Button>
              </Box>
            </Box>
          )}

          {/* Step 1: Map Fields */}
          {step === 1 && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>{t('tradeImport.mappingInstructions')}</Alert>
              <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
                <Chip label={t('tradeImport.allMapped', { count: mappedCount })} color="success" size="small"
                  icon={<CheckCircleIcon fontSize="small" />} sx={{ bgcolor: '#14532d', color: '#86efac' }} />
                {skippedCount > 0 && <Chip label={t('tradeImport.unmappedColumns', { count: skippedCount })} color="warning" size="small" />}
              </Box>
              <TableContainer sx={{ maxHeight: 400 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#1e293b' }}>
                      <TableCell sx={{ color: '#94a3b8', fontWeight: 600 }}>{t('tradeImport.sourceColumn')}</TableCell>
                      <TableCell sx={{ color: '#94a3b8', fontWeight: 600 }}>{t('tradeImport.targetField')}</TableCell>
                      <TableCell sx={{ color: '#94a3b8', fontWeight: 600 }}>状态</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {mapping.map((col, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell sx={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: 13 }}>{col.sourceColumn}</TableCell>
                        <TableCell>
                          <FormControl size="small" fullWidth>
                            <Select
                              value={col.targetKey}
                              onChange={e => handleMappingChange(idx, e.target.value as TargetKey)}
                              sx={{ fontSize: 13, color: '#e2e8f0', bgcolor: '#1e293b', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#334155' } }}
                            >
                              <MenuItem value="skip"><em>{t('tradeImport.skipColumn')}</em></MenuItem>
                              {TARGET_FIELDS.map(f => (
                                <MenuItem key={f.key} value={f.key}>
                                  {f.label} {f.required && <Typography component="span" sx={{ color: '#ef4444', fontSize: 11, ml: 0.5 }}>*</Typography>}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell>
                          {col.targetKey === 'skip' ? (
                            <Chip label={t('tradeImport.unmapped')} size="small" sx={{ bgcolor: '#78350f', color: '#fde68a', fontSize: 10 }} />
                          ) : col.isAutoMapped ? (
                            <Chip label={t('tradeImport.autoMapped')} size="small" sx={{ bgcolor: '#14532d', color: '#86efac', fontSize: 10 }} />
                          ) : (
                            <Chip label="手动" size="small" sx={{ bgcolor: '#1e3a5f', color: '#93c5fd', fontSize: 10 }} />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {headers.length > 0 && rows.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, color: '#94a3b8' }}>{t('tradeImport.previewRows', { count: Math.min(rows.length, 5) })}</Typography>
                  <TableContainer sx={{ maxHeight: 200 }}>
                    <Table size="small">
                      <TableHead><TableRow sx={{ bgcolor: '#1e293b' }}>
                        {headers.map(h => <TableCell key={h} sx={{ color: '#94a3b8', fontSize: 11, fontWeight: 600 }}>{h}</TableCell>)}
                      </TableRow></TableHead>
                      <TableBody>
                        {rows.slice(0, 5).map((row, ri) => (
                          <TableRow key={ri}>
                            {headers.map((h, ci) => (
                              <TableCell key={ci} sx={{ color: '#cbd5e1', fontSize: 11, fontFamily: 'monospace' }}>{row[h]}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Box>
          )}

          {/* Step 4: Result */}
          {step === 3 && result && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              {result.failed === 0 ? (
                <CheckCircleIcon sx={{ fontSize: 64, color: '#22c55e', mb: 2 }} />
              ) : (
                <ErrorIcon sx={{ fontSize: 64, color: '#f59e0b', mb: 2 }} />
              )}
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>{t('tradeImport.importComplete')}</Typography>
              <Typography variant="h6" sx={{ color: '#22c55e', mb: 2 }}>
                {t('tradeImport.importSummary', { success: result.imported, failed: result.failed })}
              </Typography>
              {result.errors.length > 0 && (
                <Box sx={{ textAlign: 'left', mt: 2, p: 2, bgcolor: '#1e293b', borderRadius: 1, maxHeight: 150, overflow: 'auto' }}>
                  {result.errors.slice(0, 10).map((e, i) => (
                    <Typography key={i} variant="caption" sx={{ color: '#f59e0b', display: 'block', fontFamily: 'monospace' }}>{e}</Typography>
                  ))}
                  {result.errors.length > 10 && (
                    <Typography variant="caption" sx={{ color: '#64748b' }}>...and {result.errors.length - 10} more</Typography>
                  )}
                </Box>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, bgcolor: '#0f172a' }}>
        {step < 2 ? (
          <>
            <Button onClick={step === 0 ? handleClose : () => setStep(s => s - 1)}>
              {step === 0 ? t('common.cancel') : t('common.back')}
            </Button>
            <Button
              variant="contained"
              disabled={
                (step === 0 && !canProceedToMapping) ||
                (step === 1 && !canProceedToConfirm) ||
                importing
              }
              onClick={() => step === 1 ? handleImport() : setStep(s => s + 1)}
            >
              {importing ? <CircularProgress size={20} /> : step === 1 ? t('tradeImport.import') : t('common.next')}
            </Button>
          </>
        ) : (
          <Button variant="contained" onClick={handleClose}>{t('common.close')}</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
