import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Box,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
  Tooltip,
  Badge,
  Popover,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon as MuiListItemIcon,
  CircularProgress,
  Button,
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import DescriptionIcon from '@mui/icons-material/Description';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ForumIcon from '@mui/icons-material/Forum';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import LanguageSwitcher from './LanguageSwitcher';
import { tokenStorage, useGetProfileQuery } from '../store/authApi';
import { DRAWER_WIDTH } from './Sidebar';

// Import notificationApi hooks
import { useGetNotificationsQuery as useNotifQuery, useMarkAsReadMutation as useNotifRead, useMarkAllAsReadMutation as useNotifReadAll, useGetUnreadCountQuery as useUnreadQuery } from '../store/notificationApi';

interface TickerItem {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

const HOT_SYMBOLS: TickerItem[] = [
  { symbol: 'XAUUSD', price: 2934.52, change: +28.30, changePercent: +0.97 },
  { symbol: 'EURUSD', price: 1.0876, change: -0.0012, changePercent: -0.11 },
  { symbol: 'GBPUSD', price: 1.2698, change: +0.0035, changePercent: +0.28 },
  { symbol: 'USDJPY', price: 155.82, change: -0.34, changePercent: -0.22 },
  { symbol: 'BTCUSD', price: 96840, change: +2340, changePercent: +2.48 },
  { symbol: 'SPX500', price: 5892.15, change: -42.80, changePercent: -0.72 },
  { symbol: 'USDCNH', price: 7.2456, change: -0.0098, changePercent: -0.13 },
  { symbol: 'NAS100', price: 19845.60, change: +126.40, changePercent: +0.64 },
];

function MarketTicker() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollPos, setScrollPos] = useState(0);
  const speed = 0.4;

  useEffect(() => {
    let rafId: number;
    const animate = () => {
      setScrollPos((prev) => prev + speed);
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const fmtChange = (val: number) =>
    val >= 0 ? `+${val.toFixed(val < 1 && val !== 0 ? 4 : 2)}` : val.toFixed(val > -1 ? 4 : 2);

  const items = [...HOT_SYMBOLS, ...HOT_SYMBOLS];
  const itemWidth = isZh ? 195 : 185;

  return (
    <Box
      ref={containerRef}
      sx={{
        overflow: 'hidden',
        flex: 1,
        mx: 1.5,
        position: 'relative',
        '&::before, &::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 24,
          zIndex: 1,
          pointerEvents: 'none',
        },
        '&::before': {
          left: 0,
          background: 'linear-gradient(to right, #0d1117, transparent)',
        },
        '&::after': {
          right: 0,
          background: 'linear-gradient(to left, #0d1117, transparent)',
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          transform: `translateX(-${scrollPos % (items.length / 2 * itemWidth)}px)`,
          willChange: 'transform',
        }}
      >
        {items.map((item, idx) => (
          <Box key={`${item.symbol}-${idx}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0, whiteSpace: 'nowrap' }}>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0' }}>
              {item.symbol}
            </Typography>
            <Typography sx={{ fontSize: '0.73rem', color: '#94a3b8', minWidth: item.price >= 1000 ? 70 : 55, textAlign: 'right' }}>
              {item.price.toLocaleString(undefined, { minimumFractionDigits: item.price >= 10 ? 2 : 4, maximumFractionDigits: item.price >= 10 ? 2 : 4 })}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              {item.change >= 0
                ? <TrendingUpIcon sx={{ fontSize: 14, color: '#00d4aa' }} />
                : <TrendingDownIcon sx={{ fontSize: 14, color: '#ef4444' }} />}
              <Typography sx={{ fontSize: '0.71rem', fontWeight: 600, color: item.change >= 0 ? '#00d4aa' : '#ef4444', minWidth: isZh ? 62 : 56 }}>
                {fmtChange(item.change)} ({fmtChange(item.changePercent)}%)
              </Typography>
            </Box>
            <Box sx={{ width: 1, height: 14, bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 0.5 }} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

interface AppHeaderProps {
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
}

export default function AppHeader({ sidebarOpen, onSidebarToggle }: AppHeaderProps) {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null);

  const user = tokenStorage.getUser();
  const hasToken = !!tokenStorage.getAccessToken();
  const { data: profile } = useGetProfileQuery(undefined, { skip: !hasToken, refetchOnMountOrArgChange: 30 });

  /** Extract localized text from bilingual string (format: "中文|||English") */
  const getLocalizedText = (text: string): string => {
    if (!text) return text;
    if (text.includes('|||')) {
      const parts = text.split('|||');
      return isZh ? parts[0].trim() : (parts[1]?.trim() || parts[0].trim());
    }
    return text;
  };

  /** Resolve notification title for current UI locale (handles bilingual + legacy single-language records) */
  const getNotificationTitle = (notif: { type: string; title: string }): string => {
    if (notif.title?.includes('|||')) {
      return getLocalizedText(notif.title);
    }
    switch (notif.type) {
      case 'new_comment':
        return t('notification.newCommentTitle', 'New Comment');
      case 'comment_reply':
        return t('notification.commentReplyTitle', 'Comment Reply');
      case 'ai_report_ready':
        return t('notification.aiReportReadyTitle', 'AI Report Ready');
      case 'import_complete':
        return t('notification.importCompleteTitle', 'Trades Imported');
      case 'attachment_download_reward':
        return t('notification.downloadRewardTitle', '🎉 Attachment Download Reward');
      default:
        return getLocalizedText(notif.title);
    }
  };

  // Notification queries
  const { data: notifData, isLoading: notifLoading } = useNotifQuery({ limit: 10 }, { skip: !hasToken, pollingInterval: 30000 });
  const { data: unreadData } = useUnreadQuery(undefined, { skip: !hasToken, pollingInterval: 30000 });
  const [markAsRead] = useNotifRead();
  const [markAllAsRead] = useNotifReadAll();

  const unreadCount = unreadData?.count || 0;
  const notifications = notifData?.notifications || [];

  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User';
  const email = profile?.email || user?.email || '';
  const avatarUrl = profile?.avatarUrl || user?.avatarUrl || null;
  const userInitial = email?.[0]?.toUpperCase() || 'U';

  const handleLogout = () => {
    tokenStorage.clearTokens();
    setAnchorEl(null);
    navigate('/login');
  };

  const handleNotifClick = async (notifId: string, type: string, metadata?: Record<string, any>) => {
    await markAsRead(notifId).unwrap().catch(() => {});
    switch (type) {
      case 'ai_report_ready':
        navigate('/ai-reports');
        break;
      case 'new_comment':
      case 'comment_reply':
        if (metadata?.playbookId) {
          navigate(`/playbooks/${metadata.playbookId}`);
        }
        break;
      case 'import_complete':
        navigate('/trades');
        break;
      case 'attachment_download_reward':
        navigate('/credits');
        break;
    }
    setNotifAnchorEl(null);
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead().unwrap().catch(() => {});
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return t('notification.justNow', 'Just now');
    if (diffMin < 60) return `${diffMin}${t('notification.minAgo', 'm ago')}`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}${t('notification.hoursAgo', 'h ago')}`;
    return d.toLocaleDateString();
  };

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        bgcolor: '#0d1117',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(12px)',
        transition: 'width 0.2s ease',
        width: { md: `calc(100% - ${sidebarOpen ? DRAWER_WIDTH : 72}px)` },
        ml: { md: `${sidebarOpen ? DRAWER_WIDTH : 72}px` },
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar sx={{ gap: 1 }}>
        {!sidebarOpen && (
          <IconButton
            edge="start"
            onClick={onSidebarToggle}
            sx={{ mr: 1.5, color: 'text.primary' }}
          >
            <ChevronRightIcon />
          </IconButton>
        )}

        {/* Market ticker */}
        <MarketTicker />

        {/* Right side actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          <LanguageSwitcher />

          {/* Notification bell with badge and popover */}
          <Tooltip title={t('appHeader.notifications')}>
            <IconButton
              size="small"
              onClick={(e) => setNotifAnchorEl(e.currentTarget)}
              sx={{ color: '#94a3b8' }}
            >
              <Badge
                badgeContent={unreadCount}
                max={99}
                sx={{
                  '.MuiBadge-badge': {
                    bgcolor: unreadCount > 0 ? '#e5a23c' : 'transparent',
                    fontSize: '0.65rem',
                    height: 16,
                    minWidth: 16,
                    padding: '0 4px',
                  },
                }}
              >
                {unreadCount > 0 ? (
                  <NotificationsIcon fontSize="small" sx={{ color: '#e5a23c' }} />
                ) : (
                  <NotificationsNoneIcon fontSize="small" />
                )}
              </Badge>
            </IconButton>
          </Tooltip>

          <Popover
            anchorEl={notifAnchorEl}
            open={Boolean(notifAnchorEl)}
            onClose={() => setNotifAnchorEl(null)}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            slotProps={{
              paper: {
                sx: {
                  mt: 1,
                  width: 360,
                  maxHeight: 450,
                  bgcolor: '#111827',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 2,
                },
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#f1f5f9' }}>
                {t('notification.title', 'Notifications')}
              </Typography>
              {unreadCount > 0 && (
                <Button size="small" startIcon={<DoneAllIcon />} onClick={handleMarkAllRead}
                  sx={{ textTransform: 'none', fontSize: '0.72rem', color: '#e5a23c', minWidth: 'auto' }}>
                  {t('notification.markAllRead', 'Mark all read')}
                </Button>
              )}
            </Box>

            {notifLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} sx={{ color: '#e5a23c' }} />
              </Box>
            ) : notifications.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
                <NotificationsNoneIcon sx={{ fontSize: 36, color: '#4b5563', mb: 1 }} />
                <Typography variant="body2" sx={{ color: '#6b7280' }}>
                  {t('notification.noNotifications', 'No notifications yet')}
                </Typography>
              </Box>
            ) : (
              <List disablePadding sx={{ maxHeight: 350, overflowY: 'auto' }}>
                {notifications.map((notif: any) => (
                  <ListItemButton
                    key={notif.notificationId}
                    onClick={() => handleNotifClick(notif.notificationId, notif.type, notif.metadata)}
                    sx={{
                      px: 2, py: 1.2, borderLeft: `3px solid ${notif.isRead ? 'transparent' : '#e5a23c'}`,
                      bgcolor: notif.isRead ? 'transparent' : 'rgba(229,162,60,0.05)',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                    }}
                  >
                    <MuiListItemIcon sx={{ minWidth: 36 }}>
                      {notif.type === 'ai_report_ready' ? (
                        <DescriptionIcon sx={{ fontSize: 18, color: '#1976d2' }} />
                      ) : notif.type === 'new_comment' || notif.type === 'comment_reply' ? (
                        <ForumIcon sx={{ fontSize: 18, color: '#00d4aa' }} />
                      ) : notif.type === 'attachment_download_reward' ? (
                        <CardGiftcardIcon sx={{ fontSize: 18, color: '#e5a23c' }} />
                      ) : (
                        <DescriptionIcon sx={{ fontSize: 18, color: '#6b7280' }} />
                      )}
                    </MuiListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{
                          fontWeight: notif.isRead ? 400 : 600, color: notif.isRead ? '#9ca3af' : '#f1f5f9',
                          fontSize: '0.82rem', lineHeight: 1.35,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}                        >
                          {getNotificationTitle(notif)}
                        </Typography>
                      }
                      secondary={
                        <Typography variant="caption" sx={{ color: '#6b7280' }}>
                          {formatTime(notif.createdAt)}
                        </Typography>
                      }
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </Popover>

          <IconButton
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{ p: 0.5 }}
          >
            <Avatar
              src={avatarUrl || undefined}
              sx={{
                width: 34, height: 34,
                bgcolor: avatarUrl ? undefined : '#00d4aa',
                fontSize: '0.85rem', fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {userInitial}
            </Avatar>
          </IconButton>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            slotProps={{
              paper: { sx: { mt: 1, minWidth: 180, borderRadius: 2, bgcolor: '#111827', border: '1px solid rgba(255,255,255,0.08)' } }
            }}
          >
            <MenuItem disabled sx={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0.25, py: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Avatar src={avatarUrl || undefined} sx={{ width: 32, height: 32, bgcolor: avatarUrl ? undefined : '#00d4aa', fontSize: '0.8rem', fontWeight: 700 }}>
                  {userInitial}
                </Avatar>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#f1f5f9' }}>{displayName}</Typography>
              </Box>
              <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', pl: 9.5 }}>{email}</Typography>
            </MenuItem>
            <Divider sx={{ my: 0.5, borderColor: 'rgba(255,255,255,0.06)' }} />
            <MenuItem onClick={() => { navigate('/settings'); setAnchorEl(null); }}>
              <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
              {t('appHeader.profileSettings')}
            </MenuItem>
            <MenuItem onClick={() => { navigate('/subscription'); setAnchorEl(null); }}>
              <ListItemIcon><Typography variant="body2">$</Typography></ListItemIcon>
              {t('appHeader.subscription')}
            </MenuItem>
            <Divider sx={{ my: 0.5, borderColor: 'rgba(255,255,255,0.06)' }} />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
              {t('appHeader.signOut')}
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
