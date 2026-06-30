import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Button, Card, CardContent,
  CircularProgress,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LanguageSwitcher from '../components/LanguageSwitcher';
import RiskDisclaimerBanner from '../components/RiskDisclaimerBanner';
import LegalFooter from '../components/LegalFooter';
import { useGetFastSpringCheckoutUrlQuery } from '../store/subscriptionApi';

/* ─── FastSpring Product Mapping ─── */
const FASTSPRING_PRODUCTS: Record<string, { path: string; labelKey: string }> = {
  pro: { path: 'professional', labelKey: 'landing.pricing.buttonBuyPro' },
  prem: { path: 'advanced', labelKey: 'landing.pricing.buttonBuyAdvanced' },
};

/* ─── Pricing Tier Card ─── */
interface PricingTierProps {
  name: string;
  price: string;
  period: string;
  features: string[];
  highlighted?: boolean;
  buttonText: string;
  onChoose: () => void;
  loading?: boolean;
}
function PricingTierCard({ name, price, period, features, highlighted, buttonText, onChoose, loading }: PricingTierProps) {
  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.3s, box-shadow 0.3s, border-color 0.3s',
        border: highlighted ? '2px solid #00d4aa' : '2px solid rgba(255,255,255,0.08)',
        ...(highlighted
          ? {
              transform: 'scale(1.03)',
              boxShadow: '0 0 30px rgba(0,212,170,0.15)',
              zIndex: 2,
            }
          : {
              '&:hover': { transform: 'translateY(-4px)', borderColor: 'rgba(0,212,170,0.3)' },
            }),
      }}
    >
      <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Typography variant="h6" sx={{ fontSize: 20, fontWeight: 700, color: highlighted ? '#00d4aa' : '#f1f5f9', mb: 0.5 }}>
          {name}
        </Typography>
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
          <Typography sx={{ fontSize: 36, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{price}</Typography>
          <Typography sx={{ fontSize: 14, color: '#64748b' }}>{period}</Typography>
        </Box>

        <Box sx={{ flex: 1, mb: 3 }}>
          {features.map((feat, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1.2 }}>
              <CheckIcon sx={{ fontSize: 18, color: '#00d4aa', flexShrink: 0 }} />
              <Typography sx={{ fontSize: 14, color: '#cbd5e1' }}>{feat}</Typography>
            </Box>
          ))}
        </Box>

        <Button
          variant={highlighted ? 'contained' : 'outlined'}
          fullWidth
          disabled={loading}
          onClick={onChoose}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
          sx={{
            ...(highlighted
              ? {
                  bgcolor: '#00d4aa', color: '#0a0e17', fontWeight: 700,
                  '&:hover': { bgcolor: '#33dfbb', boxShadow: '0 0 24px rgba(0,212,170,0.35)' },
                }
              : {
                  borderColor: 'rgba(255,255,255,0.18)', color: '#e2e8f0',
                  '&:hover': { borderColor: 'rgba(255,255,255,0.35)', bgcolor: 'rgba(255,255,255,0.05)' },
                }),
            borderRadius: 2.5, py: 1.2,
          }}
        >
          {buttonText}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ─── Main Component ─── */
export default function PricingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedTier, setSelectedTier] = useState(2); // Advanced (premium) highlighted by default
  const [checkoutProduct, setCheckoutProduct] = useState<string | null>(null);

  // FastSpring checkout URL query
  const { data: checkoutData, isLoading: checkoutLoading } = useGetFastSpringCheckoutUrlQuery(checkoutProduct!, {
    skip: !checkoutProduct,
  });

  // Redirect to FastSpring when URL is ready
  React.useEffect(() => {
    if (checkoutData?.checkoutUrl) {
      window.location.href = checkoutData.checkoutUrl;
      setCheckoutProduct(null);
    }
  }, [checkoutData]);

  const handleSubscribe = (productKey: string) => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      navigate('/register');
      return;
    }
    setCheckoutProduct(productKey);
  };

  const pricingTiers = [
    {
      name: t('landing.pricing.freeTierName'),
      price: t('landing.pricing.freeTierPrice'),
      period: t('landing.pricing.freeTierPeriod'),
      features: [
        t('landing.pricing.featureManualTrade'),
        t('landing.pricing.featureBasicAnalytics'),
        t('landing.pricing.featureCSVImport'),
        t('landing.pricing.featureFreeBrowsePublish'),
        t('landing.pricing.featureAIReview5'),
      ],
    },
    {
      name: t('landing.pricing.proTierName'),
      price: t('landing.pricing.proTierPrice'),
      period: t('landing.pricing.proTierPeriod'),
      productKey: 'pro' as const,
      features: [
        t('landing.pricing.featureManualTrade'),
        t('landing.pricing.featureBasicAnalytics'),
        t('landing.pricing.featureImport'),
        t('landing.pricing.featureAIReview50'),
        t('landing.pricing.featureAIFollowUp50'),
        t('landing.pricing.featureFreeBrowsePublish'),
        t('landing.pricing.featureFreeStrategyAccess'),
      ],
    },
    {
      name: t('landing.pricing.teamTierName'),
      price: t('landing.pricing.teamTierPrice'),
      period: t('landing.pricing.teamTierPeriod'),
      productKey: 'prem' as const,
      features: [
        t('landing.pricing.featureManualTrade'),
        t('landing.pricing.featureBasicAnalytics'),
        t('landing.pricing.featureImport'),
        t('landing.pricing.featureAIReview100'),
        t('landing.pricing.featureAIFollowUp100'),
        t('landing.pricing.featureFreeBrowsePublish'),
        t('landing.pricing.featureFreeStrategyAccess'),
      ],
    },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0e17' }}>
      {/* Header */}
      <Box sx={{
        position: 'sticky', top: 0, zIndex: 100,
        bgcolor: 'rgba(10,14,23,0.9)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, cursor: 'pointer' }} onClick={() => navigate('/')}>
              <Box sx={{
                width: 40, height: 40, borderRadius: 1.5,
                background: 'linear-gradient(135deg,#00d4aa 0%,#00a888 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <TrendingUpIcon sx={{ color: '#0a0e17', fontSize: 24 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.3px', lineHeight: 1.3 }}>
                  TradeAnchor
                </Typography>
                <Typography sx={{ fontSize: 10.5, letterSpacing: 1.8, color: '#64748b', textTransform: 'uppercase', lineHeight: 1.3 }}>
                  {t('pricing.brandTagline')}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button size="small" onClick={() => navigate('/')} sx={{ color: '#94a3b8', fontSize: 13.5, textTransform: 'none', '&:hover': { color: '#fff' } }}>
                {t('pricing.navHome')}
              </Button>
              <LanguageSwitcher />
              <Button
                variant="contained"
                size="small"
                onClick={() => {
                  const token = localStorage.getItem('accessToken');
                  token ? handleSubscribe('prem') : navigate('/register');
                }}
                sx={{
                  bgcolor: '#00d4aa', color: '#0a0e17', fontWeight: 600, fontSize: 13,
                  borderRadius: 2, px: 2, py: 0.6, textTransform: 'none',
                  '&:hover': { bgcolor: '#33dfbb' },
                }}
              >
                {t('pricing.navGetStarted')}
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Hero Section */}
      <Box sx={{ py: { xs: 8, md: 12 }, px: { xs: 2, lg: 0 }, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography
            variant="h2"
            sx={{ fontSize: { xs: '2rem', md: '2.8rem' }, fontWeight: 800, color: '#fff', mb: 2, lineHeight: 1.2 }}
          >
            {t('pricing.heroTitle')}
          </Typography>
          <Typography sx={{ fontSize: { xs: 16, md: 18 }, color: '#94a3b8', maxWidth: 620, mx: 'auto', lineHeight: 1.7, mb: 1 }}>
            {t('pricing.heroSubtitle')}
          </Typography>

        </Container>
      </Box>

      {/* Pricing Cards */}
      <Box sx={{ pb: { xs: 8, md: 12 }, px: { xs: 2, lg: 0 } }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3,1fr)' }, gap: 3, alignItems: 'stretch' }}>
            {pricingTiers.map((tier, idx) => (
              <PricingTierCard
                key={tier.name}
                name={tier.name}
                price={tier.price}
                period={tier.period}
                features={tier.features}
                highlighted={selectedTier === idx}
                buttonText={t('landing.pricing.buttonChoosePlan')}
                loading={false}
                onChoose={() => {
                  setSelectedTier(idx);
                  navigate('/register');
                }}
              />
            ))}
          </Box>
        </Container>
      </Box>

      {/* Feature Comparison Table */}
      <Box sx={{ pb: { xs: 8, md: 12 }, px: { xs: 2, lg: 0 } }}>
        <Container maxWidth="lg">
          <Typography variant="h4" sx={{ textAlign: 'center', fontWeight: 700, color: '#fff', mb: 1 }}>
            {t('pricing.compareTitle')}
          </Typography>
          <Typography sx={{ textAlign: 'center', color: '#64748b', mb: 5 }}>
            {t('pricing.compareSubtitle')}
          </Typography>

          <Box sx={{
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3,
            overflow: 'hidden', bgcolor: 'rgba(15,23,42,0.5)',
          }}>
            {/* Table Header */}
            <Box sx={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              bgcolor: 'rgba(0,212,170,0.04)',
            }}>
              {[
                '',
                t('landing.pricing.freeTierName'),
                t('landing.pricing.proTierName'),
                t('landing.pricing.teamTierName'),
              ].map((header, i) => (
                <Box key={i} sx={{ p: 2, textAlign: i === 0 ? 'left' : 'center' }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: i === 0 ? '#64748b' : '#e2e8f0' }}>{header}</Typography>
                </Box>
              ))}
            </Box>

            {/* Table Rows */}
            {[
              { label: t('pricing.compareTrades'), free: '500', pro: t('pricing.unlimited'), prem: t('pricing.unlimited') },
              { label: t('pricing.compareAIReports'), free: '5', pro: '50', prem: '100' },
              { label: t('pricing.compareAIFollowUp'), free: t('pricing.notAvailable'), pro: '50', prem: '100' },
              { label: t('pricing.compareCSVImport'), free: '\u2713', pro: '\u2713', prem: '\u2713' },
              { label: t('pricing.compareAdvancedAnalytics'), free: '\u2717', pro: '\u2713', prem: '\u2713' },
              { label: t('pricing.comparePlaybooks'), free: t('pricing.unlimitedBrowse'), pro: t('pricing.unlimitedBrowse'), prem: t('pricing.unlimitedBrowse') },
              { label: t('pricing.comparePublishPosts'), free: '\u2713', pro: '\u2713', prem: '\u2713' },
              { label: t('pricing.compareAttachmentDownloads'), free: '\u2717', pro: '\u2713', prem: '\u2713' },
            ].map((row, i) => (
              <Box key={i} sx={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
                borderBottom: i < 7 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                transition: 'bgcolor 0.15s',
              }}>
                <Box sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: 13.5, color: '#cbd5e1' }}>{row.label}</Typography>
                </Box>
                {[row.free, row.pro, row.prem].map((val, j) => {
                  const isCheck = val === '\u2713';
                  const isCross = val === '\u2717';
                  return (
                    <Box key={j} sx={{ p: 2, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isCheck ? (
                        <CheckIcon sx={{ fontSize: 18, color: j === 2 ? '#fbbf24' : '#00d4aa' }} />
                      ) : isCross ? (
                        <Typography sx={{ fontSize: 18, color: j === 2 ? '#fbbf24' : '#334155' }}>&#10005;</Typography>
                      ) : (
                        <Typography sx={{
                          fontSize: 13.5,
                          color: (j === 1 || j === 2) && i <= 2
                            ? (j === 1 ? '#00d4aa' : '#fbbf24')
                            : (j === 2 ? '#fbbf24' : (j === 1 && i === 5 ? '#00d4aa' : '#94a3b8')),
                          fontWeight: i <= 2 && j >= 1 ? 600 : 400,
                        }}>{val}</Typography>
                      )}
                    </Box>
                  );
                })}
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* Risk Disclaimer */}
      <RiskDisclaimerBanner />
      <LegalFooter />
    </Box>
  );
}
