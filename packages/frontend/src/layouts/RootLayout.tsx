import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import AnalyticsInit from '../components/AnalyticsInit';
import ContentLocaleInit from '../components/ContentLocaleInit';

export default function RootLayout() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AnalyticsInit />
      <ContentLocaleInit />
      <Outlet />
    </Box>
  );
}
