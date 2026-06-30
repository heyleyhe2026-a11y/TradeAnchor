import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Link,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Divider,
} from '@mui/material';
import RiskDisclaimerBanner from '../../components/RiskDisclaimerBanner';
import LegalFooter from '../../components/LegalFooter';

import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import GoogleIcon from '@mui/icons-material/Google';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import { useLoginMutation } from '../../store/authApi';
import { tokenStorage, parseOAuthCallback, oauthUrls } from '../../store/authApi';
import PasswordResetDialog from '../../components/PasswordResetDialog';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [login, { isLoading }] = useLoginMutation();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Error / success state
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [resetOpen, setResetOpen] = useState(false);

  // Handle OAuth callback on page load
  useEffect(() => {
    // Check for OAuth error
    const oauthError = searchParams.get('oauthError');
    if (oauthError) {
      setError(decodeURIComponent(oauthError));
      window.history.replaceState({}, '', '/login');
      return;
    }

    // Check for successful OAuth login
    const oauthData = parseOAuthCallback(searchParams);
    if (oauthData) {
      tokenStorage.setTokens(oauthData.accessToken, oauthData.refreshToken);
      tokenStorage.setUser({ ...oauthData.user, emailVerified: oauthData.user?.emailVerified ?? true });
      window.history.replaceState({}, '', '/dashboard');
      navigate('/dashboard', { replace: true });
      return;
    }
  }, [searchParams]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!email || !email.includes('@')) {
      setFieldErrors((prev) => ({ ...prev, email: t('auth.errors.invalidEmail', 'Invalid email format') }));
      return;
    }

    if (!password) {
      setFieldErrors((prev) => ({ ...prev, password: t('auth.errors.passwordRequired', 'Password is required') }));
      return;
    }

    try {
      const result = await login({
        email: email.toLowerCase().trim(),
        password,
      }).unwrap();

      tokenStorage.setTokens(result.data.accessToken, result.data.refreshToken);
      tokenStorage.setUser(result.data.user);
      setError(null);
      navigate('/dashboard');
    } catch (err: unknown) {
      const apiError = err as {
        status?: number;
        data?: { error?: string; message?: string; details?: Array<{ field?: string; message?: string }> };
      };

      if (apiError.status === 423) {
        setError(apiError.data?.message || t('auth.errors.accountLocked', 'Account locked'));
      } else if (apiError.data?.details && Array.isArray(apiError.data.details)) {
        const errors: Record<string, string> = {};
        apiError.data.details.forEach((detail) => {
          if (detail.field && detail.message) errors[detail.field] = detail.message;
        });
        setFieldErrors(errors);
        setError(apiError.data.message || t('auth.errors.loginFailed', 'Login failed'));
      } else if (apiError.status === 401 || apiError.data?.message?.includes('Invalid')) {
        setError(t('auth.errors.invalidCredentials', 'Invalid email or password'));
      } else {
        setError(apiError.data?.message || t('auth.errors.loginFailed', 'Login failed'));
      }
    }
  };

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
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.2, mb: 1 }}>
            <Box sx={{
              width: 80, height: 80, borderRadius: 2, bgcolor: '#00d4aa', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg,#00d4aa 0%,#00a888 100%)',
            }}>
              <TrendingUpIcon sx={{ color: '#0a0e17', fontSize: 46 }} />
            </Box>
          </Box>
          <Typography component="span" sx={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>{t('auth.brandName', 'TradeAnchor')}</Typography>
          <Typography sx={{ fontSize: 11, letterSpacing: 3, color: '#64748b', textTransform: 'uppercase' }}>SMART TRADING JOURNAL TOOL</Typography>
        </Box>

        {/* Title */}
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#f1f5f9', mb: 3 }}>
          {t('auth.login')}
        </Typography>

        {/* OAuth Buttons */}
        <Box sx={{ width: '100%', maxWidth: 400, mb: 2.5 }}>
          <Button
            fullWidth
            size="large"
            startIcon={<GoogleIcon />}
            onClick={() => window.location.href = oauthUrls.google()}
            sx={{
              py: 1.2,
              borderRadius: 2.5,
              bgcolor: '#fff',
              color: '#333',
              fontSize: 14,
              fontWeight: 600,
              textTransform: 'none',
              border: '1px solid rgba(255,255,255,0.15)',
              '&:hover': { bgcolor: '#f5f5f5', borderColor: 'rgba(255,255,255,0.3)' },
            }}
          >
            {t('auth.oauthGoogle')}
          </Button>
        </Box>

        {/* Divider */}
        <Box sx={{ width: '100%', maxWidth: 400, display: 'flex', alignItems: 'center', my: 2, gap: 1.5 }}>
          <Divider sx={{ flex: 1, borderColor: 'rgba(255,255,255,0.08)' }} />
          <Typography sx={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{t('auth.orContinueWith') || 'or continue with'}</Typography>
          <Divider sx={{ flex: 1, borderColor: 'rgba(255,255,255,0.08)' }} />
        </Box>

        {/* Error alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2, maxWidth: 400, borderRadius: 2, '& .MuiAlert-icon': { color: '#ef4444' }, bgcolor: 'rgba(127,29,29,0.15)', color: '#fca5a5', border: '1px solid rgba(248,113,113,0.2)' }}>
            {error}
          </Alert>
        )}

        {/* Form */}
        <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%', maxWidth: 400 }}>
          <TextField
            fullWidth
            id="email"
            label={t('auth.email', 'Email Address')}
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={!!fieldErrors.email}
            helperText={fieldErrors.email}
            slotProps={{ htmlInput: { style: { color: '#e2e8f0' } } }}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.04)',
                borderColor: 'rgba(255,255,255,0.12)',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
                '&.Mui-focused fieldset': { borderColor: '#00d4aa' },
              },
              '& .MuiInputLabel-root': { color: '#94a3b8' },
              '& .MuiFormHelperText-root': { color: '#ef4444' },
            }}
          />

          <TextField
            fullWidth
            name="password"
            label={t('auth.password', 'Password')}
            type={showPassword ? 'text' : 'password'}
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={!!fieldErrors.password}
            helperText={fieldErrors.password}
            slotProps={{
              htmlInput: { style: { color: '#e2e8f0' } },
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: '#94a3b8' }}>
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              mb: 1,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.04)',
                borderColor: 'rgba(255,255,255,0.12)',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
                '&.Mui-focused fieldset': { borderColor: '#00d4aa' },
              },
              '& .MuiInputLabel-root': { color: '#94a3b8' },
              '& .MuiFormHelperText-root': { color: '#ef4444' },
            }}
          />

          <Box sx={{ textAlign: 'right', mb: 2 }}>
            <Link
              component="button"
              type="button"
              variant="body2"
              onClick={() => setResetOpen(true)}
              sx={{ color: '#94a3b8', textDecoration: 'none', cursor: 'pointer', '&:hover': { color: '#00d4aa', textDecoration: 'underline' } }}
            >
              {t('auth.forgotPassword')}
            </Link>
          </Box>

          <Box sx={{ position: 'relative', mb: 3 }}>
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={isLoading}
              size="large"
              sx={{
                py: 1.4,
                borderRadius: 2.5,
                bgcolor: '#2563eb',
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                '&:hover': { bgcolor: '#3b82f6', boxShadow: '0 0 20px rgba(37,99,235,0.35)' },
                boxShadow: 'none',
              }}
            >
              {isLoading ? '' : t('auth.login')}
            </Button>
            {isLoading && (
              <CircularProgress size={24} sx={{ position: 'absolute', top: '50%', left: '50%', mt: '-12px', ml: '-12px', color: '#fff' }} />
            )}
          </Box>

          <Box sx={{ textAlign: 'center', mb: 1 }}>
            <Link component={RouterLink} to="/register" variant="body2" sx={{ color: '#00d4aa', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {t('auth.noAccount')}
            </Link>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Link component={RouterLink} to="/" variant="body2" sx={{ color: '#64748b', textDecoration: 'none', '&:hover': { color: '#94a3b8', textDecoration: 'underline' } }}>
              {t('auth.backToHome')}
            </Link>
          </Box>
          <RiskDisclaimerBanner />
        </Box>
      </Box>
      <LegalFooter />

      <PasswordResetDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        mode="forgot"
        defaultEmail={email}
      />
    </Box>
  );
}
