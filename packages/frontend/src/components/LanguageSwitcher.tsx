import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Select, MenuItem, Typography } from '@mui/material';
import { useUpdatePreferencesMutation } from '../store/preferencesApi';
import { tokenStorage } from '../store/authApi';
import playbookApi from '../store/playbookApi';
import { useAppDispatch } from '../store/hooks';
import { persistUiLocale } from '../utils/contentLocale';

interface LanguageSwitcherProps {
  /** Override font size (e.g. landing page uses 20) */
  fontSize?: number | string;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ fontSize }) => {
  const { i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const [updatePreferences] = useUpdatePreferencesMutation();
  const fs = fontSize || '0.8rem';

  const changeLanguage = useCallback((lng: string) => {
    persistUiLocale(lng, i18n);

    if (tokenStorage.getAccessToken()) {
      updatePreferences({ locale: lng }).catch(() => {
        /* non-blocking */
      });
    }

    dispatch(playbookApi.util.invalidateTags(['Playbook', 'Comment']));
  }, [i18n, updatePreferences, dispatch]);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Typography sx={{ fontSize: fs, color: '#94a3b8' }}>
        {i18n.language.startsWith('zh') ? '语言' : 'Language'}
      </Typography>
      <Select
        value={i18n.language.startsWith('zh') ? 'zh-CN' : 'en'}
        onChange={(e) => changeLanguage(e.target.value)}
        size="small"
        sx={{
          color: '#e2e8f0',
          fontSize: fs,
          '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.25)' },
          '.MuiSvgIcon-root': { color: '#94a3b8' },
          minWidth: typeof fontSize === 'number' && fontSize >= 16 ? 130 : 100,
          '& .MuiSelect-select': { py: 0.4, pr: 2.5 },
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderRadius: 1.5,
        }}
      >
        <MenuItem value="zh-CN" sx={{ fontSize: fs }}>简体中文</MenuItem>
        <MenuItem value="en" sx={{ fontSize: fs }}>English</MenuItem>
      </Select>
    </Box>
  );
};

export default LanguageSwitcher;
