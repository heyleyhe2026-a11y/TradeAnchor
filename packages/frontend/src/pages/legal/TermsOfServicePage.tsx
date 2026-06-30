import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import LegalFooter from '../../components/LegalFooter';
import { usePageSeo } from '../../hooks/usePageSeo';

export default function TermsOfServicePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isZh = i18n.language.startsWith('zh');

  usePageSeo({
    title: `${t('terms.title')} | TradeAnchor`,
    description: t('terms.intro1').replace(/<[^>]+>/g, ''),
    path: '/terms',
    lang: isZh ? 'zh-CN' : 'en',
  });

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0e17', color: '#f1f5f9', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
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
                <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.3px', lineHeight: 1.3 }}>TradeAnchor</Typography>
                <Typography sx={{ fontSize: 10.5, letterSpacing: 1.8, color: '#64748b', textTransform: 'uppercase', lineHeight: 1.3 }}>SMART TRADING JOURNAL TOOL</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <LanguageSwitcher />
              <Typography onClick={() => navigate('/')} sx={{ fontSize: 13.5, color: '#94a3b8', cursor: 'pointer', '&:hover': { color: '#fff' }, textTransform: 'none' }}>
                {t('footer.backHome')}
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, py: { xs: 6, md: 8 }, px: { xs: 2, lg: 0 } }}>
        <Container maxWidth="md">
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#fff', mb: 1, textAlign: 'center' }}>
            {t('terms.title')}
          </Typography>
          <Typography sx={{ textAlign: 'center', color: '#64748b', mb: 6, fontSize: 14 }}>
            {t('terms.lastUpdated')}
          </Typography>

          {/* Sections */}
          {[
            { key: 'intro', titleKey: 'terms.section1Title' },
            { key: 'account', titleKey: 'terms.section2Title' },
            { key: 'use', titleKey: 'terms.section3Title' },
            { key: 'content', titleKey: 'terms.section4Title' },
            { key: 'marketplace', titleKey: 'terms.section4bTitle' },
            { key: 'subscription', titleKey: 'terms.section5Title' },
            { key: 'credits', titleKey: 'terms.section6Title' },
            { key: 'disclaimer', titleKey: 'terms.section7Title' },
            { key: 'termination', titleKey: 'terms.section8Title' },
            { key: 'changes', titleKey: 'terms.section9Title' },
            { key: 'contact', titleKey: 'terms.section10Title' },
          ].map((section) => (
            <Box key={section.key} sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#00d4aa', mb: 1.5, fontSize: 16 }}>
                {t(section.titleKey)}
              </Typography>
              {Array.from({ length: 20 }, (_, i) => t(`terms.${section.key}${i + 1}` || '', '')).filter(Boolean).map((text, i) => (
                <Typography key={i} component="div" sx={{
                  fontSize: 14, color: '#cbd5e1', lineHeight: 1.85, mb: 0.8,
                  '& a': { color: '#00d4aa', textDecoration: 'none' },
                  '& a:hover': { textDecoration: 'underline' },
                }} dangerouslySetInnerHTML={{ __html: text }} />
              ))}
            </Box>
          ))}
        </Container>
      </Box>

      <LegalFooter />
    </Box>
  );
}
