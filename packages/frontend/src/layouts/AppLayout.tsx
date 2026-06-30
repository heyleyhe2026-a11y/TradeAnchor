import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Box, Toolbar } from '@mui/material';
import Sidebar from '../components/Sidebar';
import AppHeader from '../components/AppHeader';
import EmailVerificationPrompt from '../components/EmailVerificationPrompt';
import RiskDisclaimerBanner from '../components/RiskDisclaimerBanner';
import ContentLocaleInit from '../components/ContentLocaleInit';
import { tokenStorage, useGetProfileQuery } from '../store/authApi';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isLoggedIn = !!tokenStorage.getAccessToken();
  const { data: profile } = useGetProfileQuery(undefined, { skip: !isLoggedIn });
  const user = tokenStorage.getUser();

  // Prefer live profile data over possibly stale localStorage (e.g. after Google OAuth)
  const emailVerified = profile?.emailVerified ?? user?.emailVerified ?? false;
  const needsVerification = isLoggedIn && !emailVerified;
  const userEmail = profile?.email || user?.email || '';

  // Keep localStorage in sync when profile loads
  useEffect(() => {
    if (profile && user) {
      tokenStorage.setUser({ ...user, emailVerified: profile.emailVerified, email: profile.email, displayName: profile.displayName, avatarUrl: profile.avatarUrl });
    }
  }, [profile?.emailVerified, profile?.email]);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#0a0e17' }}>
      <ContentLocaleInit />
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minHeight: '100vh',
          overflow: 'auto',
          transition: (theme) =>
            theme.transitions.create('margin', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
        }}
      >
        {/* Top header bar */}
        <AppHeader sidebarOpen={sidebarOpen} onSidebarToggle={() => setSidebarOpen(!sidebarOpen)} />

        {/* Page content with toolbar spacing */}
        <Toolbar /> {/* Spacer for fixed AppBar */}
        <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 64px)' }}>
          {needsVerification && (
            <EmailVerificationPrompt email={userEmail} variant="banner" />
          )}
          <Box sx={{ flex: 1 }}>
            <Outlet />
          </Box>
          <RiskDisclaimerBanner />
        </Box>
      </Box>
    </Box>
  );
}
