import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Typography, Box, Card, CardContent, Button, Chip, Divider, Grid, Switch, FormControlLabel, List, ListItem, ListItemText, CircularProgress, Snackbar, Alert } from '@mui/material';
import UpgradeIcon from '@mui/icons-material/Upgrade';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { useGetCurrentSubscriptionQuery, useUpgradeSubscriptionMutation, useSetAutoRenewMutation, useGetSubscriptionHistoryQuery, useGetFastSpringCheckoutUrlQuery } from '../../store/subscriptionApi';
import LegalFooter from '../../components/LegalFooter';

/* ─── FastSpring Product Mapping ─── */
const FS_PRODUCT_MAP: Record<string, string> = {
  pro: 'professional',
  prem: 'advanced',
};

export default function SubscriptionPage() {
  const { t } = useTranslation();
  const { data: sub } = useGetCurrentSubscriptionQuery();
  const [upgrade] = useUpgradeSubscriptionMutation();
  const [setAutoRenew, { isLoading: autoRenewLoading }] = useSetAutoRenewMutation();
  const { data: history } = useGetSubscriptionHistoryQuery();

  // Payment checkout state (Creem or FastSpring)
  const [checkoutProduct, setCheckoutProduct] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [autoRenewError, setAutoRenewError] = useState<string | null>(null);
  const { data: checkoutData, isLoading: checkoutLoading, isError, error } = useGetFastSpringCheckoutUrlQuery(checkoutProduct!, {
    skip: !checkoutProduct,
  });

  const resolveCheckoutError = React.useCallback((err: unknown) => {
    const apiError = (err as { data?: { error?: string } })?.data?.error || '';
    if (apiError.includes('required scopes') || apiError.includes('403')) {
      return t('subscription.checkoutApiScopeError');
    }
    return apiError || t('subscription.checkoutFailed');
  }, [t]);

  // Redirect to payment provider when URL is ready
  React.useEffect(() => {
    if (checkoutData?.checkoutUrl) {
      window.location.href = checkoutData.checkoutUrl;
      setCheckoutProduct(null);
    }
  }, [checkoutData]);

  React.useEffect(() => {
    if (isError && checkoutProduct) {
      setCheckoutError(resolveCheckoutError(error));
      setCheckoutProduct(null);
    }
  }, [isError, error, checkoutProduct, resolveCheckoutError]);

  const handleCheckoutSubscribe = (tierKey: string) => {
    setCheckoutError(null);
    setCheckoutProduct(FS_PRODUCT_MAP[tierKey]);
  };

  const handleAutoRenewChange = async (checked: boolean) => {
    setAutoRenewError(null);
    try {
      await setAutoRenew({ autoRenew: checked }).unwrap();
    } catch {
      setAutoRenewError(t('subscription.autoRenewError'));
    }
  };

  const TIERS = [
    {
      name: t('landing.pricing.freeTierName'),
      price: t('landing.pricing.freeTierPrice') + t('landing.pricing.freeTierPeriod'),
      key: 'free',
      features: [
        t('landing.pricing.featureManualTrade'),
        t('landing.pricing.featureBasicAnalytics'),
        t('landing.pricing.featureCSVImport'),
        t('landing.pricing.featureFreeBrowsePublish'),
        t('landing.pricing.featureAIReview5'),
      ],
      color: '#9e9e9e',
    },
    {
      name: t('landing.pricing.proTierName'),
      price: t('landing.pricing.proTierPrice') + t('landing.pricing.proTierPeriod'),
      key: 'pro',
      features: [
        t('landing.pricing.featureManualTrade'),
        t('landing.pricing.featureBasicAnalytics'),
        t('landing.pricing.featureImport'),
        t('landing.pricing.featureAIReview50'),
        t('landing.pricing.featureAIFollowUp50'),
        t('landing.pricing.featureFreeBrowsePublish'),
        t('landing.pricing.featureFreeStrategyAccess'),
      ],
      color: '#1976d2',
    },
    {
      name: t('landing.pricing.teamTierName'),
      price: t('landing.pricing.teamTierPrice') + t('landing.pricing.teamTierPeriod'),
      key: 'prem',
      features: [
        t('landing.pricing.featureManualTrade'),
        t('landing.pricing.featureBasicAnalytics'),
        t('landing.pricing.featureImport'),
        t('landing.pricing.featureAIReview100'),
        t('landing.pricing.featureAIFollowUp100'),
        t('landing.pricing.featureFreeBrowsePublish'),
        t('landing.pricing.featureFreeStrategyAccess'),
      ],
      color: '#7b1fa2',
    },
  ];

  const subData = sub?.data ?? sub;
  const currentTierIndex = TIERS.findIndex(tier => tier.key === subData?.tier?.toLowerCase());
  const currentTierName = TIERS[currentTierIndex]?.name || t('landing.pricing.freeTierName');
  const isPaidUser = subData?.tier === 'pro' || subData?.tier === 'prem';
  const autoRenewEnabled = subData?.autoRenew !== false;

  const formatExpiry = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <Box sx={{ py: 3 }}>
      <Typography variant="h4" sx={{fontWeight:700}} gutterBottom>{t('subscription.title')}</Typography>

      <Card sx={{ mb: 3, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#94a3b8' }}>{t('subscription.currentPlan')}</Typography>
              <Typography variant="h4" sx={{ color: '#00d4aa', fontWeight: 700 }}>{currentTierName}</Typography>
              {subData?.expiresAt && (
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  {autoRenewEnabled
                    ? t('subscription.renewsOn', { date: formatExpiry(subData.expiresAt) })
                    : t('subscription.accessUntil', { date: formatExpiry(subData.expiresAt) })}
                </Typography>
              )}
            </Box>
            {isPaidUser && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoRenewEnabled}
                      disabled={autoRenewLoading}
                      onChange={(e) => handleAutoRenewChange(e.target.checked)}
                    />
                  }
                  label={autoRenewLoading ? t('subscription.updating') : t('subscription.autoRenew')}
                />
                <Typography variant="caption" sx={{ color: '#64748b', maxWidth: 280, textAlign: 'right' }}>
                  {autoRenewEnabled ? t('subscription.autoRenewHint') : t('subscription.autoRenewOffHint')}
                </Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      <Typography variant="h6" sx={{ mb: 2 }}>{t('subscription.availablePlans')}</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {TIERS.map((tier, idx) => (
          <Grid size={{xs:12,sm:4}} key={tier.name}>
            <Card sx={{ height: '100%', border: currentTierIndex === idx ? '2px solid #00d4aa' : '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.02)', position: 'relative' }}>
              {currentTierIndex === idx && <Chip label={t('subscription.current')} size="small" color="primary" sx={{ position: 'absolute', top: 8, right: 8 }} />}
              <CardContent>
                <Typography variant="h6" sx={{fontWeight:700}}>{tier.name}</Typography>
                <Typography variant="h5" sx={{ color: '#e2e8f0', fontWeight: 700, my: 1 }}>{tier.price}</Typography>
                <Divider sx={{ my: 1.5 }} />
                <List dense>
                  {tier.features.map(f => (
                    <ListItem key={f} disablePadding><ListItemText primary={<Typography variant="body2">{f}</Typography>} /></ListItem>
                  ))}
                </List>

                {currentTierIndex < idx && (
                  tier.key === 'free' ? (
                    <Button fullWidth variant="contained" startIcon={<UpgradeIcon />} sx={{ mt: 2 }}
                      onClick={() => upgrade({ tier: tier.key as any })}>
                      {t('subscription.upgrade', { plan: tier.name })}
                    </Button>
                  ) : (
                    <Button fullWidth variant="contained" startIcon={checkoutProduct && checkoutProduct === FS_PRODUCT_MAP[tier.key] && checkoutLoading ? <CircularProgress size={18} color="inherit" /> : <ShoppingCartIcon />}
                      disabled={checkoutLoading}
                      sx={{ mt: 2, bgcolor: '#00d4aa', '&:hover': { bgcolor: '#33dfbb' }, color: '#0a0e17', fontWeight: 700 }}
                      onClick={() => handleCheckoutSubscribe(tier.key)}>
                      {checkoutProduct && checkoutProduct === FS_PRODUCT_MAP[tier.key] && checkoutLoading
                        ? t('subscription.redirecting')
                        : t('subscription.upgrade', { plan: tier.name })}
                    </Button>
                  )
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {history && history.length > 0 && (
        <>
          <Typography variant="h6" sx={{ mb: 1 }}>{t('subscription.history')}</Typography>
          <Card sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <CardContent sx={{ p: 0 }}>
              {history.map((h: any) => (
                <Box key={h.id} sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between' }}>
                  <Box>
                    <Chip label={TIERS.find(tr => tr.key === h.tier)?.name || h.tier} size="small" />
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>{new Date(h.createdAt).toLocaleDateString()}</Typography>
                  </Box>
                  <Chip label={h.status} size="small" color={h.status === 'active' ? 'success' : 'default'} />
                </Box>
              ))}
            </CardContent>
          </Card>
        </>
      )}
      <Snackbar open={!!checkoutError} autoHideDuration={8000} onClose={() => setCheckoutError(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setCheckoutError(null)} sx={{ maxWidth: 560 }}>
          {checkoutError}
        </Alert>
      </Snackbar>
      <Snackbar open={!!autoRenewError} autoHideDuration={8000} onClose={() => setAutoRenewError(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setAutoRenewError(null)} sx={{ maxWidth: 560 }}>
          {autoRenewError}
        </Alert>
      </Snackbar>
      <LegalFooter />
    </Box>
  );
}
