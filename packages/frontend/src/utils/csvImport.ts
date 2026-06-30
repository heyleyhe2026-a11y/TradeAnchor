import { getBrokerPreset, type BrokerPresetKey } from './brokerPresets';

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

function parseRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/** MT5 exports duplicate headers like Time/Price for open vs close. */
export function dedupeHeaders(headers: string[]): string[] {
  const counts = new Map<string, number>();
  return headers.map((header) => {
    const base = header.trim();
    const key = base.toLowerCase();
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    return count === 1 ? base : `${base}__${count}`;
  });
}

/** Schwab exports include account metadata rows before the real header. */
export function findHeaderRowIndex(lines: string[], presetKey: BrokerPresetKey): number {
  const preset = getBrokerPreset(presetKey);
  if (preset.headerRowIndex != null) {
    return preset.headerRowIndex;
  }

  const maxScan = Math.min(lines.length, 25);
  for (let i = 0; i < maxScan; i++) {
    const line = lines[i]?.trim();
    if (!line || !line.includes(',')) continue;

    const lower = line.toLowerCase();
    if (presetKey === 'schwab') {
      if (
        lower.includes('symbol') &&
        (lower.includes('acquired') ||
          lower.includes('opened date') ||
          lower.includes('closed date'))
      ) {
        return i;
      }
    }
    if (presetKey === 'ibkr') {
      if (lower.includes('symbol') && (lower.includes('datetime') || lower.includes('date/time'))) {
        return i;
      }
    }
    if (presetKey === 'futu' || presetKey === 'tiger') {
      if (
        (line.includes('代码') || lower.includes('symbol')) &&
        (line.includes('建仓') || line.includes('平仓') || lower.includes('open time'))
      ) {
        return i;
      }
    }
  }

  return 0;
}

export function parseImportCsv(text: string, presetKey: BrokerPresetKey = 'generic'): ParsedCsv {
  const lines = text.trim().split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }

  const headerRowIndex = findHeaderRowIndex(lines, presetKey);
  const rawHeaders = parseRow(lines[headerRowIndex]);
  const headers = dedupeHeaders(rawHeaders.map((h) => h.replace(/^"|"$/g, '')));

  const rows = lines.slice(headerRowIndex + 1).map((line) => {
    const values = parseRow(line).map((v) => v.replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? '';
    });
    return row;
  });

  return { headers, rows };
}
