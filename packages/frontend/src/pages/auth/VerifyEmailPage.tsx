import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import { useVerifyEmailMutation } from '../../store/authApi';

export default function VerifyEmailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [verifyEmail, { isLoading }] = useVerifyEmailMutation();

  // States: 'verifying' | 'success' | 'error'
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setErrorMessage(t('auth.verifyError', 'Invalid verification link. Token is missing.'));
      return;
    }

    // Auto-verify on page load
    verifyEmail({ token })
      .unwrap()
      .then(() => {
        setStatus('success');
      })
      .catch((err) => {
        const apiError = err as {
          data?: { message?: string; error?: string };
        };
        setStatus('error');
        setErrorMessage(
          apiError.data?.message ||
          apiError.data?.error ||
          t('auth.verifyFailed', 'Verification failed. The link may be expired or invalid.'),
        );
      });
    // Only run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: '#0a0e17',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    }}>
      {/* Top-right language switcher */}
      <Box sx={{ position: 'absolute', top: 16, right: { xs: 12, md: 32 }, zIndex: 10 }}>
        <LanguageSwitcher />
      </Box>

      <Box sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
      }}>
        {/* Logo */}
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Box sx={{
            width: 80, height: 80, borderRadius: 2, bgcolor: '#00d4aa', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg,#00d4aa 0%,#00a888 100%)',
            mx: 'auto',
            mb: 2,
          }}>
            <TrendingUpIcon sx={{ color: '#0a0e17', fontSize: 46 }} />
          </Box>
          <Typography component="span" sx={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>{t('auth.brandName', 'TradeAnchor')}</Typography>
        </Box>

        {/* Verifying */}
        {status === 'verifying' && (
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress size={48} sx={{ color: '#00d4aa', mb: 3 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#e2e8f0' }}>
              {t('auth.verifying', 'Verifying your email...')}
            </Typography>
            <Typography sx={{ mt: 1, color: '#64748b', fontSize: 14 }}>
              {t('auth.verifyingHint', 'Please wait while we confirm your email address.')}
            </Typography>
          </Box>
        )}

        {/* Success */}
        {status === 'success' && (
          <Box sx={{ textAlign: 'center', maxWidth: 400 }}>
            <CheckCircleIcon sx={{ fontSize: 72, color: '#00d4aa', mb: 2 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>
              {t('auth.emailVerified', 'Email Verified!')}
            </Typography>
            <Typography sx={{ mb: 3, color: '#94a3b8', fontSize: 15 }}>
              {t('auth.emailVerifiedDesc', 'Your email has been successfully verified. You can now log in to your account.')}
            </Typography>
            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={() => navigate('/login')}
              sx={{
                py: 1.4,
                borderRadius: 2.5,
                bgcolor: '#2563eb',
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                '&:hover': { bgcolor: '#3b82f6', boxShadow: '0 0 20px rgba(37,99,235,0.35)' },
                boxShadow: 'none',
                mb: 2,
              }}
            >
              {t('auth.goToLogin', 'Go to Sign In')}
            </Button>
            <Box sx={{ textAlign: 'center' }}>
              <Typography
                component={RouterLink}
                to="/"
                sx={{ color: '#64748b', textDecoration: 'none', fontSize: 14, '&:hover': { textDecoration: 'underline' } }}
              >
                {t('auth.backToHome', 'Back to Home')}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Error */}
        {status === 'error' && (
          <Box sx={{ textAlign: 'center', maxWidth: 400 }}>
            <ErrorIcon sx={{ fontSize: 72, color: '#ef476f', mb: 2 }} />
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>
              {t('auth.verifyErrorTitle', 'Verification Failed')}
            </Typography>
            <Alert severity="error" sx={{
              mb: 3, borderRadius: 2,
              bgcolor: 'rgba(127,29,29,0.15)',
              color: '#fca5a5',
              border: '1px solid rgba(248,113,113,0.2)',
              '& .MuiAlert-icon': { color: '#ef4444' },
            }}>
              {errorMessage}
            </Alert>
            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={() => navigate('/login')}
              sx={{
                py: 1.4,
                borderRadius: 2.5,
                bgcolor: '#2563eb',
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                '&:hover': { bgcolor: '#3b82f6', boxShadow: '0 0 20px rgba(37,99,235,0.35)' },
                boxShadow: 'none',
                mb: 1.5,
              }}
            >
              {t('auth.goToLogin', 'Go to Sign In')}
            </Button>
            <Box sx={{ textAlign: 'center', display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Typography
                component={RouterLink}
                to="/register"
                sx={{ color: '#00d4aa', textDecoration: 'none', fontSize: 14 }}
              >
                {t('auth.registerAgain', 'Register again')}
              </Typography>
              <Typography
                component={RouterLink}
                to="/"
                sx={{ color: '#64748b', textDecoration: 'none', fontSize: 14 }}
              >
                {t('auth.backToHome', 'Back to Home')}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
