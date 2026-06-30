import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Button, Alert, IconButton, CircularProgress, Snackbar,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EmailIcon from '@mui/icons-material/Email';
import { useResendVerificationMutation } from '../store/authApi';

interface EmailVerificationPromptProps {
  /** User's email address */
  email: string;
  /** Whether to show as a full-width banner (true) or compact inline (false) */
  variant?: 'banner' | 'inline';
  /** Callback after successful verification email resend */
  onResent?: () => void;
}

export default function EmailVerificationPrompt({
  email,
  variant = 'banner',
  onResent,
}: EmailVerificationPromptProps) {
  const { t } = useTranslation();
  const [resendVerification, { isLoading }] = useResendVerificationMutation();
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResend = async () => {
    setError(null);
    setShowSuccess(false);
    try {
      await resendVerification().unwrap();
      setShowSuccess(true);
      onResent?.();
    } catch (err: any) {
      const msg = err?.data?.message || err?.data?.error || t('auth.resendFailed', 'Failed to send verification email. Please try again later.');
      setError(msg);
    }
  };

  // Mask email for privacy
  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');

  if (variant === 'inline') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Alert
          severity="warning"
          sx={{
            flex: 1,
            minWidth: 200,
            bgcolor: 'rgba(234,179,8,0.08)',
            color: '#fbbf24',
            border: '1px solid rgba(234,179,8,0.2)',
            '& .MuiAlert-icon': { color: '#f59e0b' },
            '& .MuiAlert-message': { py: 0.5 },
          }}
        >
          <Typography variant="body2" sx={{ fontSize: 13 }}>
            {t('auth.emailNotVerified', 'Email not verified')}: {maskedEmail}
          </Typography>
        </Alert>
        <Button
          size="small"
          variant="outlined"
          disabled={isLoading}
          onClick={handleResend}
          startIcon={isLoading ? <CircularProgress size={14} /> : <EmailIcon sx={{ fontSize: 16 }} />}
          sx={{
            textTransform: 'none',
            borderRadius: 2,
            borderColor: '#f59e0b',
            color: '#fbbf24',
            fontSize: 13,
            '&:hover': { bgcolor: 'rgba(245,158,11,0.08)', borderColor: '#fbbf24' },
            whiteSpace: 'nowrap',
          }}
        >
          {isLoading ? (t('auth.sending', 'Sending...')) : t('auth.resendVerification', 'Resend verification email')}
        </Button>
        {error && (
          <Typography variant="caption" sx={{ color: '#ef4444', fontSize: 12, width: '100%', mt: 0.5 }}>
            {error}
          </Typography>
        )}
      </Box>
    );
  }

  // Banner variant (default)
  return (
    <>
      <Alert
        severity="warning"
        icon={<EmailIcon sx={{ fontSize: 22 }} />}
        action={
          <IconButton size="small" onClick={() => {/* dismiss handled by parent */}}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        }
        sx={{
          mb: 2,
          borderRadius: 2,
          bgcolor: 'rgba(234,179,8,0.06)',
          border: '1px solid rgba(234,179,8,0.15)',
          color: '#e2e8f0',
          '& .MuiAlert-icon': { color: '#f59e0b', alignItems: 'center' },
          '& .MuiAlert-action': { mr: 0.5 },
        }}
      >
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, color: '#fbbf24' }}>
            {t('auth.verifyRequiredTitle', 'Email Verification Required')}
          </Typography>
          <Typography variant="body2" sx={{ color: '#94a3b8', fontSize: 13.5, lineHeight: 1.6 }}>
            {t('auth.verifyRequiredDesc', 'Please verify your email address to unlock all features. We sent a verification link to')}{' '}
            <strong style={{ color: '#cbd5e1' }}>{maskedEmail}</strong>.
          </Typography>
          <Box sx={{ mt: 1.5, display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              size="small"
              variant="contained"
              disabled={isLoading}
              onClick={handleResend}
              startIcon={isLoading ? <CircularProgress size={14} color="inherit" /> : <EmailIcon sx={{ fontSize: 16 }} />}
              sx={{
                textTransform: 'none',
                borderRadius: 2,
                bgcolor: '#f59e0b',
                color: '#000',
                fontWeight: 600,
                fontSize: 13,
                px: 2,
                boxShadow: 'none',
                '&:hover': { bgcolor: '#fbbf24' },
              }}
            >
              {isLoading ? (t('auth.sending', 'Sending...')) : t('auth.resendVerification', 'Resend Email')}
            </Button>
            {error && (
              <Typography variant="caption" sx={{ color: '#ef4444', fontSize: 12 }}>
                {error}
              </Typography>
            )}
          </Box>
        </Box>
      </Alert>

      <Snackbar
        open={showSuccess}
        autoHideDuration={5000}
        onClose={() => setShowSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 70, md: 24 } }}
      >
        <Alert
          severity="success"
          onClose={() => setShowSuccess(false)}
          variant="filled"
          sx={{ bgcolor: '#059669', color: '#fff', borderRadius: 2, fontWeight: 600 }}
        >
          {t('auth.resendSuccess', 'Verification email sent! Please check your inbox.')}
        </Alert>
      </Snackbar>
    </>
  );
}
