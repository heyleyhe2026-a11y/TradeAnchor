import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Typography, Box, Card, CardContent, Chip, LinearProgress, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, Avatar,
  Button, Select, MenuItem, Pagination,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import HistoryIcon from '@mui/icons-material/History';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { useGetCreditBalanceQuery, useGetCreditHistoryQuery } from '../../store/creditApi';

const SOURCE_LABELS: Record<string, { zh: string; en: string }> = {
  trade_creation: { zh: '创建交易记录', en: 'Trade Created' },
  daily_checkin: { zh: '每日签到', en: 'Daily Check-in' },
  task_reward: { zh: '任务奖励', en: 'Task Reward' },
  report_generation: { zh: 'AI 报告生成', en: 'AI Report Generated' },
  follow_up_question: { zh: 'AI 追问', en: 'AI Follow-up' },
  purchase: { zh: '购买积分', en: 'Credits Purchased' },
  attachment_download_reward: { zh: '附件下载奖励', en: 'Attachment Download Reward' },
};

/** Translate per-action credit descriptions — amounts omitted since Amount column already shows it */
const TASK_DESCRIPTION_MAP: Record<string, { zh: string; en: string }> = {
  first_playbook:      { zh: '发布帖子',              en: 'Post Published' },
  publish_3_playbooks: { zh: '发布帖子',              en: 'Post Published' },
  first_diary_entry:   { zh: '写下第一篇交易日记',     en: 'First Diary Entry' },
  diary_entries_7:     { zh: '写交易日记',            en: 'Diary Entry Written' },
  ai_reports_5:        { zh: '生成 AI 报告',          en: 'AI Report Generated' },
  ai_chat_10:          { zh: 'AI 追问对话',           en: 'AI Follow-up' },
  first_trade:         { zh: '创建第一笔交易',         en: 'First Trade Recorded' },
  first_ai_report:     { zh: '生成第一份 AI 报告',     en: 'First AI Report Generated' },
  import_trades:       { zh: '导入交易数据',          en: 'Trade Data Imported' },
  verify_email:        { zh: '验证邮箱地址',          en: 'Email Verified' },
  first_purchase:      { zh: '购买付费帖子',           en: 'Purchase Paid Post' },
  first_browse_post:   { zh: '首次浏览帖子',            en: 'First Post Browse' },
};

/**
 * Chinese → English mapping for consumption descriptions.
 * Matches Chinese action prefixes found in DB description strings.
 * IMPORTANT: More specific patterns MUST come before broader ones to avoid incorrect matches!
 */
const CONSUMPTION_I18N_MAP: Array<{ zhPattern: RegExp; enLabel: string }> = [
  { zhPattern: /生成\s*AI\s*报告/i,          enLabel: 'AI Report' },
  { zhPattern: /AI\s*报告/i,                  enLabel: 'AI Report' },
  { zhPattern: /AI\s*追问|追问对话/i,         enLabel: 'AI Follow-up' },
  { zhPattern: /浏览.*策略|浏览.*帖子|首次浏览/i,  enLabel: 'Post Browse' },
  { zhPattern: /写交易日记|交易日记/i,         enLabel: 'Diary Entry' },
  /** Download attachment — preserve full detail (author/post/filename), DO NOT map to generic label.
   *  Must be placed BEFORE the generic /帖子/ pattern since download desc contains "帖子" */
  { zhPattern: /下载.*帖子.*附件|下载.*附件.*帖子|Download attachment.*from.*post/i, enLabel: '__KEEP_DETAIL__' },
  { zhPattern: /发布帖子/i,                   enLabel: 'Post Published' },
  { zhPattern: /浏览社区广场|浏览广场/i,       enLabel: 'Plaza Browse' },
  { zhPattern: /导入交易数据/i,               enLabel: 'Trade Import' },
  { zhPattern: /创建第一笔交易|创建交易/i,     enLabel: 'Trade Created' },
  { zhPattern: /付费阅读|解锁/i,              enLabel: 'Paid Read' },
];

/** Strip amount suffix and translate Chinese consumption desc → clean i18n label */
function translateConsumptionDescription(rawDesc: string | undefined, isZh: boolean): string {
  if (!rawDesc) return isZh ? '积分已使用' : 'Credits Used';

  // Handle bilingual format: "中文|||English"
  if (rawDesc.includes('|||')) {
    const parts = rawDesc.split('|||');
    const target = isZh ? parts[0] : (parts[1] || parts[0]);
    return cleanConsumptionLabel(target, isZh);
  }

  // Monolingual fallback
  const cleaned = rawDesc
    .replace(/获得?\+?[\d]+\s*积分?/gi, '')
    .replace(/消耗-?[\d]+\s*积分?/gi, '')
    .replace(/spent\s*[\d]+\s*credits?/gi, '')
    .replace(/[-+]?[\d]+\s*credits?/gi, '')
    .trim();

  if (isZh) return cleaned || '积分已使用';
  for (const entry of CONSUMPTION_I18N_MAP) {
    if (entry.zhPattern.test(rawDesc)) return entry.enLabel;
  }
  return cleaned || 'Credits Used';
}

/** Remove all amount digits and noise words from a consumption label */
function cleanConsumptionLabel(text: string, isZh: boolean): string {
  let cleaned = text
    // Strip amounts with units (both CN & EN)
    .replace(/[-+]?\d+\s*积分?/g, '')
    .replace(/[-+]?\d+\s*credits?/gi, '')
    // Strip noise verbs/connectors
    .replace(/消耗[-\s]*/g, '')
    .replace(/\s*Generated\s*/gi, '')
    .replace(/\s*-\s*$/g, '')
    .replace(/^\s*-\s*/g, '')
    .trim();
  if (!cleaned) return isZh ? '积分已使用' : 'Credits Used';

  // For EN labels, try mapping to standard i18n terms for consistency
  if (!isZh) {
    for (const entry of CONSUMPTION_I18N_MAP) {
      if (entry.zhPattern.test(text)) {
        // __KEEP_DETAIL__ sentinel: preserve full detail instead of generic label
        if (entry.enLabel === '__KEEP_DETAIL__') return cleaned;
        return entry.enLabel;
      }
    }
  }
  return cleaned;
}

/** Resolve display text for Action/Source column */
function resolveDescription(record: any, isZh: boolean): string {
  const isConsumed = !!record.consumed;

  // Consumed records: show what it was SPENT ON (description set by spendCredits),
  // not where it originally came from (taskKey/earning reason).
  if (isConsumed) {
    const desc = record.description || '';
    // Only skip descriptions that are earning-related (contain "获得")
    if (desc && !desc.includes('获得')) {
      return translateConsumptionDescription(desc, isZh);
    }
    // Fallback: generic i18n consumption label
    return isZh ? '积分已使用' : 'Credits Used';
  }

  // Active (earned) records: use i18n task label
  if (record.taskKey && TASK_DESCRIPTION_MAP[record.taskKey]) {
    const label = TASK_DESCRIPTION_MAP[record.taskKey];
    return isZh ? label.zh : label.en;
  }

  // Fallback: clean up raw DB description — support bilingual format "中文|||English"
  const raw = record.description || '';
  if (raw.includes('|||')) {
    const parts = raw.split('|||');
    const selected = isZh ? parts[0] : (parts[1] || parts[0]);
    return selected.replace(/[-+]?\d+\s*积分?/gi, '').replace(/[-+]?\d+\s*credits?/gi, '').trim() || formatSource(record.source || '', isZh);
  }
  const cleaned = raw.replace(/[-+]?\d+\s*积分?/gi, '').replace(/[-+]?\d+\s*credits?/gi, '').trim();
  return cleaned || formatSource(record.source || '', isZh);
}

function formatSource(source: string, isZh: boolean): string {
  const label = SOURCE_LABELS[source];
  if (label) return isZh ? label.zh : label.en;
  return source.replace(/_/g, ' ');
}

export default function CreditsPage() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const { data: balanceData } = useGetCreditBalanceQuery({} as any);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { data: hist } = useGetCreditHistoryQuery({ page, limit: pageSize } as any);

  const balance = balanceData?.data || balanceData || {};
  const total = balance?.total || 0;
  const available = balance?.available || 0;
  const expiringSoon = balance?.expiringSoon || 0;
  const pct = Math.min(100, (total / 200) * 100);
  const credits = hist?.credits || [];
  const totalPages = hist?.pages || 1;

  // Separate into earned and consumed, then merge same-minute duplicate consumption records
  const rawRecords = credits.map((c: any) => ({
    ...c,
    type: c.consumed ? 'spent' as const : 'earned' as const,
  })).sort((a: any, b: any) => {
    const dateA = new Date(a.consumedAt || a.earnedAt).getTime();
    const dateB = new Date(b.consumedAt || b.earnedAt).getTime();
    return dateB - dateA;
  });

  /** Merge records that share the same (minute-granularity timestamp + description key + consumed status) */
  function mergeRecords(records: any[]): any[] {
    const merged = new Map<string, any>();
    for (const r of records) {
      const ts = new Date(r.consumedAt || r.earnedAt);
      // Group key: minute-level timestamp + resolved description category + status
      const minuteKey = `${ts.getFullYear()}-${ts.getMonth()}-${ts.getDate()}T${ts.getHours()}:${ts.getMinutes()}`;
      const descKey = (r.description || r.source || r.taskKey || 'unknown').replace(/[-+]?\d+\s*积分?/gi, '').replace(/[-+]?\d+\s*credits?/gi, '').trim().slice(0, 30);
      const groupKey = `${minuteKey}|${descKey}|${r.consumed ? 'spent' : 'earned'}`;

      if (merged.has(groupKey)) {
        const existing = merged.get(groupKey);
        existing.amount += r.amount;           // Sum amounts
        existing._mergeCount = (existing._mergeCount || 1) + 1;
        // Keep the earliest expiresAt for earned records
        if (!r.consumed && r.expiresAt && (!existing.expiresAt || new Date(r.expiresAt) < new Date(existing.expiresAt))) {
          existing.expiresAt = r.expiresAt;
        }
      } else {
        merged.set(groupKey, { ...r, _mergeCount: 1 });
      }
    }
    return Array.from(merged.values());
  }

  const allRecords = mergeRecords(rawRecords);

  /** Export current page (or all) records as CSV */
  const handleExportCsv = () => {
    const headers = isZh
      ? ['时间', '动作/来源', '数量', '状态', '有效期至']
      : ['Time', 'Action/Source', 'Amount', 'Status', 'Valid Until'];
    const rows = allRecords.map((r: any) => {
      const timestamp = r.consumedAt || r.earnedAt;
      const isEarned = !r.consumed;
      const isExpired = !r.consumed && new Date(r.expiresAt) < new Date();
      const expiresStr = r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : '-';
      const statusLabel = isExpired
        ? (isZh ? '已过期' : 'Expired')
        : isEarned
          ? (isZh ? '有效' : 'Active')
          : (isZh ? '已使用' : 'Used');
      return [
        new Date(timestamp).toLocaleString(),
        resolveDescription(r, isZh),
        `${isEarned ? '+' : '-'}${r.amount}`,
        statusLabel,
        expiresStr,
      ];
    });
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `TradeAnchor_Credits_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /** Reset to page 1 when page size changes */
  const handlePageSizeChange = (e: React.ChangeEvent<{ value: unknown }>) => {
    setPageSize(Number(e.target.value));
    setPage(1);
  };

  return (
    <Box sx={{ py: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 700 }} gutterBottom>{t('credits.title')}</Typography>

      {/* Balance Card */}
      <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <StarIcon sx={{ fontSize: 48, opacity: 0.8, mb: 1 }} />
          <Typography variant="h2" sx={{ fontWeight: 700 }}>{total.toLocaleString()}</Typography>
          <Typography variant="body1" sx={{ opacity: 0.9 }}>{t('credits.available')}</Typography>

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 4, px: 4 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>{isZh ? '可用积分' : 'Available'}</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{available.toLocaleString()}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.3)' }} />
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>{isZh ? '即将过期' : 'Expiring Soon'}</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: expiringSoon > 0 ? '#ffd54f' : 'white' }}>{expiringSoon}</Typography>
            </Box>
          </Box>

          <Box sx={{ mt: 2, px: 4 }}>
            <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.3)', '& .Mui-progress-bar': { bgcolor: 'white' } }} />
          </Box>
        </CardContent>
      </Card>

      {/* Expiry Warning */}
      {expiringSoon > 0 && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          <Typography variant="body2">
            <strong>{expiringSoon}</strong> {isZh ? ' 积分将在 3 天内过期' : ' credits expiring within 3 days'}
          </Typography>
        </Alert>
      )}

      {/* Detailed Transaction History */}
      <Typography variant="h6" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <HistoryIcon fontSize="small" />
        {isZh ? '积分获取与消耗明细' : 'Credits Transaction Details'}
      </Typography>
      <Card sx={{ overflow: 'visible' }}>
        {allRecords.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, pb: 0 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={handleExportCsv}
              sx={{ textTransform: 'none', fontSize: '0.8rem' }}
            >
              {isZh ? '导出 CSV' : 'Export CSV'}
            </Button>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {isZh ? '每页' : 'Per page'}
              </Typography>
              <Select
                size="small"
                value={pageSize}
                onChange={handlePageSizeChange as any}
                sx={{ fontSize: '0.85rem', minWidth: 70 }}
              >
                {[10, 20, 50, 100].map(n => (
                  <MenuItem key={n} value={n}>{n}</MenuItem>
                ))}
              </Select>
            </Box>
          </Box>
        )}
        {!allRecords.length ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <StarIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
            <Typography color="text.secondary">{t('credits.noActivity')}</Typography>
          </Box>
        ) : (
          <>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>{isZh ? '时间' : 'Time'}</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>{isZh ? '动作 / 来源' : 'Action / Source'}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: 'text.primary' }}>{isZh ? '数量' : 'Amount'}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: 'text.primary' }}>{isZh ? '状态' : 'Status'}</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>{isZh ? '有效期至' : 'Valid Until'}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allRecords.map((record: any) => {
                  const isEarned = !record.consumed;
                  const isExpired = !record.consumed && new Date(record.expiresAt) < new Date();
                  const timestamp = record.consumedAt || record.earnedAt;
                  const dateStr = new Date(timestamp).toLocaleString();
                  const expiresStr = record.expiresAt
                    ? `${new Date(record.expiresAt).toLocaleDateString()}`
                    : '-';

                  return (
                    <TableRow
                      key={record.id}
                      hover
                      sx={{
                        '&:last-child td': { border: 0 },
                        bgcolor: isEarned && !isExpired ? 'rgba(74,222,128,0.04)' :
                                   isExpired ? 'rgba(239,68,68,0.04)' : 'transparent',
                      }}
                    >
                      <TableCell>
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>{dateStr}</Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar
                            sx={{
                              width: 28, height: 28,
                              bgcolor: isEarned ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)',
                              color: isEarned ? '#4ade80' : '#ef4444',
                            }}
                          >
                            {isEarned
                              ? <TrendingUpIcon sx={{ fontSize: 16 }} />
                              : <TrendingDownIcon sx={{ fontSize: 16 }} />}
                          </Avatar>
                          <Typography variant="body2">
                            {resolveDescription(record, isZh)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 700,
                            color: isEarned ? '#4ade80' : '#ef4444',
                          }}
                        >
                          {isEarned ? '+' : '-'}{record.amount}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={
                            isExpired ? t('credits.expired')
                              : isEarned ? t('credits.active')
                                : t('credits.used')
                          }
                          size="small"
                          variant="outlined"
                          color={
                            isExpired ? 'error'
                              : isEarned ? 'success'
                                : 'default'
                          }
                          sx={{ fontSize: '0.7rem', height: 22 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="caption"
                          sx={{
                            color: isExpired ? '#ef4444' : '#64748b',
                            textDecorationLine: isExpired ? 'line-through' : undefined,
                          }}
                        >
                          {expiresStr}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2, px: 1 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, v) => setPage(v)}
                shape="rounded"
                size="small"
                color="primary"
              />
            </Box>
          )}
          </>
        )}
      </Card>
    </Box>
  );
}
