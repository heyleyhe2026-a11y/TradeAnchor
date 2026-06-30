import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Pagination,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Checkbox,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  useGetTradesQuery,
  useLazyGetTradeByIdQuery,
  useDeleteTradeMutation,
  useBatchDeleteTradesMutation,
  useBatchUpdateLeverageMutation,
  type Trade,
} from '../../store/tradeApi';
import TradeFormDialog from './TradeFormDialog';
import TradeImportDialog from './TradeImportDialog';
import { fmtDollar, fmtSignedCurrency, fmtDateTime, fmtDuration } from '../../utils/format';
import { getTradeNetPnL } from '../../utils/tradeMetrics';

export default function TradesPage() {
  const { t, i18n } = useTranslation();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [symbolFilter, setSymbolFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [sortField, setSortField] = useState<'date' | 'pnl' | 'symbol'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [formOpen, setFormOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchLeverageOpen, setBatchLeverageOpen] = useState(false);
  const [batchLeverageValue, setBatchLeverageValue] = useState('1');

  const { data: tradesData, isLoading, error } = useGetTradesQuery({
    page,
    limit,
    ...(symbolFilter && { symbol: symbolFilter }),
    ...(directionFilter && { direction: directionFilter as 'long' | 'short' }),
    ...(startDate && { startDate: startDate.toISOString().slice(0,10) }),
    ...(endDate && { endDate: endDate.toISOString().slice(0,10) }),
    sort: sortField,
    order: sortOrder,
  });

  const [deleteTrade] = useDeleteTradeMutation();
  const [batchDeleteTrades] = useBatchDeleteTradesMutation();
  const [batchUpdateLeverage] = useBatchUpdateLeverageMutation();
  const [fetchTradeById] = useLazyGetTradeByIdQuery();

  const displayCurrency = tradesData?.displayCurrency ?? 'USD';

  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => setPage(value);

  const handleEdit = async (trade: Trade) => {
    try {
      const native = await fetchTradeById(trade.id).unwrap();
      setEditingTrade(native);
    } catch {
      setEditingTrade(trade);
    }
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteTrade(id).unwrap();
    setDeleteConfirmId(null);
  };

  const handleSelectToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!tradesData?.trades?.length) return;
    const allIds = tradesData.trades.map((t) => t.id);
    setSelectedIds(
      selectedIds.size === allIds.length ? new Set() : new Set(allIds)
    );
  };

  const handleBatchDelete = async () => {
    await batchDeleteTrades(Array.from(selectedIds)).unwrap();
    setSelectedIds(new Set());
    setBatchDeleteOpen(false);
  };

  const handleBatchUpdateLeverage = async () => {
    const leverage = parseInt(batchLeverageValue, 10);
    if (!leverage || leverage < 1) return;
    await batchUpdateLeverage({ ids: Array.from(selectedIds), leverage }).unwrap();
    setSelectedIds(new Set());
    setBatchLeverageOpen(false);
    setBatchLeverageValue('1');
  };

  // Clear selection when page/filter changes
  const currentPageIds = tradesData?.trades?.map((t) => t.id) ?? [];
  const allCurrentSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.has(id));
  const someSelected = currentPageIds.some((id) => selectedIds.has(id));

  return (
    <Box>
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">{t('trades.title')}</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditingTrade(null); setFormOpen(true); }}>
              {t('trades.addTrade')}
            </Button>
            <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setImportOpen(true)}>
              {t('trades.importTrades')}
            </Button>
            {selectedIds.size > 0 && (
              <>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={() => setBatchLeverageOpen(true)}
                >
                  {t('trades.batchUpdateLeverage', { count: selectedIds.size })}
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => setBatchDeleteOpen(true)}
                >
                  {t('trades.batchDelete', { count: selectedIds.size })}
                </Button>
              </>
            )}
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{t('errors.generic')}</Alert>}

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>{t('trades.filters.title')}</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField
                size="small"
                label={t('trades.symbol')}
                value={symbolFilter}
                onChange={(e) => { setSymbolFilter(e.target.value); setPage(1); }}
              />
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>{t('trades.direction')}</InputLabel>
                <Select value={directionFilter} label={t('trades.direction')} onChange={(e) => { setDirectionFilter(e.target.value); setPage(1); }}>
                  <MenuItem value="">{t('common.all')}</MenuItem>
                  <MenuItem value="long">{t('trades.long')}</MenuItem>
                  <MenuItem value="short">{t('trades.short')}</MenuItem>
                </Select>
              </FormControl>
              <DatePicker
                label={t('trades.filters.startDate')}
                value={startDate}
                onChange={(val) => { setStartDate(val); setPage(1); }}
                slotProps={{
                  textField: { size: 'small' },
                  actionBar: { actions: ['clear'] },
                }}
                format="yyyy/MM/dd"
              />
              <DatePicker
                label={t('trades.filters.endDate')}
                value={endDate}
                onChange={(val) => { setEndDate(val); setPage(1); }}
                slotProps={{
                  textField: { size: 'small' },
                  actionBar: { actions: ['clear'] },
                }}
                format="yyyy/MM/dd"
              />
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>{t('common.sort')}</InputLabel>
                <Select value={`${sortField}-${sortOrder}`} label={t('common.sort')} onChange={(e) => { const p = e.target.value.split('-'); if (p[0]) setSortField(p[0] as any); if (p[1] === 'asc' || p[1] === 'desc') setSortOrder(p[1]); }}>
                  <MenuItem value="date-desc">{t('trades.sortByDateDesc')}</MenuItem>
                  <MenuItem value="pnl-desc">{t('trades.sortByPnlDesc')}</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <InputLabel>{t('common.pageSize')}</InputLabel>
                <Select value={String(limit)} label={t('common.pageSize')} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
                  {[10,20,50,100].map(n => <MenuItem key={n} value={String(n)}>{n}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
          </CardContent>
        </Card>

        <Card>
          {isLoading ? <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box> : (
            <>
              <TableContainer>
                <Table>
                  <TableHead><TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={someSelected && !allCurrentSelected}
                        checked={allCurrentSelected}
                        onChange={handleSelectAll}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{t('trades.symbol')}</TableCell>
                    <TableCell>{t('trades.dir')}</TableCell>
                    <TableCell align="right">{t('trades.entry')}</TableCell>
                    <TableCell align="right">{t('trades.exit')}</TableCell>
                    <TableCell align="right">{t('trades.qty')}</TableCell>
                    <TableCell align="right">{t('trades.leverage')}</TableCell>
                    <TableCell align="right">{t('trades.pnl')}</TableCell>
                    <TableCell align="right">{t('trades.commission')}</TableCell>
                    <TableCell align="right">{t('trades.swap')}</TableCell>
                    <TableCell align="right"><Typography sx={{ fontWeight: 600, color: 'primary.main' }}>{t('trades.netPnl')}</Typography></TableCell>
                    <TableCell>{t('trades.entryTime')}</TableCell>
                    <TableCell>{t('trades.exitTime')}</TableCell>
                    <TableCell>{t('trades.duration')}</TableCell>
                    <TableCell>{t('common.actions')}</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {!tradesData?.trades?.length ? (
                      <TableRow><TableCell colSpan={15} align="center" sx={{ py: 4 }}><Typography color="textSecondary">{t('trades.noTrades')}</Typography></TableCell></TableRow>
                    ) : tradesData.trades.map((trade) => {
                      const netPnl = trade.netPnl ?? getTradeNetPnL(trade) ?? 0;
                      return (
                      <TableRow key={trade.id} hover sx={{ bgcolor: selectedIds.has(trade.id) ? 'rgba(99,102,241,0.06)' : 'inherit' }}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedIds.has(trade.id)}
                            onChange={() => handleSelectToggle(trade.id)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>{trade.tradingSymbol}</TableCell>
                        <TableCell><Chip label={trade.positionDirection === 'long' ? t('trades.long') : t('trades.short')} size="small" color={trade.positionDirection === 'long' ? 'success' : 'warning'} variant="outlined"/></TableCell>
                        <TableCell align="right">{fmtDollar(trade.entryPrice, displayCurrency)}</TableCell>
                        <TableCell align="right">{trade.exitPrice ? fmtDollar(trade.exitPrice, displayCurrency) : '-'}</TableCell>
                        <TableCell align="right">{trade.quantity}</TableCell>
                        <TableCell align="right"><Chip label={`${trade.leverage || 1}x`} size="small" color="default" variant="outlined" sx={{ fontWeight: 600 }} /></TableCell>
                        <TableCell align="right"><Typography sx={{fontWeight:600, color: trade.pnl>=0?'success.main':'error.main'}}>{fmtSignedCurrency(trade.pnl, displayCurrency)}</Typography></TableCell>
                        <TableCell align="right">{trade.commission != null ? fmtDollar(trade.commission, displayCurrency) : '-'}</TableCell>
                        <TableCell align="right">{trade.swap != null ? fmtDollar(Math.abs(trade.swap), displayCurrency) : '-'}</TableCell>
                        <TableCell align="right"><Typography sx={{fontWeight:600, color: netPnl>=0?'primary.main':'warning.main'}}>{fmtSignedCurrency(netPnl, displayCurrency)}</Typography></TableCell>
                        <TableCell>{fmtDateTime(trade.entryTimestamp)}</TableCell>
                        <TableCell>{fmtDateTime(trade.exitTimestamp)}</TableCell>
                        <TableCell><Typography component="span" sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>{fmtDuration(trade.entryTimestamp, trade.exitTimestamp, i18n.language.startsWith('zh') ? 'zh' : 'en')}</Typography></TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => handleEdit(trade)}><EditIcon fontSize="small"/></IconButton>
                          <IconButton size="small" color="error" onClick={() => setDeleteConfirmId(trade.id)}><DeleteIcon fontSize="small"/></IconButton>
                        </TableCell>
                      </TableRow>
                      )})}
                  </TableBody>
                </Table>
              </TableContainer>

              {tradesData && tradesData.totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <Pagination count={tradesData.totalPages} page={page} onChange={handlePageChange} color="primary"/>
                </Box>
              )}
              {tradesData && (
                <Box sx={{ px: 2, py: 1, bgcolor: '#2a2a3e', borderRadius: '0 0 8px 8px' }}>
                  <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                    {t('common.showing', { from: (page-1)*limit+1, to: Math.min(page*limit, tradesData.total), total: tradesData.total })}
                  </Typography>
                </Box>
              )}
            </>
          )}
        </Card>
      </Box>

      <TradeFormDialog open={formOpen} onClose={() => { setFormOpen(false); setEditingTrade(null); }} trade={editingTrade} onSuccess={() => { setFormOpen(false); setEditingTrade(null); }}/>

      <Dialog open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('trades.deleteTrade')}</DialogTitle>
        <DialogContent><Typography>{t('trades.confirmDelete')}</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmId(null)}>{t('common.cancel')}</Button>
          <Button color="error" variant="contained" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>{t('common.delete')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={batchDeleteOpen} onClose={() => setBatchDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('trades.batchDeleteTitle')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('trades.confirmBatchDelete', { count: selectedIds.size })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBatchDeleteOpen(false)}>{t('common.cancel')}</Button>
          <Button color="error" variant="contained" onClick={handleBatchDelete}>{t('common.delete')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={batchLeverageOpen} onClose={() => setBatchLeverageOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('trades.batchLeverageTitle')}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>
            {t('trades.confirmBatchUpdateLeverage', { count: selectedIds.size })}
          </Typography>
          <TextField
            type="number"
            label={t('tradeForm.fieldLeverage')}
            value={batchLeverageValue}
            onChange={(e) => setBatchLeverageValue(e.target.value)}
            fullWidth
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
            helperText={t('tradeForm.leverageHint')}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setBatchLeverageOpen(false); setBatchLeverageValue('1'); }}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleBatchUpdateLeverage}>{t('common.confirm')}</Button>
        </DialogActions>
      </Dialog>

      <TradeImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </Box>
  );
}
