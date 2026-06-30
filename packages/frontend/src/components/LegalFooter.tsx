import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Container, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

export default function LegalFooter() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Box sx={{
      borderTop: '1px solid rgba(255,255,255,0.06)',
      py: { xs: 2.5, md: 3 },
      px: 2,
      bgcolor: 'rgba(10,14,23,0.6)',
      mt: 'auto',
    }}>
      <Container maxWidth="lg">
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: { xs: 1.5, md: 2.5 },
        }}>
          {/* Brand */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, cursor: 'pointer' }} onClick={() => navigate('/')}>
            <Box
              sx={{
                width: 40, height: 40, borderRadius: 1.5,
                background: 'linear-gradient(135deg,#00d4aa 0%,#00a888 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <TrendingUpIcon sx={{ color: '#0a0e17', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.3px', lineHeight: 1.3 }}>
                TradeAnchor
              </Typography>
              <Typography sx={{ fontSize: 10.5, letterSpacing: 1.8, color: '#64748b', textTransform: 'uppercase', lineHeight: 1.3 }}>
                SMART TRADING JOURNAL TOOL
              </Typography>
            </Box>
          </Box>

          {/* Links */}
          <Box sx={{ display: 'flex', gap: { xs: 1.5, md: 3 }, alignItems: 'center' }}>
            <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#94a3b8', textDecoration: 'none' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#00d4aa')} onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}>
              {t('footer.terms')}
            </a>
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#94a3b8', textDecoration: 'none' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#00d4aa')} onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}>
              {t('footer.privacy')}
            </a>
            <a href="/refund" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#94a3b8', textDecoration: 'none' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#00d4aa')} onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}>
              {t('footer.refund')}
            </a>
          </Box>

          {/* Copyright */}
          <Typography sx={{ fontSize: 11, color: '#475569' }}>
            {t('footer.copyright')}
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
