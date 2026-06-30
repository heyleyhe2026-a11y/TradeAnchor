import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Button, Card, CardContent,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckIcon from '@mui/icons-material/Check';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import LegalFooter from '../../components/LegalFooter';
import RiskDisclaimerBanner from '../../components/RiskDisclaimerBanner';
import { usePageSeo } from '../../hooks/usePageSeo';
import { getSeoLandingContent, type SeoLandingSlug } from '../../data/seoLandingPages';

interface Props {
  slug: SeoLandingSlug;
}

export default function SeoLandingPage({ slug }: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isZh = i18n.language.startsWith('zh');
  const page = getSeoLandingContent(slug, i18n.language);

  const jsonLd = useMemo(
    () => [{
      id: `${slug}-faq`,
      data: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: page.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.q,
          acceptedAnswer: { '@type': 'Answer', text: faq.a },
        })),
      },
    }],
    [slug, page.faqs],
  );

  usePageSeo({
    title: page.metaTitle,
    description: page.metaDescription,
    path: `/${slug}`,
    lang: isZh ? 'zh-CN' : 'en',
    jsonLd,
  });

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0e17', color: '#f1f5f9', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{
        position: 'sticky', top: 0, zIndex: 100,
        bgcolor: 'rgba(10,14,23,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, cursor: 'pointer' }} onClick={() => navigate('/')}>
              <Box sx={{
                width: 40, height: 40, borderRadius: 1.5,
                background: 'linear-gradient(135deg,#00d4aa 0%,#00a888 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <TrendingUpIcon sx={{ color: '#0a0e17', fontSize: 24 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', lineHeight: 1.3 }}>TradeAnchor</Typography>
                <Typography sx={{ fontSize: 10.5, letterSpacing: 1.8, color: '#64748b', textTransform: 'uppercase', lineHeight: 1.3 }}>
                  {t('landing.hero.tagline')}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography onClick={() => navigate('/pricing')} sx={{ fontSize: 13.5, color: '#94a3b8', cursor: 'pointer', display: { xs: 'none', sm: 'block' }, '&:hover': { color: '#fff' } }}>
                {t('landing.nav.pricing')}
              </Typography>
              <LanguageSwitcher />
              <Button
                variant="contained"
                size="small"
                onClick={() => navigate('/register')}
                sx={{ bgcolor: '#00d4aa', color: '#0a0e17', fontWeight: 700, '&:hover': { bgcolor: '#33dfbb' }, boxShadow: 'none' }}
              >
                {t('landing.nav.freeStart')}
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      <Box sx={{ py: { xs: 5, md: 8 }, px: { xs: 2, lg: 0 }, flex: 1 }}>
        <Container maxWidth="md">
          <Typography component="h1" variant="h3" sx={{ fontWeight: 800, color: '#fff', mb: 2, fontSize: { xs: '1.75rem', md: '2.25rem' }, lineHeight: 1.2 }}>
            {page.h1}
          </Typography>
          <Typography sx={{ fontSize: { xs: 16, md: 18 }, color: '#94a3b8', mb: 4, lineHeight: 1.75 }}>
            {page.subtitle}
          </Typography>

          {page.intro.map((para) => (
            <Typography key={para.slice(0, 40)} sx={{ fontSize: 15, color: '#cbd5e1', mb: 2.5, lineHeight: 1.8 }}>
              {para}
            </Typography>
          ))}

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', my: 4 }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/register')}
              sx={{
                bgcolor: '#00d4aa', color: '#0a0e17', fontWeight: 700, px: 4,
                '&:hover': { bgcolor: '#33dfbb', boxShadow: '0 0 24px rgba(0,212,170,0.35)' },
              }}
            >
              {t('landing.hero.ctaStart')} →
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/pricing')}
              sx={{ borderColor: 'rgba(255,255,255,0.15)', color: '#e2e8f0', fontWeight: 600, px: 4 }}
            >
              {isZh ? '查看价格' : 'View Pricing'}
            </Button>
          </Box>

          <Typography component="h2" variant="h5" sx={{ fontWeight: 700, color: '#00d4aa', mb: 2.5, mt: 5 }}>
            {isZh ? '核心功能' : 'Key Features'}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 5 }}>
            {page.features.map((f) => (
              <Card key={f.title} elevation={0} sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2 }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <CheckIcon sx={{ color: '#00d4aa', fontSize: 20, mt: 0.2 }} />
                    <Typography sx={{ fontWeight: 700, color: '#f1f5f9', fontSize: 15 }}>{f.title}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: 13.5, color: '#94a3b8', lineHeight: 1.65, pl: 3.5 }}>{f.desc}</Typography>
                </CardContent>
              </Card>
            ))}
          </Box>

          <Typography component="h2" variant="h5" sx={{ fontWeight: 700, color: '#00d4aa', mb: 2.5 }}>
            {isZh ? '常见问题' : 'Frequently Asked Questions'}
          </Typography>
          {page.faqs.map((faq) => (
            <Box key={faq.q} sx={{ mb: 3 }}>
              <Typography component="h3" sx={{ fontWeight: 700, color: '#f1f5f9', fontSize: 16, mb: 0.75 }}>
                {faq.q}
              </Typography>
              <Typography sx={{ fontSize: 14.5, color: '#94a3b8', lineHeight: 1.75 }}>{faq.a}</Typography>
            </Box>
          ))}
        </Container>
      </Box>

      <Box sx={{ px: 2, pb: 2 }}>
        <RiskDisclaimerBanner />
      </Box>
      <LegalFooter />
    </Box>
  );
}
