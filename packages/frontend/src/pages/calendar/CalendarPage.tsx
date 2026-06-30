import { useTranslation } from 'react-i18next';
import { Box, Typography } from '@mui/material';
import CalendarView from '../../components/CalendarView';

export default function CalendarPage() {
  const { t } = useTranslation();

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
          {t('calendar.pageTitle', 'Trading Calendar')}
        </Typography>
        <Typography variant="body2" sx={{ color: '#94a3b8' }}>
          {t('calendar.pageSubtitle', 'Track your daily P&L and returns')}
        </Typography>
      </Box>
      <CalendarView />
    </Box>
  );
}
