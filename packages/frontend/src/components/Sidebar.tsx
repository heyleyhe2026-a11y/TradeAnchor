import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
  IconButton,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import PsychologyIcon from '@mui/icons-material/Psychology';
import BookIcon from '@mui/icons-material/Book';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SettingsIcon from '@mui/icons-material/Settings';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

const DRAWER_WIDTH = 260;

interface NavItem {
  labelKey: string;
  path: string;
  icon: React.ReactElement;
}

interface NavSection {
  titleKey?: string;
  items: NavItem[];
}

export default function Sidebar({ open, onToggle, onClose }: { open: boolean; onToggle: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const navSections: NavSection[] = useMemo(() => [
    {
      items: [
        { labelKey: 'sidebar.dashboard', path: '/dashboard', icon: <DashboardIcon /> },
        { labelKey: 'sidebar.trades', path: '/trades', icon: <ShowChartIcon /> },
      ],
    },
    {
      titleKey: 'sidebar.analytics',
      items: [
        { labelKey: 'sidebar.aiReports', path: '/ai-reports', icon: <PsychologyIcon /> },
        { labelKey: 'sidebar.tradingCalendar', path: '/calendar', icon: <TrendingUpIcon /> },
      ],
    },
    {
      titleKey: 'sidebar.journal',
      items: [
        { labelKey: 'sidebar.diary', path: '/diary', icon: <BookIcon /> },
        { labelKey: 'sidebar.playbooks', path: '/playbooks', icon: <AutoStoriesIcon /> },
        { labelKey: 'sidebar.blog', path: '/blogs', icon: <MenuBookIcon /> },
      ],
    },
    {
      titleKey: 'sidebar.account',
      items: [
        { labelKey: 'sidebar.growthPlan', path: '/rewards', icon: <EmojiEventsIcon /> },
        { labelKey: 'sidebar.subscription', path: '/subscription', icon: <CreditCardIcon /> },
        { labelKey: 'sidebar.settings', path: '/settings', icon: <SettingsIcon /> },
        { labelKey: 'sidebar.customerService', path: '/help', icon: <SupportAgentIcon /> },
      ],
    },
  ], [t]);

  return (
    <>
      {/* Mobile toggle button */}
      {isMobile && (
        <IconButton
          onClick={onToggle}
          sx={{
            position: 'fixed',
            top: 12,
            left: 12,
            zIndex: 1300,
            bgcolor: 'background.paper',
            border: '1px solid rgba(255,255,255,0.1)',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <MenuIcon />
        </IconButton>
      )}

      <Drawer
        variant={isMobile ? 'temporary' : 'persistent'}
        open={open}
        onClose={onClose}
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            bgcolor: '#0d1117',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            top: isMobile ? 0 : 64,
            height: isMobile ? '100%' : 'calc(100% - 64px)',
          },
        }}
        ModalProps={{ keepMounted: true }}
      >
        {/* Logo / Brand */}
        <Toolbar sx={{ gap: 1.5, px: 2, py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                width: 44, height: 44, borderRadius: 1.5,
                background: 'linear-gradient(135deg,#00d4aa 0%,#00a888 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <TrendingUpIcon sx={{ color: '#0a0e17', fontSize: 26 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.3px', lineHeight: 1.3 }}>
                TradeAnchor
              </Typography>
              <Typography variant="caption" sx={{ fontSize: 10.5, letterSpacing: 1.8, color: '#64748b', textTransform: 'uppercase', display: 'block', lineHeight: 1.3 }}>
                SMART TRADING JOURNAL TOOL
              </Typography>
            </Box>
          </Box>
          {!isMobile && (
            <IconButton onClick={onToggle} size="small" sx={{ ml: 'auto' }}><ChevronLeftIcon /></IconButton>
          )}
        </Toolbar>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

        <List disablePadding sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1.5 }}>
          {navSections.map((section) => (
            <React.Fragment key={section.titleKey || 'main'}>
              {section.titleKey && (
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    px: 2,
                    pt: 2,
                    pb: 0.5,
                    color: '#64748b',
                    fontSize: '14px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                  }}
                >
                  {t(section.titleKey)}
                </Typography>
              )}
              {section.items.map((item) => {
                const isActive = location.pathname === item.path ||
                  (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
                return (
                  <ListItem key={item.path} disablePadding sx={{ mb: 0.3 }}>
                    <ListItemButton
                      onClick={() => { navigate(item.path); if (isMobile) onClose(); }}
                      selected={isActive}
                      sx={{
                        borderRadius: 2,
                        py: 1,
                        px: 2,
                        '&.Mui-selected': {
                          bgcolor: 'rgba(0,212,170,0.1)',
                          color: '#00d4aa',
                          '& .MuiListItemIcon-root': { color: '#00d4aa' },
                          '&:hover': { bgcolor: 'rgba(0,212,170,0.15)' },
                        },
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 40, '& .MuiSvgIcon-root': { fontSize: 26 } }}>{item.icon}</ListItemIcon>
                      <ListItemText
                        primary={t(item.labelKey)}
                        sx={{ '& .MuiListItemText-primary': { fontSize: '16px', fontWeight: isActive ? 600 : 400 } }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </React.Fragment>
          ))}
        </List>

        {/* Footer */}
        <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Typography variant="caption" sx={{ color: '#64748b', textAlign: 'center', display: 'block' }}>
            TradeAnchor v1.0.0
          </Typography>
        </Box>
      </Drawer>
    </>
  );
}

export { DRAWER_WIDTH };
