import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, FormControl, InputLabel, Select,
  Alert, CircularProgress, Box, Typography, Snackbar,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import DeleteIcon from '@mui/icons-material/Delete';
import { fmtSignedCurrency } from '../../utils/format';
import { previewPnLFromPrices } from '../../utils/tradeMetrics';
import {
  useCreateTradeMutation,
  useUpdateTradeMutation,
  useDeleteTradeMutation,
  type Trade,
} from '../../store/tradeApi';

interface Props { open: boolean; onClose: () => void; trade: Trade | null; onSuccess: () => void; }

interface TradeForm {
  tradingSymbol: string;
  positionDirection: 'long' | 'short';
  entryPrice: string;
  exitPrice: string;
  quantity: string;
  leverage: string;
  commission: string;
  swap: string;
  entryTimestamp: string;
  exitTimestamp: string;
}

const emptyForm: TradeForm = { tradingSymbol: '', positionDirection: 'long', entryPrice: '', exitPrice: '', quantity: '', leverage: '1', commission: '', swap: '', entryTimestamp: new Date().toISOString().slice(0,16), exitTimestamp: '' };

export default function TradeFormDialog({ open, onClose, trade, onSuccess }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState<TradeForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [snackMsg, setSnackMsg] = useState('');
  const [createTrade, { isLoading: isCreating }] = useCreateTradeMutation();
  const [updateTrade, { isLoading: isUpdating }] = useUpdateTradeMutation();
  const [deleteTrade, { isLoading: isDeleting }] = useDeleteTradeMutation();

  useEffect(() => {
    if (open && trade) setForm({
      tradingSymbol: trade.tradingSymbol,
      positionDirection: trade.positionDirection,
      entryPrice: String(trade.entryPrice),
      exitPrice: trade.exitPrice ? String(trade.exitPrice) : '',
      quantity: String(trade.quantity),
      leverage: String(trade.leverage ?? 1),
      commission: trade.commission != null ? String(trade.commission) : '',
      swap: trade.swap != null ? String(trade.swap) : '',
      entryTimestamp: new Date(trade.entryTimestamp).toISOString().slice(0,16),
      exitTimestamp: trade.exitTimestamp ? new Date(trade.exitTimestamp).toISOString().slice(0,16) : '',
    });
    else if (open) setForm(emptyForm);
    setErrors({});
    setSnackMsg('');
  }, [open, trade]);

  const change = (f: string, v: string) => { setForm(p => ({...p,[f]:v})); if (errors[f]) setErrors(p => ({...p,[f]:''})); };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.tradingSymbol.trim()) e.tradingSymbol = t('tradeForm.validation.symbolRequired');
    if (!form.entryPrice || isNaN(Number(form.entryPrice)) || Number(form.entryPrice) <= 0) e.entryPrice = t('tradeForm.validation.validPriceRequired');
    if (!form.quantity || isNaN(Number(form.quantity)) || Number(form.quantity) <= 0) e.quantity = t('tradeForm.validation.validQtyRequired');
    setErrors(e); return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;

    const d: Record<string, unknown> = {
      tradingSymbol: form.tradingSymbol.toUpperCase().trim(),
      positionDirection: form.positionDirection as 'long' | 'short',
      entryPrice: parseFloat(form.entryPrice),
      quantity: parseFloat(form.quantity),
      leverage: parseInt(form.leverage, 10) || 1,
      entryTimestamp: new Date(form.entryTimestamp).toISOString(),
      ...(form.exitPrice ? { exitPrice: parseFloat(form.exitPrice) } : {}),
      ...(form.exitTimestamp ? { exitTimestamp: new Date(form.exitTimestamp).toISOString() } : {}),
      ...(form.commission ? { commission: parseFloat(form.commission) } : {}),
      ...(form.swap ? { swap: parseFloat(form.swap) } : {}),
    };
    console.log('[TradeForm] Submitting:', d);
    try {
      if (trade) await updateTrade({ id: trade.id, data: d as any }).unwrap();
      else { const result = await createTrade(d as any).unwrap(); console.log('[TradeForm] Created:', result); }
      setSnackMsg(t('tradeForm.saved'));
      onSuccess();
    } catch (err) {
      console.error('[TradeForm] Error:', err);
      setErrors(p => ({ ...p, submit: String(err instanceof Error ? err.message || err : JSON.stringify(err)) }));
    }
  };

  const handleDelete = async () => {
    if (!trade) return;
    await deleteTrade(trade.id).unwrap();
    setSnackMsg(t('trades.deleteSuccess'));
    onSuccess();
  };

  const pnlPreview = (() => {
    try {
      const ep = parseFloat(form.entryPrice);
      const xp = parseFloat(form.exitPrice);
      const q = parseFloat(form.quantity);
      const commission = form.commission ? parseFloat(form.commission) : 0;
      const swap = form.swap ? parseFloat(form.swap) : 0;
      if (!form.exitPrice.trim()) return null;
      return previewPnLFromPrices(
        form.positionDirection,
        ep,
        xp,
        q,
        Number.isNaN(commission) ? 0 : commission,
        Number.isNaN(swap) ? 0 : swap,
      );
    } catch {
      return null;
    }
  })();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{trade ? t('tradeForm.titleEdit') : t('tradeForm.titleNew')}</DialogTitle>
      <DialogContent dividers>
        {errors.submit && <Alert severity="error" sx={{mb:2}}>{errors.submit}</Alert>}
        <Box sx={{display:'flex', flexDirection:'column', gap:2}}>
          <TextField fullWidth label={t('tradeForm.symbol')} value={form.tradingSymbol} onChange={e=>change('tradingSymbol',e.target.value)} error={!!errors.tradingSymbol} helperText={errors.tradingSymbol} autoFocus={!trade}/>
          <Box sx={{display:'flex', gap:2}}>
            <FormControl fullWidth error={!!errors.positionDirection}><InputLabel>{t('tradeForm.direction')}</InputLabel><Select value={form.positionDirection} label={t('tradeForm.direction')} onChange={e=>change('positionDirection',e.target.value)}><MenuItem value="long">{t('trades.long')}</MenuItem><MenuItem value="short">{t('trades.short')}</MenuItem></Select></FormControl>
            <TextField fullWidth type="number" label={t('tradeForm.quantity')} value={form.quantity} onChange={e=>change('quantity',e.target.value)} error={!!errors.quantity} helperText={errors.quantity} slotProps={{htmlInput:{min:0.01,step:0.01}}}/>
          </Box>
          <Box sx={{display:'flex', gap:2}}>
            <TextField fullWidth type="number" label={t('tradeForm.entryPrice')} value={form.entryPrice} onChange={e=>change('entryPrice',e.target.value)} error={!!errors.entryPrice} helperText={errors.entryPrice} slotProps={{htmlInput:{step:'0.01'}}}/>
            <TextField fullWidth type="number" label={t('tradeForm.exitPrice')} value={form.exitPrice} onChange={e=>change('exitPrice',e.target.value)} error={!!errors.exitPrice} helperText={t('common.optional')} slotProps={{htmlInput:{step:'0.01'}}}/>
          </Box>
          <Box sx={{display:'flex', gap:2}}>
            <TextField fullWidth type="number" label={t('tradeForm.fieldLeverage')} value={form.leverage} onChange={e=>change('leverage',e.target.value)} slotProps={{htmlInput:{min:1,step:1}}} helperText={t('tradeForm.leverageHint')}/>
            <TextField fullWidth type="number" label={t('tradeForm.fieldCommission')} value={form.commission} onChange={e=>change('commission',e.target.value)} slotProps={{htmlInput:{step:'0.01'}}} helperText={t('common.optional')}/>
            <TextField fullWidth type="number" label={t('tradeForm.fieldSwap')} value={form.swap} onChange={e=>change('swap',e.target.value)} slotProps={{htmlInput:{step:'0.01'}}} helperText={t('tradeForm.swapHint')}/>
          </Box>
          <Box sx={{display:'flex', gap:2}}>
            <DateTimePicker
              label={t('tradeForm.entryTime')}
              value={form.entryTimestamp ? new Date(form.entryTimestamp) : null}
              onChange={(val) => change('entryTimestamp', val ? val.toISOString().slice(0,16) : '')}
              slotProps={{ textField: { fullWidth: true }, actionBar: { actions: ['clear'] } }}
              format="yyyy/MM/dd HH:mm"
            />
            <DateTimePicker
              label={t('tradeForm.exitTime')}
              value={form.exitTimestamp ? new Date(form.exitTimestamp) : null}
              onChange={(val) => change('exitTimestamp', val ? val.toISOString().slice(0,16) : '')}
              slotProps={{ textField: { fullWidth: true }, actionBar: { actions: ['clear'] } }}
              format="yyyy/MM/dd HH:mm"
            />
          </Box>
          {pnlPreview !== null && <Box sx={{p:1.5, borderRadius:1, bgcolor:'action.hover', borderLeft:4, borderColor:pnlPreview.gross>=0?'success.main':'error.main'}}>
            <Typography variant="body2" color="textSecondary">{t('tradeForm.calculatedPnl')}</Typography>
            <Typography variant="h6" sx={{fontWeight:600}}>{fmtSignedCurrency(pnlPreview.gross)}</Typography>
            {((form.commission && parseFloat(form.commission) > 0) || (form.swap && parseFloat(form.swap) > 0)) && (
              <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                {t('trades.netPnl')}: {fmtSignedCurrency(pnlPreview.net)}
              </Typography>
            )}
          </Box>}
        </Box>
      </DialogContent>
      <DialogActions sx={{ justifyContent: trade ? 'space-between' : 'flex-end' }}>
        {trade ? (
          <Button color="error" startIcon={<DeleteIcon/>} onClick={handleDelete} disabled={isDeleting}>{t('common.delete')}</Button>
        ) : <Box/>}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose} disabled={isCreating||isUpdating||isDeleting}>{t('tradeForm.cancel')}</Button>
          <Button variant="contained" onClick={submit} disabled={isCreating||isUpdating||isDeleting}>
            {isCreating||isUpdating?<CircularProgress size={16} sx={{mr:1}}/>:null}{trade?t('tradeForm.save'):t('tradeForm.create')}
          </Button>
        </Box>
      </DialogActions>
      <Snackbar open={!!snackMsg} autoHideDuration={3000} onClose={()=>setSnackMsg('')} message={snackMsg}/>
    </Dialog>
  );
}
