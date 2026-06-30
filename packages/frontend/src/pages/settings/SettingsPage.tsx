import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Typography, Card, CardContent, Button, Switch, FormControlLabel, Box, TextField, Avatar, Divider, Alert,
  MenuItem, Select, FormControl, InputLabel,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PersonIcon from '@mui/icons-material/Person';
import LanguageIcon from '@mui/icons-material/Language';
import RestoreIcon from '@mui/icons-material/Restore';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import LockResetIcon from '@mui/icons-material/LockReset';
import PasswordResetDialog from '../../components/PasswordResetDialog';
import { useDispatch } from 'react-redux';
import {
  useGetPreferencesQuery, useUpdatePreferencesMutation, useResetPreferencesMutation,
  type UserPreferences,
} from '../../store/preferencesApi';
import { useGetProfileQuery, useUpdateProfileMutation, useUploadAvatarMutation, tokenStorage, authApi } from '../../store/authApi';
import { COMMON_TIMEZONES, SUPPORTED_CURRENCIES } from '../../utils/format';

type LocalPrefs = Pick<UserPreferences, 'notifications' | 'displayTimezone' | 'baseCurrency' | 'calendarDayBasis' | 'leaderboardOptIn'>;

const defaultLocalPrefs = (): LocalPrefs => ({
  notifications: { email: true, push: false, aiReports: true, profitAlerts: true },
  displayTimezone: 'UTC',
  baseCurrency: 'USD',
  calendarDayBasis: 'exit',
  leaderboardOptIn: true,
});

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const dispatch = useDispatch();
  const { data: prefs } = useGetPreferencesQuery();
  const [updatePrefs] = useUpdatePreferencesMutation();
  const [resetPrefs] = useResetPreferencesMutation();

  const { data: profile, isLoading: profileLoading, isError: profileFetchFailed } = useGetProfileQuery(undefined, { refetchOnMountOrArgChange: 30 });
  const [updateProfile] = useUpdateProfileMutation();
  const [uploadAvatarReq] = useUploadAvatarMutation();

  const [localPrefs, setLocalPrefs] = useState<LocalPrefs>(defaultLocalPrefs());
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [prefsError, setPrefsError] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingDisplayName = useRef<string | null>(null);
  const pendingAvatarUrl = useRef<string | null>(null);
  const [passwordResetOpen, setPasswordResetOpen] = useState(false);

  useEffect(() => {
    if (profile) {
      if (pendingDisplayName.current === null || profile.displayName !== null) {
        setDisplayName(profile.displayName || '');
      }
      if (pendingAvatarUrl.current === null || profile.avatarUrl !== null) {
        setAvatarUrl(profile.avatarUrl || '');
      }
      if (profile.displayName) pendingDisplayName.current = null;
      if (profile.avatarUrl) pendingAvatarUrl.current = null;
    }
  }, [profile]);

  useEffect(() => {
    if (prefs) {
      setLocalPrefs({
        notifications: prefs.notifications || defaultLocalPrefs().notifications,
        displayTimezone: prefs.displayTimezone || prefs.timezone || 'UTC',
        baseCurrency: prefs.baseCurrency || prefs.currency || 'USD',
        calendarDayBasis: prefs.calendarDayBasis || 'exit',
        leaderboardOptIn: prefs.leaderboardOptIn ?? true,
      });
    }
  }, [prefs]);

  const handleSavePrefs = async () => {
    setPrefsError('');
    try {
      const updated = await updatePrefs({
        displayTimezone: localPrefs.displayTimezone,
        baseCurrency: localPrefs.baseCurrency,
        calendarDayBasis: localPrefs.calendarDayBasis,
        leaderboardOptIn: localPrefs.leaderboardOptIn,
        notifications: localPrefs.notifications,
      }).unwrap();
      setLocalPrefs({
        notifications: updated.notifications || defaultLocalPrefs().notifications,
        displayTimezone: updated.displayTimezone || updated.timezone || 'UTC',
        baseCurrency: updated.baseCurrency || updated.currency || 'USD',
        calendarDayBasis: updated.calendarDayBasis || 'exit',
        leaderboardOptIn: updated.leaderboardOptIn ?? true,
      });
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 3000);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'data' in err && err.data && typeof err.data === 'object' && 'message' in err.data
          ? String((err.data as { message?: string }).message)
          : t('errors.generic', 'Failed to save settings');
      setPrefsError(message);
    }
  };

  const handleResetPrefs = async () => {
    try {
      await resetPrefs().unwrap();
      setLocalPrefs(defaultLocalPrefs());
    } catch { /* ignore */ }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      setProfileError(t('settings.avatarTypeError', 'Only PNG/JPG images are allowed'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileError(t('settings.avatarSizeError', 'Image must be under 5MB'));
      return;
    }
    handleAvatarUpload(file);
    e.target.value = '';
  };

  const handleAvatarUpload = async (file: File) => {
    setProfileError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const result = await uploadAvatarReq(formData).unwrap();
      if (result.data?.avatarUrl) {
        pendingAvatarUrl.current = result.data.avatarUrl;
        setAvatarUrl(result.data.avatarUrl);
        const currentUser = tokenStorage.getUser() || {};
        tokenStorage.setUser({ ...currentUser, avatarUrl: result.data.avatarUrl });
      }
      dispatch(authApi.util.invalidateTags(['Auth']));
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('errors.generic', 'Upload failed');
      setProfileError(message);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    setProfileError('');
    setProfileSaved(false);
    try {
      const result = await updateProfile({
        displayName: displayName.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
      }).unwrap();
      if (result?.data) {
        const currentUser = tokenStorage.getUser() || {};
        tokenStorage.setUser({ ...currentUser, ...result.data });
        const newDisplayName = result.data.displayName || '';
        const newAvatarUrl = result.data.avatarUrl || '';
        pendingDisplayName.current = newDisplayName;
        pendingAvatarUrl.current = newAvatarUrl;
        setDisplayName(newDisplayName);
        setAvatarUrl(newAvatarUrl);
      }
      dispatch(authApi.util.invalidateTags(['Auth']));
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('errors.generic', 'Failed to save');
      setProfileError(message);
    }
  };

  return (
    <Box sx={{ py: 3, px: { xs: 2, md: 3 } }}>
      <Typography variant="h4" sx={{ fontWeight: 700 }} gutterBottom>
        <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />{t('settings.title')}
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}><PersonIcon sx={{ verticalAlign: 'middle', mr: 0.5 }} />{t('settings.profile', 'Personal Profile')}</Typography>
          {profileLoading ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Loading...</Typography>
          ) : profileFetchFailed ? (
            <Alert severity="warning" sx={{ mb: 1 }}>
              {isZh ? '无法加载个人信息，请确认已登录。' : 'Unable to load profile. Please ensure you are logged in.'}
            </Alert>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Box sx={{ position: 'relative' }}>
                  <Avatar
                    src={avatarUrl || undefined}
                    sx={{ width: 88, height: 88, fontSize: 34, bgcolor: 'rgba(229,162,60,0.15)', color: '#E5A23C' }}
                  >
                    {(displayName || profile?.email || '?').charAt(0).toUpperCase()}
                  </Avatar>
                  <Button
                    size="small"
                    component="label"
                    disabled={uploading}
                    sx={{
                      position: 'absolute', bottom: -4, right: -4,
                      minWidth: 32, minHeight: 32, p: 0.5, borderRadius: '50%',
                      bgcolor: 'background.paper', border: '2px solid', borderColor: 'divider',
                    }}
                  >
                    <PhotoCameraIcon sx={{ fontSize: 16, color: uploading ? 'text.disabled' : '#E5A23C' }} />
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg" hidden onChange={handleFileSelect} />
                  </Button>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <TextField
                    fullWidth
                    label={t('settings.username', 'Display Name')}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    size="small"
                    sx={{ mb: 1.5 }}
                  />
                  <Button size="small" variant="outlined" component="label" disabled={uploading} startIcon={<CloudUploadIcon sx={{ fontSize: 16 }} />}>
                    {uploading ? (isZh ? '上传中...' : 'Uploading...') : (isZh ? '上传图片' : 'Upload Image')}
                    <input type="file" accept="image/png,image/jpeg,image/jpg" hidden onChange={handleFileSelect} />
                  </Button>
                </Box>
              </Box>
              {profileSaved && <Alert severity="success">{t('settings.profileSaved', 'Profile saved successfully!')}</Alert>}
              {profileError && <Alert severity="error">{profileError}</Alert>}
              <Button variant="contained" startIcon={<CloudUploadIcon />} onClick={handleSaveProfile} sx={{ alignSelf: 'flex-start', borderRadius: 2 }}>
                {t('settings.saveProfile', 'Save Profile')}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      <Divider sx={{ my: 3 }} />

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            <LockResetIcon sx={{ verticalAlign: 'middle', mr: 0.5 }} />
            {t('settings.passwordReset', 'Reset Password')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('settings.passwordResetHint', 'Change your login password. A 6-digit verification code will be sent to your registered email — complete the reset within 1 minute.')}
          </Typography>
          <Button variant="outlined" startIcon={<LockResetIcon />} onClick={() => setPasswordResetOpen(true)}>
            {t('settings.changePassword', 'Change Password')}
          </Button>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            <LanguageIcon sx={{ verticalAlign: 'middle', mr: 0.5 }} />
            {t('settings.regional', 'Language & Region')}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 480 }}>
            <FormControl fullWidth size="small">
              <InputLabel>{t('settings.displayTimezone', 'Display Timezone')}</InputLabel>
              <Select
                label={t('settings.displayTimezone', 'Display Timezone')}
                value={localPrefs.displayTimezone}
                onChange={(e) => setLocalPrefs({ ...localPrefs, displayTimezone: e.target.value })}
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <MenuItem key={tz} value={tz}>
                    {tz === 'Asia/Shanghai' && isZh ? `上海 (${tz})` : tz}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>{t('settings.baseCurrency', 'Report Currency')}</InputLabel>
              <Select
                label={t('settings.baseCurrency', 'Report Currency')}
                value={localPrefs.baseCurrency}
                onChange={(e) => setLocalPrefs({ ...localPrefs, baseCurrency: e.target.value })}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c === 'CNY' && isZh ? `人民币 (${c})` : c}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>{t('settings.calendarDayBasis', 'Calendar groups by')}</InputLabel>
              <Select
                label={t('settings.calendarDayBasis', 'Calendar groups by')}
                value={localPrefs.calendarDayBasis}
                onChange={(e) => setLocalPrefs({ ...localPrefs, calendarDayBasis: e.target.value as 'entry' | 'exit' })}
              >
                <MenuItem value="exit">{t('settings.calendarExit', 'Exit date (close)')}</MenuItem>
                <MenuItem value="entry">{t('settings.calendarEntry', 'Entry date (open)')}</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={localPrefs.leaderboardOptIn}
                  onChange={(e) => setLocalPrefs({ ...localPrefs, leaderboardOptIn: e.target.checked })}
                />
              }
              label={t('settings.leaderboardOptIn', 'Participate in return rate leaderboard')}
            />
            <Typography variant="caption" color="text.secondary">
              {t('settings.regionalHint', 'Changing timezone or currency updates dashboard and calendar display without modifying stored trade data.')}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}><NotificationsIcon sx={{ verticalAlign: 'middle', mr: 0.5 }} />{t('settings.notifications')}</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <FormControlLabel control={<Switch checked={localPrefs.notifications.email} onChange={(e) => setLocalPrefs({ ...localPrefs, notifications: { ...localPrefs.notifications, email: e.target.checked } })} />} label={t('settings.emailNotifications')} />
            <FormControlLabel control={<Switch checked={localPrefs.notifications.push} onChange={(e) => setLocalPrefs({ ...localPrefs, notifications: { ...localPrefs.notifications, push: e.target.checked } })} />} label={t('settings.pushNotifications')} />
            <FormControlLabel control={<Switch checked={localPrefs.notifications.aiReports} onChange={(e) => setLocalPrefs({ ...localPrefs, notifications: { ...localPrefs.notifications, aiReports: e.target.checked } })} />} label={t('settings.aiReportReady')} />
            <FormControlLabel control={<Switch checked={localPrefs.notifications.profitAlerts} onChange={(e) => setLocalPrefs({ ...localPrefs, notifications: { ...localPrefs.notifications, profitAlerts: e.target.checked } })} />} label={t('settings.profitAlerts')} />
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column', alignItems: 'flex-start' }}>
        {prefsSaved && <Alert severity="success">{t('settings.prefsSaved', 'Settings saved successfully!')}</Alert>}
        {prefsError && <Alert severity="error">{prefsError}</Alert>}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="contained" onClick={handleSavePrefs}>{t('settings.saveChanges')}</Button>
          <Button variant="outlined" color="warning" startIcon={<RestoreIcon />} onClick={handleResetPrefs}>{t('settings.resetDefaults')}</Button>
        </Box>
      </Box>

      <PasswordResetDialog
        open={passwordResetOpen}
        onClose={() => setPasswordResetOpen(false)}
        mode="settings"
        defaultEmail={profile?.email || ''}
      />
    </Box>
  );
}
