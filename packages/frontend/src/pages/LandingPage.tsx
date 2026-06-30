import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Button, Card, CardContent,
  LinearProgress,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PsychologyIcon from '@mui/icons-material/Psychology';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import StorefrontIcon from '@mui/icons-material/Storefront';
import RiskDisclaimerBanner from '../components/RiskDisclaimerBanner';
import LegalFooter from '../components/LegalFooter';
import CheckIcon from '@mui/icons-material/Check';
import LanguageSwitcher from '../components/LanguageSwitcher';

/* ─── Dashboard Mockup (Hero right panel) ─── */
function DashboardMockup() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  return (
    <Box
      sx={{
        bgcolor: '#0d1520',
        border: '1px solid rgba(0,212,170,0.15)',
        borderRadius: 3.5,
        overflow: 'hidden',
        fontFamily: 'monospace',
        fontSize: 12,
      }}
    >
      {/* Title bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.2, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Box sx={{ display: 'flex', gap: 0.7 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ef4444' }} />
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#f59e0b' }} />
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#22c55e' }} />
        </Box>
        <Typography sx={{ fontSize: 11, color: '#94a3b8', letterSpacing: 1 }}>TradeAnchor &middot; {isZh ? '仪表板' : 'Dashboard'}</Typography>
        <Typography sx={{ fontSize: 11, color: '#00d4aa' }}>{t('landing.hero.closeLabel')}</Typography>
      </Box>

      <Box sx={{ p: 2 }}>
        {/* Stats row */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1.5, mb: 2 }}>
          {(isZh ? [
            { label: '账户净值 / Net Value', value: '$149,820', sub: '+3.4% 本周', color: '#00d4aa' },
            { label: '今日盈亏 / Today P&L', value: '+$12,480', sub: '胜率 68%', color: '#00d4aa' },
            { label: '最大回撤 / Max DD', value: '3.2%', sub: '风险可控', color: '#f59e0b' },
          ] : [
            { label: 'Net Value', value: '$149,820', sub: '+3.4% this week', color: '#00d4aa' },
            { label: 'Today P&L', value: '+$12,480', sub: 'Win rate 68%', color: '#00d4aa' },
            { label: 'Max Drawdown', value: '3.2%', sub: 'Risk OK', color: '#f59e0b' },
          ]).map((s) => (
            <Box key={s.label}>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2, p: 1.5 }}>
                <Typography sx={{ fontSize: 9.5, color: '#64748b', mb: 0.3 }}>{s.label}</Typography>
                <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{s.value}</Typography>
                <Typography sx={{ fontSize: 9.5, color: s.color }}>{s.sub}</Typography>
              </Box>
            </Box>
          ))}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 1.5 }}>
          {/* AI Panel */}
          <Box>
            <Box sx={{ bgcolor: 'rgba(0,212,170,0.05)', borderRadius: 2, p: 1.5, height: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{isZh ? 'AI 置信提示' : 'AI Confidence'}</Typography>
                <Box sx={{ bgcolor: '#00d4aa', color: '#000', px: 1, py: 0.25, borderRadius: 1, fontSize: 9.5, fontWeight: 600 }}>{isZh ? '实时摘要' : 'Live'}</Box>
              </Box>
              {(isZh ? [
                { label: '执行一致性', val: 82 },
                { label: '较上周', val: 6 },
                { label: '风险敞口', val: 45 },
                { label: '单笔容量集中风险', val: 28 },
                { label: '过度交易', val: 62 },
                { label: '触发 2 次冲动交易', val: 0 },
              ] : [
                { label: 'Execution Consistency', val: 82 },
                { label: 'vs Last Week', val: 6 },
                { label: 'Risk Exposure', val: 45 },
                { label: 'Concentration Risk', val: 28 },
                { label: 'Overtrading', val: 62 },
                { label: '2 Impulsive Trades', val: 0 },
              ]).map((item) => (
                <Box key={item.label} sx={{ mb: item.val === 0 ? 0 : 1 }}>
                  {item.val > 0 && (
                    <>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                        <Typography sx={{ fontSize: 9.5, color: '#94a3b8' }}>{item.label}</Typography>
                        <Typography sx={{ fontSize: 9.5, color: item.val > 60 ? '#00d4aa' : item.val > 30 ? '#f59e0b' : '#ef4444' }}>{item.val}%</Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={item.val}
                        sx={{
                          height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.08)',
                          '& .MuiLinearProgress-bar': { bgcolor: item.val > 60 ? '#00d4aa' : item.val > 30 ? '#f59e0b' : '#ef4444', borderRadius: 2 },
                        }}
                      />
                    </>
                  )}
                  {item.val === 0 && <Typography sx={{ fontSize: 9.5, color: '#ef4444' }}>{item.label}</Typography>}
                </Box>
              ))}
            </Box>
          </Box>

          {/* Chart + Holdings */}
          <Box>
            <Box sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 10, color: '#64748b', mb: 0.8 }}>BTC/USDT &middot; {isZh ? '日线' : 'Daily'}</Typography>
              <Box sx={{ height: 90, position: 'relative', background: 'linear-gradient(180deg,rgba(0,212,170,0.12) 0%,transparent 100%)', borderRadius: 2, overflow: 'hidden' }}>
                {/* Simulated area chart */}
                <svg viewBox="0 0 200 80" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00d4aa" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#00d4aa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <path d="M0,70 C20,65 35,58 50,52 C65,46 80,40 95,38 C110,36 125,28 140,24 C155,20 170,18 190,14 L200,12 L200,80 L0,80 Z" fill="url(#areaGrad)" />
                  <path d="M0,70 C20,65 35,58 50,52 C65,46 80,40 95,38 C110,36 125,28 140,24 C155,20 170,18 190,14 L200,12" fill="none" stroke="#00d4aa" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </Box>
            </Box>

            <Box>
              <Typography sx={{ fontSize: 10, color: '#64748b', mb: 0.8 }}>{isZh ? '监控持仓' : 'Holdings'}</Typography>
              {[
                { sym: 'BTC/USDT', pnl: '+$1,248', c: '#00d4aa' },
                { sym: 'NVDA', pnl: '+$382', c: '#00d4aa' },
                { sym: 'TSLA', pnl: '-$124', c: '#ef4444' },
              ].map((h) => (
                <Box key={h.sym} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.4, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <Typography sx={{ fontSize: 10, color: '#cbd5e1' }}>{h.sym}</Typography>
                  <Typography sx={{ fontSize: 10, fontWeight: 600, color: h.c }}>{h.pnl}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/* ─── Feature Icon Helper ─── */
function FeatureIcon({ children, bg }: { children: React.ReactNode; bg?: string }) {
  return (
    <Box sx={{
      width: 48, height: 48, borderRadius: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: bg || 'rgba(0,212,170,0.1)', color: '#00d4aa', mb: 2,
    }}>
      {children}
    </Box>
  );
}

/* ─── Pricing Tier Card ─── */
interface PricingTierProps {
  name: string;
  price: string;
  period: string;
  features: string[];
  highlighted?: boolean;
  buttonText: string;
  onChoose: () => void;
}
function PricingTierCard({ name, price, period, features, highlighted, buttonText, onChoose }: PricingTierProps) {
  const { t } = useTranslation();
  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.3s, box-shadow 0.3s',
        ...(highlighted
          ? {
              transform: 'scale(1.03)',
              border: '2px solid #00d4aa',
              boxShadow: '0 0 30px rgba(0,212,170,0.15)',
              zIndex: 2,
            }
          : {
              '&:hover': { transform: 'translateY(-4px)', borderColor: 'rgba(0,212,170,0.15)' },
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
          onClick={onChoose}
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
export default function LandingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [selectedTier, setSelectedTier] = useState(1);
  const [userCount, setUserCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/public/stats')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json?.success && typeof json.data?.userCount === 'number') {
          setUserCount(json.data.userCount);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const numberFmt = useMemo(
    () => new Intl.NumberFormat(i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US'),
    [i18n.language],
  );

  const formattedUserCount = userCount !== null
    ? numberFmt.format(userCount)
    : null;

  /* Feature cards data */
  const featureCards = [
    { icon: <AssessmentIcon />, title: t('landing.features.card1Title'), desc: t('landing.features.card1Desc'), bg: 'rgba(99,102,241,0.12)', color: '#818cf8' },
    { icon: <PsychologyIcon />, title: t('landing.features.card2Title'), desc: t('landing.features.card2Desc'), bg: 'rgba(236,72,153,0.12)', color: '#f472b6' },
    { icon: <NoteAddIcon />, title: t('landing.features.card3Title'), desc: t('landing.features.card3Desc') },
    { icon: <EmojiEventsIcon />, title: t('landing.features.card4Title'), desc: t('landing.features.card4Desc'), bg: 'rgba(245,158,11,0.12)', color: '#fbbf24' },
    { icon: <GpsFixedIcon />, title: t('landing.features.card5Title'), desc: t('landing.features.card5Desc'), bg: 'rgba(34,197,94,0.12)', color: '#4ade80' },
    { icon: <StorefrontIcon />, title: t('landing.features.card6Title'), desc: t('landing.features.card6Desc'), bg: 'rgba(148,163,184,0.12)', color: '#94a3b8' },
  ];

  /* Smooth scroll to section */
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  /* Pricing tiers data */
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
    <Box sx={{ bgcolor: '#0a0e17', color: '#f1f5f9', minHeight: '100vh' }}>
      {/* ═════════ NAVBAR ═════════ */}
      <Box
        component="nav"
        sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1100, bgcolor: 'rgba(10,14,23,0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <Container maxWidth="xl">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.2 }}>
            <Box sx={{ cursor: 'pointer' }} onClick={() => window.scrollTo(0, 0)}>
            </Box>

            <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 4 }}>
              <Typography onClick={() => scrollTo('features')} sx={{ fontSize: 20, fontWeight: 600, color: '#94a3b8', cursor: 'pointer', '&:hover': { color: '#fff' }, transition: 'color 0.2s' }}>{t('landing.nav.features')}</Typography>
              <Typography onClick={() => scrollTo('pricing')} sx={{ fontSize: 20, fontWeight: 600, color: '#94a3b8', cursor: 'pointer', '&:hover': { color: '#fff' }, transition: 'color 0.2s' }}>{t('landing.nav.pricing')}</Typography>
              <LanguageSwitcher fontSize={20} />
              <Button onClick={() => navigate('/login')} sx={{ color: '#e2e8f0', fontSize: 20, fontWeight: 500, minWidth: 'auto', px: 1.5 }}>{t('landing.nav.login')}</Button>
              <Button variant="contained" onClick={() => navigate('/register')} sx={{ bgcolor: '#00d4aa', color: '#0a0e17', fontSize: 20, fontWeight: 700, '&:hover': { bgcolor: '#33dfbb' }, boxShadow: 'none' }}>
                {t('landing.nav.freeStart')} &rarr;
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Risk Disclaimer — centered between navbar and hero */}
      <Box sx={{ display: 'flex', justifyContent: 'center', px: { xs: 2, md: 0 }, py: { xs: 2, md: 2 }, mt: { xs: '56px', md: '60px' } }}>
        <Box sx={{ maxWidth: 1200, width: '100%' }}>
          <RiskDisclaimerBanner />
        </Box>
      </Box>

      {/* ═════════ HERO SECTION ═════════ */}
      <Box sx={{ pb: 0 }}>
        {formattedUserCount && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center', px: 2, mt: { xs: 3, md: 4 }, mb: { xs: 0, md: 0.5 } }}>
            <Typography sx={{ fontSize: 30, fontWeight: 700, color: '#64748b', lineHeight: 1.4 }}>
              {t('landing.hero.userCountPrefix')}
              <Box component="span" sx={{ color: '#fbbf24', fontWeight: 700, mx: 0.5 }}>
                {formattedUserCount}
              </Box>
              {t('landing.hero.userCountSuffix')}
            </Typography>
          </Box>
        )}
        <Container maxWidth="xl">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1.1fr' }, gap: { xs: 4, lg: 8 }, alignItems: 'center', minHeight: { lg: 'calc(100vh - 160px)' }, py: { xs: 6, lg: 10 } }}>
            {/* Left content */}
            <Box>
              {/* Logo centered between nav and title */}
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{
                    width: 160, height: 160, borderRadius: 3, bgcolor: '#00d4aa', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'linear-gradient(135deg,#00d4aa 0%,#00a888 100%)',
                  }}>
                    <TrendingUpIcon sx={{ color: '#0a0e17', fontSize: 92 }} />
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography sx={{ fontSize: 72, fontWeight: 1600, lineHeight: 1.2, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>TradeAnchor</Typography>
                    <Typography sx={{ fontSize: 20, letterSpacing: 3, color: '#64748b', textTransform: 'uppercase' }}>{t('landing.hero.tagline')}</Typography>
                  </Box>
                </Box>
              </Box>

              <Typography variant="h1" sx={{ fontSize: { xs: '2.5rem', lg: '3.4rem' }, fontWeight: 800, color: '#fff', mb: 1, lineHeight: 1.15 }}>
                {t('landing.hero.titleLine1')}
              </Typography>
              <Typography variant="h2" sx={{ fontSize: { xs: '2rem', lg: '2.7rem' }, fontWeight: 800, color: '#00d4aa', mb: 3, lineHeight: 1.15 }}>
                {t('landing.hero.titleLine2')}
              </Typography>
              <Typography sx={{ fontSize: { xs: 15, lg: 16 }, color: '#94a3b8', maxWidth: 520, lineHeight: 1.75, mb: 4 }}>
                {t('landing.hero.subtitle')}
              </Typography>

              <Box sx={{ display: 'flex', gap: 2, mb: 5, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => navigate('/register')}
                  sx={{
                    bgcolor: '#00d4aa', color: '#0a0e17', fontSize: 15, fontWeight: 700, px: 4, py: 1.4, borderRadius: 2.5,
                    '&:hover': { bgcolor: '#33dfbb', boxShadow: '0 0 24px rgba(0,212,170,0.35)' },
                    boxShadow: '0 4px 20px rgba(0,212,170,0.2)',
                  }}
                >
                  {t('landing.hero.ctaStart')} &rarr;
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => scrollTo('features')}
                  sx={{
                    borderColor: 'rgba(255,255,255,0.15)', color: '#e2e8f0', fontSize: 15, fontWeight: 600, px: 4, py: 1.4, borderRadius: 2.5,
                    '&:hover': { borderColor: 'rgba(255,255,255,0.35)', bgcolor: 'rgba(255,255,255,0.04)' },
                  }}
                >
                  {t('landing.hero.ctaDemo')}
                </Button>
              </Box>

              {/* Highlight pills */}
              <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap' }}>
                {[
                  { title: t('landing.hero.highlight1Title'), desc: t('landing.hero.highlight1Desc') },
                  { title: t('landing.hero.highlight2Title'), desc: t('landing.hero.highlight2Desc') },
                  { title: t('landing.hero.highlight3Title'), desc: t('landing.hero.highlight3Desc') },
                ].map((h) => (
                  <Box key={h.title} sx={{ flex: { xs: '1 1 150px', sm: '1 1 180px' } }}>
                    <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#00d4aa' }}>{h.title}</Typography>
                    <Typography sx={{ fontSize: 12.5, color: '#64748b', mt: 0.3 }}>{h.desc}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Right — Dashboard mockup (enlarged) */}
            <Box sx={{ transform: { xs: 'none', lg: 'scale(1.35)' }, transformOrigin: 'center center' }}>
              <DashboardMockup />
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ═════════ FEATURES SECTION ═════════ */}
      <Box id="features" sx={{ py: { xs: 8, lg: 12 }, px: { xs: 2, lg: 0 } }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography variant="h3" sx={{ fontSize: { xs: '1.8rem', lg: '2.3rem' }, fontWeight: 800, color: '#fff', mb: 1.5 }}>
              {t('landing.features.sectionTitle')}
            </Typography>
            <Typography sx={{ fontSize: 16, color: '#64748b', maxWidth: 640, mx: 'auto', lineHeight: 1.7 }}>
              {t('landing.features.sectionSubtitle')}
            </Typography>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(3,1fr)' }, gap: 3 }}>
            {featureCards.map((card, idx) => (
              <Box key={idx}>
                <Card
                  elevation={0}
                  sx={{
                    height: '100%',
                    transition: 'transform 0.3s, border-color 0.3s',
                    '&:hover': { transform: 'translateY(-4px)', borderColor: 'rgba(0,212,170,0.2)' },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <FeatureIcon bg={card.bg}>
                      <Box sx={{ color: card.color || '#00d4aa' }}>{card.icon}</Box>
                    </FeatureIcon>
                    <Typography variant="h6" sx={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', mb: 1.2 }}>
                      {card.title}
                    </Typography>
                    <Typography sx={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.7 }}>
                      {card.desc}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* ═════════ PRICING SECTION ═════════ */}
      <Box id="pricing" sx={{ py: { xs: 8, lg: 12 }, px: { xs: 2, lg: 0 }, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography variant="h3" sx={{ fontSize: { xs: '1.8rem', lg: '2.3rem' }, fontWeight: 800, color: '#fff', mb: 1.5 }}>
              {t('landing.pricing.sectionTitle')}
            </Typography>
            <Typography sx={{ fontSize: 16, color: '#64748b', maxWidth: 600, mx: 'auto', lineHeight: 1.7 }}>
              {t('landing.pricing.sectionSubtitle')}
            </Typography>
          </Box>

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
                onChoose={() => { setSelectedTier(idx); navigate('/register'); }}
              />
            ))}
          </Box>
        </Container>
      </Box>

      {/* ═════════ CTA SECTION ═════════ */}
      <Box sx={{ py: { xs: 8, lg: 10 }, px: 3 }}>
        <Container maxWidth="md">
          <Box
            sx={{
              background: 'linear-gradient(135deg, rgba(0,60,70,0.7) 0%, rgba(0,40,55,0.85) 50%, rgba(10,20,35,0.9) 100%)',
              borderRadius: 4, p: { xs: 5, lg: 8 }, textAlign: 'center',
              border: '1px solid rgba(0,212,170,0.12)',
              position: 'relative', overflow: 'hidden',
            }}
          >
            <Box sx={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', bgcolor: 'rgba(0,212,170,0.04)', filter: 'blur(60px)' }} />
            <Box sx={{ position: 'absolute', bottom: -60, left: -60, width: 250, height: 250, borderRadius: '50%', bgcolor: 'rgba(0,180,216,0.04)', filter: 'blur(50px)' }} />

            <Typography variant="h3" sx={{ fontSize: { xs: '1.8rem', lg: '2.3rem' }, fontWeight: 800, color: '#fff', mb: 2, position: 'relative', zIndex: 1 }}>
              {t('landing.cta.title')}
            </Typography>
            <Typography sx={{ fontSize: 16, color: '#94a3b8', maxWidth: 560, mx: 'auto', lineHeight: 1.75, mb: 4, position: 'relative', zIndex: 1 }}>
              {t('landing.cta.description')}
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2.5, mb: 5, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate('/register')}
                sx={{
                  bgcolor: '#00d4aa', color: '#0a0e17', fontSize: 16, fontWeight: 700, px: 5, py: 1.5, borderRadius: 2.5,
                  '&:hover': { bgcolor: '#33dfbb', boxShadow: '0 0 28px rgba(0,212,170,0.4)' },
                  boxShadow: '0 4px 24px rgba(0,212,170,0.25)',
                }}
              >
                {t('landing.cta.buttonStart')} &rarr;
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => navigate('/login')}
                sx={{
                  borderColor: 'rgba(255,255,255,0.18)', color: '#e2e8f0', fontSize: 16, fontWeight: 600, px: 5, py: 1.5, borderRadius: 2.5,
                  '&:hover': { borderColor: 'rgba(255,255,255,0.35)', bgcolor: 'rgba(255,255,255,0.05)' },
                }}
              >
                {t('landing.cta.buttonLogin')}
              </Button>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 5, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
              {[t('landing.cta.trust1'), t('landing.cta.trust2'), t('landing.cta.trust3')].map((trust) => (
                <Typography key={trust} sx={{ fontSize: 12.5, color: '#64748b' }}>{trust}</Typography>
              ))}
            </Box>
          </Box>
        </Container>
      </Box>

      <LegalFooter />
    </Box>
  );
}
