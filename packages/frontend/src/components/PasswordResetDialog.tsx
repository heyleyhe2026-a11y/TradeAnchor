import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Alert, Typography, Box, InputAdornment, IconButton,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import {
  useRequestPasswordResetCodeMutation,
  useConfirmPasswordResetMutation,
} from '../store/authApi';

const CODE_TTL_SECONDS = 60;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

interface Props {
  open: boolean;
  onClose: () => void;
  mode: 'forgot' | 'settings';
  defaultEmail?: string;
  onSuccess?: () => void;
}

export default function PasswordResetDialog({ open, onClose, mode, defaultEmail = '', onSuccess }: Props) {
  const { t } = useTranslation();
  const [email, setEmail] = useState(defaultEmail);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [requestCode, { isLoading: sending }] = useRequestPasswordResetCodeMutation();
  const [confirmReset, { isLoading: resetting }] = useConfirmPasswordResetMutation();

  useEffect(() => {
    if (open) {
      setEmail(defaultEmail);
      setCode('');
      setNewPassword('');
      setConfirmPassword('');
      setCodeSent(false);
      setCountdown(0);
      setError('');
      setSuccess('');
    }
  }, [open, defaultEmail]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const startCountdown = () => {
    setCountdown(CODE_TTL_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendCode = async () => {
    setError('');
    setSuccess('');
    const targetEmail = email.toLowerCase().trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setError(t('auth.errors.invalidEmail', 'Invalid email format'));
      return;
    }
    try {
      await requestCode({ email: targetEmail }).unwrap();
      setCodeSent(true);
      setCode('');
      startCountdown();
      setSuccess(t('auth.resetCodeSent', 'Verification code sent. Please check your inbox (expires in 1 minute).'));
    } catch (err: unknown) {
      const apiErr = err as { data?: { message?: string } };
      setError(apiErr.data?.message || t('auth.resetCodeFailed', 'Failed to send verification code'));
    }
  };

  const handleConfirmReset = async () => {
    setError('');
    setSuccess('');
    const targetEmail = email.toLowerCase().trim();

    if (!code || code.length !== 6) {
      setError(t('auth.resetCodeInvalid', 'Please enter the 6-digit verification code'));
      return;
    }
    if (!PASSWORD_REGEX.test(newPassword)) {
      setError(t('auth.passwordHint', 'At least 8 chars: uppercase, lowercase, number, special character'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth.errors.passwordMismatch', 'Passwords do not match'));
      return;
    }
    if (countdown === 0 && codeSent) {
      setError(t('auth.resetCodeExpired', 'Verification code has expired. Please request a new one.'));
      return;
    }

    try {
      await confirmReset({ email: targetEmail, code, newPassword }).unwrap();
      setSuccess(t('auth.resetSuccess', 'Password reset successfully!'));
      onSuccess?.();
      setTimeout(() => onClose(), 1500);
    } catch (err: unknown) {
      const apiErr = err as { data?: { message?: string } };
      setError(apiErr.data?.message || t('auth.resetFailed', 'Password reset failed'));
    }
  };

  const isSettings = mode === 'settings';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {isSettings ? t('settings.passwordReset', 'Reset Password') : t('auth.forgotPasswordTitle', 'Forgot Password')}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {isSettings
            ? t('auth.resetSettingsHint', 'A 6-digit verification code will be sent to your registered email. Enter it within 1 minute to set a new password.')
            : t('auth.resetForgotHint', 'Enter your registered email to receive a 6-digit verification code. Complete the reset within 1 minute.')}
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            label={t('auth.email', 'Email Address')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSettings || codeSent}
            size="small"
          />

          {!codeSent ? (
            <Button variant="outlined" onClick={handleSendCode} disabled={sending || !email}>
              {sending ? t('auth.sendingCode', 'Sending...') : t('auth.sendResetCode', 'Send Verification Code')}
            </Button>
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" color={countdown > 0 ? 'text.secondary' : 'error'}>
                  {countdown > 0
                    ? t('auth.codeExpiresIn', { seconds: countdown, defaultValue: `Code expires in ${countdown}s` })
                    : t('auth.resetCodeExpired', 'Verification code has expired. Please request a new one.')}
                </Typography>
                <Button size="small" onClick={handleSendCode} disabled={sending}>
                  {t('auth.resendCode', 'Resend')}
                </Button>
              </Box>

              <TextField
                fullWidth
                label={t('auth.verificationCode', 'Verification Code')}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                slotProps={{ htmlInput: { maxLength: 6, inputMode: 'numeric' } }}
                size="small"
                placeholder="000000"
              />

              <TextField
                fullWidth
                label={t('auth.newPassword', 'New Password')}
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                helperText={t('auth.passwordHint')}
                size="small"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <TextField
                fullWidth
                label={t('auth.confirmPassword', 'Confirm Password')}
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                size="small"
              />
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
        {codeSent && (
          <Button
            variant="contained"
            onClick={handleConfirmReset}
            disabled={resetting || countdown === 0}
          >
            {resetting ? t('auth.resetting', 'Resetting...') : t('auth.confirmReset', 'Reset Password')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
