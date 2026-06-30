import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
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
  Autocomplete,
} from '@mui/material';
import RiskDisclaimerBanner from '../../components/RiskDisclaimerBanner';
import LegalFooter from '../../components/LegalFooter';

import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import GoogleIcon from '@mui/icons-material/Google';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import { useRegisterMutation, oauthUrls } from '../../store/authApi';
import { countries, Country, getCountriesSorted } from '../../data/countries';
import { getAttributionForRegister } from '../../utils/signupAttribution';

export default function RegisterPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [register, { isLoading }] = useRegisterMutation();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(countries.find(c => c.code === 'US') || null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Get sorted countries based on current language
  const sortedCountries = useMemo(() => {
    const locale = i18n.language.startsWith('zh') ? 'zh' : 'en';
    return getCountriesSorted(locale);
  }, [i18n.language]);

  // Get country display label based on locale
  const getCountryLabel = (country: Country) => {
    const locale = i18n.language.startsWith('zh') ? 'zh' : 'en';
    return locale === 'zh' && country.nameZh ? `${country.nameZh} (${country.code})` : `${country.name} (${country.code})`;
  };

  // Error state
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  // Password strength validation
  const getPasswordStrengthError = (pwd: string): string | null => {
    if (pwd.length < 8) return t('auth.errors.passwordTooShort');
    if (!/[a-z]/.test(pwd)) return t('auth.errors.passwordLowercase');
    if (!/[A-Z]/.test(pwd)) return t('auth.errors.passwordUppercase');
    if (!/\d/.test(pwd)) return t('auth.errors.passwordNumber');
    if (!/[@$!%*?&]/.test(pwd)) return t('auth.errors.passwordSpecial');
    if (pwd.length > 128) return t('auth.errors.passwordTooLong');
    return null;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!email || !email.includes('@')) {
      setFieldErrors((prev) => ({ ...prev, email: t('auth.errors.invalidEmail') }));
      return;
    }

    const pwdError = getPasswordStrengthError(password);
    if (pwdError) {
      setFieldErrors((prev) => ({ ...prev, password: pwdError }));
      return;
    }

    if (password !== confirmPassword) {
      setFieldErrors((prev) => ({ ...prev, confirmPassword: t('auth.errors.passwordMismatch') }));
      return;
    }

    try {
      await register({
        email: email.toLowerCase().trim(),
        password,
        countryCode: selectedCountry?.code || 'US',
        attribution: getAttributionForRegister(),
      }).unwrap();
      setSuccess(true);
      setError(null);
    } catch (err: unknown) {
      const apiError = err as { data?: { error?: string; message?: string; details?: Array<{ field?: string; message?: string }> } };
      if (apiError.data?.details && Array.isArray(apiError.data.details)) {
        const errors: Record<string, string> = {};
        apiError.data.details.forEach((detail) => {
          if (detail.field && detail.message) errors[detail.field] = detail.message;
        });
        setFieldErrors(errors);
        setError(apiError.data.message || t('auth.errors.registrationFailed'));
      } else if (apiError.data?.message?.includes('already exists')) {
        setError(t('auth.errors.emailExists'));
      } else {
        setError(
          apiError.data?.message ||
          (typeof apiError.data === 'string' ? apiError.data : null) ||
          t('auth.errors.registrationFailed')
        );
      }
    }
  };

  // Success view
  if (success) {
    return (
      <>
      <Box sx={{
        minHeight: '100vh',
        bgcolor: '#0a0e17',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}>
        <Box sx={{ position: 'absolute', top: 16, right: { xs: 12, md: 32 }, zIndex: 10 }}>
          <LanguageSwitcher />
        </Box>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 2 }}>
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.2, mb: 1 }}>
              <Box sx={{
                width: 80, height: 80, borderRadius: 2, bgcolor: '#00d4aa', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg,#00d4aa 0%,#00a888 100%)',
              }}>
                <TrendingUpIcon sx={{ color: '#0a0e17', fontSize: 46 }} />
              </Box>
            </Box>
            <Typography component="span" sx={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>TradeAnchor</Typography>
            <Typography sx={{ fontSize: 11, letterSpacing: 3, color: '#64748b', textTransform: 'uppercase' }}>SMART TRADING JOURNAL TOOL</Typography>
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 700, color: '#00d4aa', mb: 2, textAlign: 'center' }}>
            {t('auth.registrationSuccess')}
          </Typography>
          <Typography sx={{ color: '#94a3b8', mb: 3, textAlign: 'center' }}>
            {t('auth.verifyEmailSent')}
          </Typography>
          <Button variant="contained" onClick={() => navigate('/login')} fullWidth size="large" sx={{
            maxWidth: 400, py: 1.4, borderRadius: 2.5, bgcolor: '#2563eb', color: '#fff',
            '&:hover': { bgcolor: '#3b82f6', boxShadow: '0 0 20px rgba(37,99,235,0.35)' },
            boxShadow: 'none',
          }}>
            {t('auth.goToLogin')}
          </Button>
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Link component={RouterLink} to="/" variant="body2" sx={{ color: '#64748b', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {t('auth.backToHome')}
            </Link>
          </Box>
        </Box>
      </Box>
      <LegalFooter />
      </>
    );
  }

  // Register form view
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
        overflowY: 'auto',
        py: 4,
      }}>
        {/* Logo */}
        <Box sx={{ mb: 3, textAlign: 'center' }}>
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
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#f1f5f9', mb: 2.5 }}>
          {t('auth.register')}
        </Typography>

        <Typography sx={{ fontSize: 13, color: '#64748b', mb: 2, maxWidth: 380, textAlign: 'center' }}>
          {t('landing.hero.subtitle')}
        </Typography>

        {/* OAuth Buttons - quick register with OAuth providers */}
        <Box sx={{ width: '100%', maxWidth: 400, mb: 2 }}>
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
            Google
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
          <Alert severity="error" sx={{ mb: 2, maxWidth: 400, width: '100%', borderRadius: 2, bgcolor: 'rgba(127,29,29,0.15)', color: '#fca5a5', border: '1px solid rgba(248,113,113,0.2)', '& .MuiAlert-icon': { color: '#ef4444' } }}>
            {error}
          </Alert>
        )}

        {/* Form */}
        <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%', maxWidth: 400 }}>
          <TextField
            fullWidth
            id="email"
            label={`${t('auth.email')} *`}
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
            label={`${t('auth.password')} *`}
            type={showPassword ? 'text' : 'password'}
            id="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={!!fieldErrors.password}
            helperText={fieldErrors.password || t('auth.passwordHint')}
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
              '& .MuiFormHelperText-root': { color: fieldErrors.password ? '#ef4444' : '#64748b' },
            }}
          />

          <TextField
            fullWidth
            name="confirmPassword"
            label={`${t('auth.confirmPassword')} *`}
            type={showConfirmPassword ? 'text' : 'password'}
            id="confirmPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={!!fieldErrors.confirmPassword}
            helperText={fieldErrors.confirmPassword}
            slotProps={{
              htmlInput: { style: { color: '#e2e8f0' } },
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end" sx={{ color: '#94a3b8' }}>
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
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

          <Autocomplete
            options={sortedCountries}
            value={selectedCountry}
            onChange={(_event, newValue) => setSelectedCountry(newValue)}
            getOptionLabel={(option) => getCountryLabel(option)}
            isOptionEqualToValue={(option, value) => option.code === value.code}
            renderInput={(params) => (
              <TextField
                {...params}
                name="country"
                label={t('auth.country')}
                helperText={t('auth.selectCountryHint')}
                sx={{
                  mb: 3,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    bgcolor: 'rgba(255,255,255,0.04)',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
                    '&.Mui-focused fieldset': { borderColor: '#00d4aa' },
                  },
                  '& .MuiInputLabel-root': { color: '#94a3b8' },
                  '& .MuiFormHelperText-root': { color: '#64748b' },
                  '& .MuiAutocomplete-popupIndicator': { color: '#94a3b8' },
                  '& .MuiAutocomplete-clearIndicator': { color: '#94a3b8' },
                }}
              />
            )}
            renderOption={(props, option) => (
              <Box component="li" {...props} sx={{ color: '#e2e8f0', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}>
                {getCountryLabel(option)}
              </Box>
            )}
            sx={{
              '& .MuiAutocomplete-popup': {
                '& .MuiPaper-root': {
                  bgcolor: '#1a1f2e',
                  border: '1px solid rgba(255,255,255,0.12)',
                },
              },
            }}
          />

          <Box sx={{ position: 'relative', mb: 2.5 }}>
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
              {isLoading ? '' : t('auth.register')}
            </Button>
            {isLoading && (
              <CircularProgress size={24} sx={{ position: 'absolute', top: '50%', left: '50%', mt: '-12px', ml: '-12px', color: '#fff' }} />
            )}
          </Box>

          <Box sx={{ textAlign: 'center', mb: 0.5 }}>
            <Link component={RouterLink} to="/login" variant="body2" sx={{ color: '#00d4aa', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {t('auth.hasAccount')}
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
    </Box>
  );
}
