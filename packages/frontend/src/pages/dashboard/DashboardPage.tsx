import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AddIcon from '@mui/icons-material/Add';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import PsychologyIcon from '@mui/icons-material/Psychology';
import BookIcon from '@mui/icons-material/Book';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import { useGetDashboardStatsQuery } from '../../store/dashboardApi';
import AiConfidenceCard from '../../components/AiConfidenceCard';
import CalendarView from '../../components/CalendarView';
import { fmtSignedCurrency, fmtCurrency, fmtPercent, fmtDollar } from '../../utils/format';
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  AreaChart,
} from 'recharts';

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dashSymbolFilter, setDashSymbolFilter] = useState('');
  const [dashDirectionFilter, setDashDirectionFilter] = useState<string>('');
  const [dashStartDate, setDashStartDate] = useState<Date | null>(null);
  const [dashEndDate, setDashEndDate] = useState<Date | null>(null);

  const fmtLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  const { data: stats, isLoading } = useGetDashboardStatsQuery({
    ...(dashSymbolFilter && { symbol: dashSymbolFilter }),
    ...(dashDirectionFilter && { direction: dashDirectionFilter }),
    ...(dashStartDate && { startDate: fmtLocal(dashStartDate) }),
    ...(dashEndDate && { endDate: fmtLocal(dashEndDate) }),
  });

  const overview = stats?.overview ?? {
    totalTrades: 0, totalInvestment: 0, totalPnL: 0, netPnL: 0,
    winRate: 0, avgPnL: 0, profitFactor: 0, roi: 0
  };
  const displayCurrency = overview.displayCurrency ?? 'USD';
  const displayPnL = overview.netPnL ?? overview.totalPnL;
  const breakdown = stats?.breakdown ?? {
    winning: 0, losing: 0, breakEven: 0, avgWin: 0, avgLoss: 0
  };

  // Compute cumulative P&L from monthly data for the curve chart
  const pnlCurveData = (() => {
    if (!stats?.monthlyPnL || stats.monthlyPnL.length === 0) return [];
    const sorted = [...stats.monthlyPnL].sort((a, b) => a.month.localeCompare(b.month));
    let cumulative = 0;
    // Start from origin (0, 0) so the curve begins at zero
    const result = [
      { month: '', monthlyPnl: 0, cumulativePnl: 0 },
      ...sorted.map(item => {
        cumulative += item.pnl;
        return {
          month: item.month,
          monthlyPnl: item.pnl,
          cumulativePnl: cumulative,
        };
      }),
    ];
    return result;
  })();

  const quickLinks = [
    { label: t('dashboard.addTradeBtn'), icon: <ShowChartIcon fontSize="small" />, path: '/trades', color: '#00d4aa' as const },
    { label: t('dashboard.aiReportsNav'), icon: <PsychologyIcon fontSize="small" />, path: '/ai-reports', color: '#a78bfa' as const },
    { label: t('dashboard.tradingDiary'), icon: <BookIcon fontSize="small" />, path: '/diary', color: '#fbbf24' as const },
    { label: t('dashboard.playbooksNav'), icon: <AutoStoriesIcon fontSize="small" />, path: '/playbooks', color: '#f472b6' as const },
  ];

  return (
    <Box>
      {/* Welcome Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
          {t('dashboard.welcomeBack')}
        </Typography>
        <Typography variant="body2" sx={{ color: '#94a3b8' }}>
          {t('dashboard.welcomeSubtitle')}
        </Typography>
      </Box>

      {/* Filter Bar */}
      <Card sx={{ mb: 3, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}><CardContent>
        <Typography variant="subtitle2" sx={{ color:'#94a3b8', mb:1.5, fontWeight:600 }}>{t('trades.filters.title')}</Typography>
        <Box sx={{ display:'flex', gap:2, flexWrap:'wrap', alignItems:'center' }}>
          <TextField
            size="small"
            label={t('trades.symbol')}
            value={dashSymbolFilter}
            onChange={(e) => setDashSymbolFilter(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root':{ bgcolor:'rgba(255,255,255,0.04)', borderColor:'rgba(255,255,255,0.12)','& fieldset':{borderColor:'rgba(255,255,255,0.12)'},'&:hover fieldset':{borderColor:'rgba(255,255,255,0.25)'},'&.Mui-focused fieldset':{borderColor:'#00d4aa'} },'& .MuiInputLabel-root':{color:'#94a3b8'} }}
          />
          <FormControl size="small" sx={{ minWidth:120 }}>
            <InputLabel>{t('trades.direction')}</InputLabel>
            <Select value={dashDirectionFilter} label={t('trades.direction')} onChange={(e) => setDashDirectionFilter(e.target.value)} sx={{ bgcolor:'rgba(255,255,255,0.04)','.MuiOutlinedInput-notchedOutline':{borderColor:'rgba(255,255,255,0.12)'},'&:hover .MuiOutlinedInput-notchedOutline':{borderColor:'rgba(255,255,255,0.25)'},'&.Mui-focused .MuiOutlinedInput-notchedOutline':{borderColor:'#00d4aa'},color:'#e2e8f0'}}>
              <MenuItem value="">{t('common.all')}</MenuItem>
              <MenuItem value="long">{t('trades.long')}</MenuItem>
              <MenuItem value="short">{t('trades.short')}</MenuItem>
            </Select>
          </FormControl>
          <DatePicker
            label={t('trades.filters.startDate')}
            value={dashStartDate}
            onChange={(val) => setDashStartDate(val)}
            slotProps={{
              textField: {
                size: 'small',
                sx: { '& .MuiOutlinedInput-root':{ bgcolor:'rgba(255,255,255,0.04)', borderColor:'rgba(255,255,255,0.12)','& fieldset':{borderColor:'rgba(255,255,255,0.12)'},'&:hover fieldset':{borderColor:'rgba(255,255,255,0.25)'},'&.Mui-focused fieldset':{borderColor:'#00d4aa'} },'& .MuiInputLabel-root':{color:'#94a3b8'} }
              },
              actionBar: { actions: ['clear'] },
            }}
            format="yyyy/MM/dd"
          />
          <DatePicker
            label={t('trades.filters.endDate')}
            value={dashEndDate}
            onChange={(val) => setDashEndDate(val)}
            slotProps={{
              textField: {
                size: 'small',
                sx: { '& .MuiOutlinedInput-root':{ bgcolor:'rgba(255,255,255,0.04)', borderColor:'rgba(255,255,255,0.12)','& fieldset':{borderColor:'rgba(255,255,255,0.12)'},'&:hover fieldset':{borderColor:'rgba(255,255,255,0.25)'},'&.Mui-focused fieldset':{borderColor:'#00d4aa'} },'& .MuiInputLabel-root':{color:'#94a3b8'} }
              },
              actionBar: { actions: ['clear'] },
            }}
            format="yyyy/MM/dd"
          />
        </Box>
      </CardContent></Card>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Stats Cards - Row of 7 */}
          <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
            <Card sx={{ flex: '1 0 0' }}><CardContent sx={{ textAlign: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="body2" sx={{ color: '#64748b', display: 'block', mb: 0.25, fontSize: '15px' }}>{t('dashboard.trades')}</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '16px', color: '#60a5fa' }}>{overview.totalTrades}</Typography>
            </CardContent></Card>
            <Card sx={{ flex: '1 0 0' }}><CardContent sx={{ textAlign: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="body2" sx={{ color: '#64748b', display: 'block', mb: 0.25, fontSize: '15px' }}>{t('dashboard.investment')}</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '16px', color: '#fbbf24' }}>{fmtDollar(overview.totalInvestment, displayCurrency)}</Typography>
            </CardContent></Card>
            <Card sx={{ bgcolor: displayPnL >= 0 ? 'rgba(0,212,170,0.08)' : 'rgba(239,71,111,0.08)', flex: '1 0 0' }}>
              <CardContent sx={{ textAlign: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="body2" sx={{ color: '#64748b', display: 'block', mb: 0.25, fontSize: '15px' }}>{t('dashboard.totalPnL')}</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '16px', color: displayPnL >= 0 ? '#00d4aa' : '#ef476f' }}>
                  {fmtSignedCurrency(displayPnL, displayCurrency)}
                </Typography>
              </CardContent></Card>
            <Card sx={{ flex: '1 0 0' }}><CardContent sx={{ textAlign: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="body2" sx={{ color: '#64748b', display: 'block', mb: 0.25, fontSize: '15px' }}>{t('dashboard.winRate')}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                {overview.winRate >= 50
                  ? <TrendingUpIcon sx={{ color: '#00d4aa', fontSize: 16 }} />
                  : <TrendingDownIcon sx={{ color: '#ef476f', fontSize: 16 }} />
                }
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '16px', color: overview.winRate >= 50 ? '#00d4aa' : '#ef476f' }}>{fmtPercent(overview.winRate)}</Typography>
              </Box>
            </CardContent></Card>
            <Card sx={{ flex: '1 0 0' }}><CardContent sx={{ textAlign: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="body2" sx={{ color: '#64748b', display: 'block', mb: 0.25, fontSize: '15px' }}>{t('dashboard.avgPnL')}</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '16px', color: '#a78bfa' }}>{fmtDollar(overview.avgPnL, displayCurrency)}</Typography>
            </CardContent></Card>
            <Card sx={{ flex: '1 0 0' }}><CardContent sx={{ textAlign: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="body2" sx={{ color: '#64748b', display: 'block', mb: 0.25, fontSize: '15px' }}>{t('dashboard.profitFactor')}</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '16px', color: '#f472b6' }}>
                {(typeof overview.profitFactor === 'number' && !isFinite(overview.profitFactor))
                  ? '\u221e'
                  : fmtCurrency(overview.profitFactor ?? 0)
                }
              </Typography>
            </CardContent></Card>
            <Card sx={{ bgcolor: overview.roi >= 0 ? 'rgba(0,212,170,0.08)' : 'rgba(239,71,111,0.08)', flex: '1 0 0' }}>
              <CardContent sx={{ textAlign: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="body2" sx={{ color: '#64748b', display: 'block', mb: 0.25, fontSize: '15px' }}>{t('dashboard.roi')}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                  {overview.roi >= 0
                    ? <TrendingUpIcon sx={{ color: '#00d4aa', fontSize: '16px' }} />
                    : <TrendingDownIcon sx={{ color: '#ef476f', fontSize: '16px' }} />
                  }
                  <Typography variant="body1" sx={{ fontWeight: 700, fontSize: '16px', color: overview.roi >= 0 ? '#00d4aa' : '#ef476f' }}>
                    {fmtPercent(overview.roi)}
                  </Typography>
                </Box>
              </CardContent></Card>
          </Box>

          {/* Performance + Quick Links */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {/* Left: Performance Breakdown */}
            <Grid size={{ xs:12, lg:7 }}>
              <Card sx={{ height: '100%' }}><CardContent>
                <Typography variant="h6" gutterBottom>{t('dashboard.performanceBreakdown')}</Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs:4 }}>
                    <Box sx={{ p: 2, borderRadius: 2, textAlign: 'center', bgcolor: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.15)' }}>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: '#00d4aa' }}>{breakdown.winning}</Typography>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>{t('dashboard.wins')}</Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs:4 }}>
                    <Box sx={{ p: 2, borderRadius: 2, textAlign: 'center', bgcolor: 'rgba(239,71,111,0.08)', border: '1px solid rgba(239,71,111,0.15)' }}>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: '#ef476f' }}>{breakdown.losing}</Typography>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>{t('dashboard.losses')}</Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs:4 }}>
                    <Box sx={{ p: 2, borderRadius: 2, textAlign: 'center', bgcolor: 'rgba(255,209,102,0.08)', border: '1px solid rgba(255,209,102,0.15)' }}>
                      <Typography variant="h4" sx={{ fontWeight: 700 }}>{breakdown.breakEven}</Typography>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>{t('dashboard.breakEven')}</Typography>
                    </Box>
                  </Grid>
                </Grid>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid size={{ xs:6 }}>
                    <Box sx={{ p: 1.5, borderRadius: 1.5, textAlign: 'center', bgcolor: 'rgba(0,212,170,0.04)' }}>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>{t('dashboard.avgWin')}</Typography>
                      <Typography sx={{ fontWeight: 600, color: '#00d4aa' }}>{fmtSignedCurrency(breakdown.avgWin, displayCurrency)}</Typography>
                    </Box>
                  </Grid>
                  <Grid size={{ xs:6 }}>
                    <Box sx={{ p: 1.5, borderRadius: 1.5, textAlign: 'center', bgcolor: 'rgba(239,71,111,0.04)' }}>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>{t('dashboard.avgLoss')}</Typography>
                      <Typography sx={{ fontWeight: 600, color: '#ef476f' }}>{fmtSignedCurrency(breakdown.avgLoss, displayCurrency)}</Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent></Card>
            </Grid>

            {/* Right: Quick Navigation */}
            <Grid size={{ xs:12, lg:5 }}>
              <Card sx={{ height: '100%' }}><CardContent>
                <Typography variant="h6" gutterBottom>{t('dashboard.quickAccess')}</Typography>
                <Grid container spacing={1}>
                  {quickLinks.map((link) => (
                    <Grid size={{ xs:6, sm:4 }} key={link.path}>
                      <Button
                        fullWidth
                        startIcon={link.icon}
                        onClick={() => navigate(link.path)}
                        size="small"
                        sx={{
                          justifyContent: 'flex-start',
                          py: 1.3,
                          px: 1.5,
                          borderRadius: 2,
                          textTransform: 'none',
                          fontSize: '0.8rem',
                          color: link.color,
                          borderColor: `${link.color}30`,
                          '&:hover': {
                            bgcolor: `${link.color}10`,
                            borderColor: link.color,
                          },
                        }}
                        variant="outlined"
                      >
                        {link.label}
                      </Button>
                    </Grid>
                  ))}
                  <Grid size={12}>
                    <Button
                      variant="contained"
                      fullWidth
                      startIcon={<AddIcon />}
                      onClick={() => navigate('/trades')}
                      sx={{ mt: 1, py: 1.2 }}
                    >
                      {t('dashboard.recordNewTrade')}
                    </Button>
                  </Grid>
                </Grid>
              </CardContent></Card>
            </Grid>
          </Grid>

          {/* AI Confidence Score + P&L Curve */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexDirection: { xs: 'column', lg: 'row' } }}>
            {/* Left: AI Confidence Card - 1/3 width */}
            <Box sx={{ flex: { lg: '0 0 33.33%', xs: '1 0 100%' }, minWidth: { lg: 260, xs: 0 } }}>
              <AiConfidenceCard />
            </Box>

            {/* Right: P&L Curve - remaining width */}
            <Card sx={{ flex: '1 1 auto', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <CardContent>
              <Typography variant="h6" gutterBottom>{t('dashboard.pnlCurve')}</Typography>
              {pnlCurveData.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
                  <Typography variant="body2" sx={{ color: '#64748b' }}>{t('dashboard.pnlNoData')}</Typography>
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={pnlCurveData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="cumuGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="monthlyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
                      tickLine={false}
                      tickFormatter={(v: number) => `${(v >= 0 ? '' : '')}${(v / 1000).toFixed(1)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        color: '#e2e8f0',
                        fontSize: 13,
                      }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any, name: any) => [
                        fmtSignedCurrency(Number(value), displayCurrency),
                        String(name) === 'cumulativePnl' ? t('dashboard.pnlCumulative') : t('dashboard.pnlMonthly'),
                      ]}
                      labelFormatter={(label: any) => String(label)}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: 12 }}
                      content={({ payload }: any) => (
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: '300px' }}>
                          {payload?.map((entry: any, i: number) => (
                            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <svg width={10} height={10}>
                                {i === 0 ? (
                                  <circle cx={5} cy={5} r={4.5} fill="#00d4aa" />
                                ) : (
                                  <line x1={1} y1={5} x2={9} y2={5} stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="4 2" />
                                )}
                              </svg>
                              <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                                {entry.value === 'cumulativePnl' ? t('dashboard.pnlCumulative') : t('dashboard.pnlMonthly')}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      )}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumulativePnl"
                      stroke="#00d4aa"
                      strokeWidth={2}
                      fill="url(#cumuGradient)"
                      dot={false}
                      activeDot={{ r: 5, fill: '#00d4aa' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="monthlyPnl"
                      stroke="#a78bfa"
                      strokeWidth={1.5}
                      strokeDasharray="5 5"
                      fill="url(#monthlyGradient)"
                      dot={false}
                      activeDot={{ r: 4, fill: '#a78bfa' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          </Box>

          {/* Bottom row: Best/Worst Trades + Top Symbols */}
          <Grid container spacing={2}>
            {/* Best / Worst Trade cards */}
            {(stats?.bestTrade || stats?.worstTrade) && (
              <>
                {stats?.bestTrade && (
                  <Grid size={{ xs:12, sm:6, md:4 }}>
                    <Card sx={{ bgcolor: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.15)', height: '100%' }}>
                      <CardContent>
                        <Typography variant="body2" sx={{ color: '#00d4aa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                          {t('dashboard.bestTrade')}
                        </Typography>
                        <Typography variant="h6" sx={{ mt: 0.5, mb: 0.5 }}>{stats.bestTrade.tradingSymbol}</Typography>
                        <Typography variant="h5" sx={{ color: '#00d4aa', fontWeight: 700 }}>
                          {fmtSignedCurrency(stats.bestTrade.pnl, displayCurrency)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                )}
                {stats?.worstTrade && (
                  <Grid size={{ xs:12, sm:6, md:4 }}>
                    <Card sx={{ bgcolor: 'rgba(239,71,111,0.06)', border: '1px solid rgba(239,71,111,0.15)', height: '100%' }}>
                      <CardContent>
                        <Typography variant="body2" sx={{ color: '#ef476f', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                          {t('dashboard.worstTrade')}
                        </Typography>
                        <Typography variant="h6" sx={{ mt: 0.5, mb: 0.5 }}>{stats.worstTrade.tradingSymbol}</Typography>
                        <Typography variant="h5" sx={{ color: '#ef476f', fontWeight: 700 }}>
                          {fmtSignedCurrency(stats.worstTrade.pnl, displayCurrency)}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                )}
              </>
            )}

            {/* Top Symbols table */}
            {stats?.topSymbols && stats.topSymbols.length > 0 && (
              <Grid size={{ xs:12, sm: (stats?.bestTrade || stats?.worstTrade) ? 12 : 12, md: (stats?.bestTrade && stats?.worstTrade) ? 4 : 8 }}>
                <Card sx={{ height: '100%' }}><CardContent>
                  <Typography variant="h6" gutterBottom>{t('dashboard.topSymbols')}</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>{t('dashboard.symbol')}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>P&L</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600 }}>{t('dashboard.numTrades')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {stats.topSymbols.slice(0, 5).map((s) => (
                          <TableRow key={s.symbol} hover>
                            <TableCell sx={{ fontWeight: 600 }}>{s.symbol}</TableCell>
                            <TableCell align="right">
                              <Chip
                                size="small"
                                label={fmtSignedCurrency(s.pnl, displayCurrency)}
                                color={s.pnl >= 0 ? 'success' : 'error'}
                                variant="filled"
                                sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                              />
                            </TableCell>
                            <TableCell align="center"><Typography variant="body2">{s.count}</Typography></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent></Card>
              </Grid>
            )}
          </Grid>
        </>
      )}

      {/* Trading Calendar - Linked with all filters */}
      <Box sx={{ mt: 4 }}>
        <CalendarView
          {...((dashStartDate || dashEndDate) ? {
            dateRange: {
              startDate: dashStartDate ? `${dashStartDate.getFullYear()}-${String(dashStartDate.getMonth()+1).padStart(2,'0')}-${String(dashStartDate.getDate()).padStart(2,'0')}` : undefined,
              endDate: dashEndDate ? `${dashEndDate.getFullYear()}-${String(dashEndDate.getMonth()+1).padStart(2,'0')}-${String(dashEndDate.getDate()).padStart(2,'0')}` : undefined,
            },
            title: t('calendar.filteredCalendar', 'Calendar (Filtered)'),
          } : {
            months: 3,
            title: t('calendar.recentCalendar', 'Recent Trading Activity'),
          })}
          hideRangeSelector={true}
          symbolFilter={dashSymbolFilter || undefined}
          directionFilter={dashDirectionFilter || undefined}
        />
      </Box>
    </Box>
  );
}
