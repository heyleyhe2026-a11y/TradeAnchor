import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Button,
  Chip, Table, TableBody, TableCell, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Grid,
} from '@mui/material';
import { useGetCalendarDataQuery, useGetCalendarDataByRangeQuery } from '../store/dashboardApi';
import { useGetPreferencesQuery } from '../store/preferencesApi';
import { fmtSignedCurrency, fmtPercent } from '../utils/format';

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

interface CalendarViewProps {
  /** Standalone mode: number of months to display (default 3) */
  months?: number;
  /** Linked mode: custom date range - overrides months mode */
  dateRange?: { startDate?: string; endDate?: string };
  /** Hide range selector (for dashboard integration) */
  hideRangeSelector?: boolean;
  /** Custom title */
  title?: string;
  /** Symbol filter (from dashboard) */
  symbolFilter?: string;
  /** Direction filter (from dashboard) */
  directionFilter?: string;
}

export default function CalendarView({ months: monthsProp, dateRange, hideRangeSelector = false, title, symbolFilter, directionFilter }: CalendarViewProps) {
  const { t } = useTranslation();
  const { data: prefs } = useGetPreferencesQuery();
  const displayCurrency = prefs?.baseCurrency || prefs?.currency || 'USD';
  const [months, setMonths] = useState(3);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Use date range query if provided, otherwise use months query
  const shouldUseRange = Boolean(dateRange && (dateRange.startDate || dateRange.endDate));
  
  const { data: calData, isLoading } = useGetCalendarDataQuery(
    shouldUseRange ? undefined : { months: monthsProp ?? months, ...(symbolFilter && { symbol: symbolFilter }), ...(directionFilter && { direction: directionFilter }) },
    {
      skip: shouldUseRange ? true : false,
    }
  );

  const { data: rangeData, isLoading: isRangeLoading } = useGetCalendarDataByRangeQuery(
    dateRange ? { ...dateRange, ...(symbolFilter && { symbol: symbolFilter }), ...(directionFilter && { direction: directionFilter }) } : undefined,
    {
      skip: shouldUseRange ? false : true,
    }
  );

  const calDataFinal = shouldUseRange ? rangeData : calData;
  const isLoadingFinal = shouldUseRange ? isRangeLoading : isLoading;

  // Use current date as reference
  const now = new Date();

  // Localized day/month names
  const DAYS = [t('calendar.sun','Sun'), t('calendar.mon','Mon'), t('calendar.tue','Tue'), t('calendar.wed','Wed'), t('calendar.thu','Thu'), t('calendar.fri','Fri'), t('calendar.sat','Sat')];
  const MONTHS = [
    t('calendar.jan','Jan'), t('calendar.feb','Feb'), t('calendar.mar','Mar'), t('calendar.apr','Apr'),
    t('calendar.may','May'), t('calendar.jun','Jun'), t('calendar.jul','Jul'), t('calendar.aug','Aug'),
    t('calendar.sep','Sep'), t('calendar.oct','Oct'), t('calendar.nov','Nov'), t('calendar.dec','Dec')
  ];

  // Build calendar data from daily data
  const dayMap = useMemo(() => {
    const map = new Map<string, { pnl: number; trades: number; investment: number; returnPct: number }>();
    calDataFinal?.dailyData?.forEach((d) => map.set(d.date, d));
    return map;
  }, [calDataFinal?.dailyData]);

  // Generate months to display based on date range or months prop
  const displayMonths = useMemo(() => {
    const monthsToShow: Array<{year:number; month:number}> = [];
    
    if (dateRange?.startDate && dateRange?.endDate) {
      // Calculate months between start and end dates
      const start = new Date(dateRange.startDate);
      const end = new Date(dateRange.endDate);
      const current = new Date(start.getFullYear(), start.getMonth(), 1);
      
      while (current <= end) {
        monthsToShow.push({ year: current.getFullYear(), month: current.getMonth() });
        current.setMonth(current.getMonth() + 1);
      }
    } else {
      // Use months prop (default 3)
      const m = monthsProp ?? months;
      for (let i=0; i<m; i++) {
        const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
        monthsToShow.push({ year:d.getFullYear(), month:d.getMonth() });
        if(monthsToShow.length >= 12) break;
      }
      monthsToShow.reverse();
    }
    
    return monthsToShow;
  }, [dateRange, monthsProp, months, now]);

  const selectedDay = selectedDate ? dayMap.get(selectedDate) : null;

  // Format return percentage with +/- sign and 2 decimal places, thousand separators
  const formatReturn = (pct: number) => {
    return fmtPercent(pct);
  };

  // Format PnL with +/- sign, thousand separators, 2 decimal places
  const formatPnL = (pnl: number) => {
    return fmtSignedCurrency(pnl, displayCurrency);
  };

  return (
    <Box>
      <Card sx={{ bgcolor: '#111827', border: '1px solid rgba(255,255,255,0.06)' }}><CardContent>
        <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:2 }}>
          <Typography variant="h6" sx={{ color:'#f1f5f9', fontWeight:700 }}>
            {title || t('calendar.title','Trading Calendar')}
          </Typography>
        </Box>

        {/* Filters row */}
        {!hideRangeSelector && (
          <Box sx={{ display:'flex', gap: 2, mb: 2, flexWrap:'wrap', alignItems:'center' }}>
            {!shouldUseRange && (
              <Box sx={{display:'flex', alignItems:'center', gap:1}}>
                <Typography variant="body2" sx={{color:'#94a3b8'}}>{t('calendar.range','Range')}:</Typography>
                {[3,6,9,12].map(m=>(
                  <Chip key={m} label={`${m}${t('calendar.monthUnit','m')}`} size="small" variant={months===m?'filled':'outlined'} clickable onClick={()=>setMonths(m)} color={months===m?'primary':'default'} sx={months===m?{bgcolor:'#00d4aa',color:'#000','&:hover':{bgcolor:'#33dfbb'}}:{borderColor:'rgba(255,255,255,0.15)',color:'#94a3b8'}}/>
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* Month summary with return rate */}
        {calDataFinal?.monthlySummary && (
          <Grid container spacing={1} sx={{mb:2}}>
            {calDataFinal.monthlySummary.map(m=>(
              <Grid size={{ xs:6, sm:4, md:2 }} key={m.month}>
                <Box sx={{
                  p:1.5, 
                  borderRadius:1, 
                  textAlign:'center', 
                  bgcolor: m.pnl>=0?'rgba(0,212,170,0.12)':'rgba(239,71,111,0.12)', 
                  border:`1px solid ${m.pnl>=0?'rgba(0,212,170,0.2)':'rgba(239,71,111,0.2)'}`
                }}>
                  <Typography variant="caption" sx={{color:'#94a3b8', display:'block'}}>{MONTHS[parseInt(m.month.slice(5))-1]} {m.month.slice(0,4)}</Typography>
                  <Typography variant="body2" sx={{fontWeight:700, color:m.pnl>=0?'#00d4aa':'#ef476f', fontSize:'1rem'}}>
                    {formatPnL(m.pnl)}
                  </Typography>
                  <Typography variant="caption" sx={{fontWeight:600, color: m.returnPct>=0?'#4ade80':'#f87171', display:'block'}}>
                    {formatReturn(m.returnPct)}
                  </Typography>
                  <Typography variant="caption" sx={{color:'#64748b'}}>
                    {m.trades} {t('calendar.tradesLabel','trades')} | {fmtPercent(m.winRate)} {t('calendar.winLabel','win')}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Month calendars */}
        {isLoadingFinal ? (<Box sx={{p:4, textAlign:'center'}}><CircularProgress/></Box>) : (
        <Box sx={{ display:'flex', flexDirection:'column', gap:3 }}>
          {displayMonths.map(({year,month}) => {
            const daysInMonth = getDaysInMonth(year, month);
            const firstDay = getFirstDayOfMonth(year, month);

            // Empty slots before first day
            const beforeCells: JSX.Element[] = [];
            for(let i=0; i<firstDay; i++) beforeCells.push(<Box key={`e-${i}`} sx={{aspectRatio:'1.5'}}/>);

            // Day cells with enhanced display
            const dayCells: JSX.Element[] = [];
            for(let d=1; d<=daysInMonth; d++){
              const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
              const info = dayMap.get(ds);
              const hasInfo = !!info;
              const isProfit = hasInfo && info!.pnl > 0;
              const isLoss = hasInfo && info!.pnl < 0;
              const isEven = hasInfo && info!.pnl === 0;
              const isSelected = selectedDate === ds;
              
              // Determine background color intensity based on return percentage
              let bgOpacity = 0;
              if (hasInfo && !isEven) {
                bgOpacity = Math.min(Math.abs(info!.returnPct) / 5, 1) * 0.25; // Cap at 5% return for max opacity
              }

              dayCells.push(
                <Box key={ds}
                  onClick={() => setSelectedDate(isSelected?null:ds)}
                  sx={{
                    aspectRatio:'1.5',
                    minHeight: '20px',
                    borderRadius:1,
                    display:'flex',
                    flexDirection:'column',
                    alignItems:'center',
                    justifyContent:'center',
                    cursor:'pointer',
                    border: isSelected?'2px solid #00d4aa':'1px solid rgba(255,255,255,0.08)',
                    bgcolor: isProfit?`rgba(0,212,170,${bgOpacity || 0.15})`:isLoss?`rgba(239,71,111,${bgOpacity || 0.15})`:isEven?'rgba(251,191,36,0.12)':hasInfo?'rgba(59,130,246,0.12)':'transparent',
                    '&:hover':{borderColor:'#00d4aa', bgcolor: isProfit?'rgba(0,212,170,0.25)':isLoss?'rgba(239,71,111,0.25)':'rgba(255,255,255,0.05)'},
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Typography variant={hasInfo?'body2':'caption'} sx={{color:hasInfo?'#fff':'#64748b', fontWeight: hasInfo?600:400, fontSize:'15px'}}>{d}</Typography>
                  {hasInfo && (
                    <>
                      <Typography variant="caption" sx={{fontSize:'15px', color:info!.pnl>=0?'#00d4aa':'#ef476f', fontWeight:600}}>
                        {formatPnL(info!.pnl).replace('$','$')}
                      </Typography>
                      <Typography variant="caption" sx={{fontSize:'15px', color:info!.returnPct>=0?'#4ade80':'#f87171', fontWeight:500}}>
                        {formatReturn(info!.returnPct)}
                      </Typography>
                    </>
                  )}
                </Box>);
            }

            return (
              <Box key={`${year}-${month}`}>
                <Typography variant="subtitle2" sx={{fontWeight:700,color:'#e2e8f0',mb:0.5}}>{MONTHS[month]} {year}</Typography>
                <Box sx={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:0.5,mt:0.5,mb:0.5}}>
                  {DAYS.map(d=>(<Box key={d} sx={{textAlign:'center',py:0.5}}><Typography variant="caption" sx={{fontWeight:700,color:'#94a3b8'}}>{d}</Typography></Box>))}
                </Box>
                <Box sx={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:0.5 }}>
                  {...beforeCells}
                  {...dayCells}
                </Box>
              </Box>
            );
          })}
        </Box>)}

        {/* Enhanced Legend */}
        <Box sx={{ display:'flex', gap:3, mt:3, flexWrap:'wrap', pt:2, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <Box sx={{display:'flex',alignItems:'center',gap:0.5}}>
            <Box sx={{width:16,height:16,borderRadius:0.5,bgcolor:'rgba(0,212,170,0.25)'}}/>
            <Typography variant="caption" sx={{color:'#94a3b8'}}>{t('calendar.profit','Profit')}</Typography>
          </Box>
          <Box sx={{display:'flex',alignItems:'center',gap:0.5}}>
            <Box sx={{width:16,height:16,borderRadius:0.5,bgcolor:'rgba(239,71,111,0.25)'}}/>
            <Typography variant="caption" sx={{color:'#94a3b8'}}>{t('calendar.loss','Loss')}</Typography>
          </Box>
          <Box sx={{display:'flex',alignItems:'center',gap:0.5}}>
            <Box sx={{width:16,height:16,borderRadius:0.5,bgcolor:'rgba(251,191,36,0.2)'}}/>
            <Typography variant="caption" sx={{color:'#94a3b8'}}>{t('calendar.breakEven','Break-even')}</Typography>
          </Box>
          <Box sx={{display:'flex',alignItems:'center',gap:0.5}}>
            <Box sx={{width:16,height:16,borderRadius:0.5,bgcolor:'rgba(59,130,246,0.2)'}}/>
            <Typography variant="caption" sx={{color:'#94a3b8'}}>{t('calendar.tradesOnly','Trades only')}</Typography>
          </Box>
          <Box sx={{display:'flex',alignItems:'center',gap:0.5, ml:'auto'}}>
            <Typography variant="caption" sx={{color:'#64748b'}}>{t('calendar.returnTip','Color intensity = Return rate magnitude')}</Typography>
          </Box>
        </Box>

      </CardContent></Card>

      {/* Enhanced Day detail dialog */}
      <Dialog open={!!selectedDate && !!selectedDay} onClose={()=>setSelectedDate(null)} sx={{'& .MuiDialog-paper':{bgcolor:'#1e293b',color:'#e2e8f0',minWidth:320}}}>
        <DialogTitle sx={{color:'#f1f5f9', borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          {selectedDate && new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedDay && (
            <Box sx={{ display:'flex', flexDirection:'column', gap:2 }}>
              {/* Return Rate - Most Prominent */}
              <Box sx={{ 
                p:2, 
                borderRadius:2, 
                textAlign:'center',
                bgcolor: selectedDay.returnPct>=0?'rgba(0,212,170,0.1)':'rgba(239,71,111,0.1)',
                border:`1px solid ${selectedDay.returnPct>=0?'rgba(0,212,170,0.2)':'rgba(239,71,111,0.2)'}`
              }}>
                <Typography variant="caption" sx={{color:'#94a3b8', display:'block'}}>{t('calendar.returnRate','Return Rate')}</Typography>
                <Typography variant="h4" sx={{fontWeight:700, color:selectedDay.returnPct>=0?'#00d4aa':'#ef476f'}}>
                  {formatReturn(selectedDay.returnPct)}
                </Typography>
              </Box>
              
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell sx={{color:'#94a3b8',borderColor:'rgba(255,255,255,0.08)'}}>{t('calendar.numTrades','Number of Trades')}</TableCell>
                    <TableCell align="right" sx={{color:'#f1f5f9',borderColor:'rgba(255,255,255,0.08)', fontWeight:600}}>{selectedDay.trades}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{color:'#94a3b8',borderColor:'rgba(255,255,255,0.08)'}}>{t('calendar.totalPnL','Total P&L')}</TableCell>
                    <TableCell align="right" sx={{borderColor:'rgba(255,255,255,0.08)'}}>
                      <Typography sx={{color:selectedDay.pnl>=0?'#00d4aa':'#ef476f', fontWeight:600}}>{formatPnL(selectedDay.pnl)}</Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{color:'#94a3b8',borderColor:'rgba(255,255,255,0.08)'}}>{t('calendar.investment','Investment')}</TableCell>
                    <TableCell align="right" sx={{color:'#f1f5f9',borderColor:'rgba(255,255,255,0.08)', fontWeight:600}}>${selectedDay.investment.toLocaleString()}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}><Button onClick={()=>setSelectedDate(null)} sx={{color:'#94a3b8'}}>{t('calendar.close','Close')}</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
