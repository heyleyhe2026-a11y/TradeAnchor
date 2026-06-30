import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Button, Chip, LinearProgress,
  Grid, Avatar, Tooltip, alpha, ToggleButtonGroup, ToggleButton, Snackbar,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import BoltIcon from '@mui/icons-material/Bolt';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import VisibilityIcon from '@mui/icons-material/Visibility';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { useGetTasksQuery, useGetPublisherLeaderboardQuery, useGetSellerLeaderboardQuery, useGetReturnRateLeaderboardQuery, useGetViewsLeaderboardQuery } from '../../store/taskApi';
import { useGetCreditBalanceQuery } from '../../store/creditApi';

const TASK_ACTION_MAP: Record<string, string> = {
  first_trade: '/trades',
  first_playbook: '/playbooks',
  first_ai_report: '/ai-reports',
  first_diary_entry: '/diary',
  verify_email: '/verify-email',
  import_trades: '/trades',
  ai_reports_5: '/ai-reports',
  ai_chat_10: '/ai-reports',
  publish_3_playbooks: '/playbooks',
  first_purchase: '/playbooks',
  diary_entries_7: '/diary',
};

/** Tasks that use daily credit caps instead of total count limits */
const DAILY_CAP_TASK_KEYS = new Set([
  'ai_reports_5', 'ai_chat_10', 'publish_3_playbooks', 'diary_entries_7',
]);

/** Unified rank crown component for Top 1-10 */
function RankCrown({ rank, size = 40 }: { rank: number; size?: number }) {
  const s = size;
  switch (rank) {
    case 1: // Gold crown — red star center, blue gems, golden glow
      return (
        <svg width={s} height={s * 0.75} viewBox="0 0 64 48" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="cg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FFE066"/><stop offset="100%" stopColor="#F59E0B"/></linearGradient>
            <filter id="sg1"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          <path d="M8 38h48l-4-18-8 9L32 8l-12 21-8-9z" fill="url(#cg1)" stroke="#D97706" strokeWidth="1.5" filter="url(#sg1)"/>
          <path d="M6 38h52v6H6z" fill="url(#cg1)" stroke="#D97706" strokeWidth="1.2"/>
          {/* Red star */}
          <polygon points="32,12 34.5,19 42,19 36,23.5 38,31 32,27 26,31 28,23.5 22,19 29.5,19" fill="#EF4444" stroke="#DC2626" strokeWidth="0.8"/>
          {/* Blue gems */}
          <circle cx="16" cy="22" r="3.5" fill="#3B82F6" stroke="#2563EB" strokeWidth="0.8"/><circle cx="48" cy="22" r="3.5" fill="#3B82F6" stroke="#2563EB" strokeWidth="0.8"/>
          <circle cx="14" cy="41" r="2" fill="#60A5FA"/><circle cx="32" cy="41" r="2" fill="#60A5FA"/><circle cx="50" cy="41" r="2" fill="#60A5FA"/>
          {/* Sparkles */}
          <text x="8" y="10" fontSize="8" fill="#FEF08A">✦</text><text x="50" y="8" fontSize="7" fill="#FEF08A">✧</text><text x="56" y="18" fontSize="6" fill="#FEF08A">✦</text>
        </svg>
      );
    case 2: // Silver crown — icy blue tips, red accents
      return (
        <svg width={s} height={s * 0.72} viewBox="0 0 64 46" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F1F5F9"/><stop offset="100%" stopColor="#94A3B8"/></linearGradient></defs>
          <path d="M6 36h52l-4-17-7 8-11-20-11 20-7-8z" fill="url(#cg2)" stroke="#64748B" strokeWidth="1.3"/>
          <path d="M4 36h56v6H4z" fill="url(#cg2)" stroke="#64748B" strokeWidth="1.2"/>
          {/* Crystal spikes */}
          <polygon points="20,19 22,26 18,26" fill="#93C5FD"/><polygon points="44,19 46,26 42,26" fill="#93C5FD"/>
          <circle cx="13" cy="25" r="2.5" fill="#EF4444"/><circle cx="51" cy="25" r="2.5" fill="#EF4444"/>
          <ellipse cx="15" cy="39" rx="2" ry="1.5" fill="#CBD5E1"/><ellipse cx="32" cy="39" rx="2" ry="1.5" fill="#CBD5E1"/><ellipse cx="49" cy="39" rx="2" ry="1.5" fill="#CBD5E1"/>
        </svg>
      );
    case 3: // Bronze crown — orange-brown, green gems
      return (
        <svg width={s} height={s * 0.7} viewBox="0 0 64 45" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="cg3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FB923C"/><stop offset="100%" stopColor="#C2410C"/></linearGradient></defs>
          <path d="M7 35h50l-4-16-7 8L32 10l-14 17-7-8z" fill="url(#cg3)" stroke="#9A3412" strokeWidth="1.3"/>
          <path d="M5 35h54v6H5z" fill="url(#cg3)" stroke="#9A3412" strokeWidth="1.2"/>
          <circle cx="17" cy="23" r="3" fill="#22C55E" stroke="#15803D" strokeWidth="0.8"/><circle cx="47" cy="23" r="3" fill="#22C55E" stroke="#15803D" strokeWidth="0.8"/>
          <circle cx="14" cy="38" r="2" fill="#4ADE80"/><circle cx="32" cy="38" r="2" fill="#4ADE80"/><circle cx="50" cy="38" r="2" fill="#4ADE80"/>
        </svg>
      );
    case 4: // Purple crown — white star, colorful gems
      return (
        <svg width={s} height={s * 0.73} viewBox="0 0 64 47" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="cg4" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C084FC"/><stop offset="100%" stopColor="#7C3AED"/></linearGradient></defs>
          <path d="M8 37h48l-4-17-7 9L32 9l-13 20-7-9z" fill="url(#cg4)" stroke="#6D28D9" strokeWidth="1.3"/>
          <path d="M6 37h52v6H6z" fill="url(#cg4)" stroke="#6D28D9" strokeWidth="1.2"/>
          <polygon points="32,14 34.5,20 41,20 36,24 37.5,30 32,27 26.5,30 28,24 23,20 29.5,20" fill="#FEF08A" stroke="#FACC15" strokeWidth="0.6"/>
          <circle cx="16" cy="24" r="3" fill="#F472B6"/><circle cx="48" cy="24" r="3" fill="#38BDF8"/>
          <circle cx="14" cy="40" r="2" fill="#E879F9"/><circle cx="32" cy="40" r="2" fill="#E879F9"/><circle cx="50" cy="40" r="2" fill="#E879F9"/>
        </svg>
      );
    case 5: // Neon blue crown — glowing outline
      return (
        <svg width={s} height={s * 0.72} viewBox="0 0 64 46" xmlns="http://www.w3.org/2000/svg">
          <defs><filter id="ng"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
          <path d="M10 36h44l-4-16-7 8L32 10l-11 18-7-8z" fill="none" stroke="#06B6D4" strokeWidth="2.5" filter="url(#ng)" opacity="0.9"/>
          <path d="M8 36h48v5H8z" fill="none" stroke="#06B6D4" strokeWidth="2"/>
          <path d="M10 36h44l-4-16-7 8L32 10l-11 18-7-8z" fill="rgba(6,182,212,0.08)" stroke="#22D3EE" strokeWidth="1.2"/>
          <path d="M8 36h48v5H8z" fill="rgba(6,182,212,0.12)" stroke="#67E8F9" strokeWidth="1"/>
          <circle cx="17" cy="23" r="2.5" fill="#22D3EE"/><circle cx="47" cy="23" r="2.5" fill="#22D3EE"/>
          <circle cx="15" cy="39" r="1.8" fill="#67E8F9"/><circle cx="32" cy="39" r="1.8" fill="#67E8F9"/><circle cx="49" cy="39" r="1.8" fill="#67E8F9"/>
        </svg>
      );
    case 6: // Pink layered cake crown
      return (
        <svg width={s} height={s * 0.65} viewBox="0 0 64 42" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="cg6" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F9A8D4"/><stop offset="100%" stopColor="#EC4899"/></linearGradient></defs>
          <rect x="10" y="28" width="44" height="8" rx="3" fill="url(#cg6)" stroke="#DB2777" strokeWidth="1"/>
          <rect x="14" y="20" width="36" height="8" rx="2.5" fill="url(#cg6)" stroke="#DB2777" strokeWidth="1"/>
          {/* Flowers */}
          <circle cx="20" cy="16" r="4" fill="#F472B6" stroke="#EC4899" strokeWidth="0.8"/><circle cx="20" cy="16" r="1.5" fill="#FDF4FF"/>
          <circle cx="32" cy="13" r="4.5" fill="#F472B6" stroke="#EC4899" strokeWidth="0.8"/><circle cx="32" cy="13" r="1.8" fill="#FDF4FF"/>
          <circle cx="44" cy="16" r="4" fill="#F472B6" stroke="#EC4899" strokeWidth="0.8"/><circle cx="44" cy="16" r="1.5" fill="#FDF4FF"/>
          <circle cx="26" cy="18" r="3" fill="#FBCFE8"/><circle cx="38" cy="18" r="3" fill="#FBCFE8"/>
          <rect x="10" y="33" width="44" height="2" rx="1" fill="#FBCFE8" opacity="0.5"/>
          <rect x="14" y="25" width="36" height="2" rx="1" fill="#FBCFE8" opacity="0.5"/>
        </svg>
      );
    case 7: // Gold bar / grid trophy
      return (
        <svg width={s} height={s * 0.7} viewBox="0 0 64 45" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="cg7" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FDE047"/><stop offset="100%" stopColor="#EAB308"/></linearGradient></defs>
          {/* Grid pattern */}
          {[...Array(5)].map((_, row) => [...Array(8)].map((_, col) => (
            <rect key={`${row}-${col}`} x={10 + col * 5.5} y={8 + row * 5} width="4.5" height="4" rx="0.5"
              fill={(row + col) % 2 === 0 ? '#FDE047' : '#CA8A04'} stroke="#A16207" strokeWidth="0.3"/>
          )))}
          <rect x="8" y="6" width="48" height="27" rx="2" fill="none" stroke="#CA8A07" strokeWidth="1.5"/>
          {/* Base */}
          <path d="M12 34h40v5H12z" fill="url(#cg7)" stroke="#A16207" strokeWidth="1"/>
          <path d="M18 39h28v4H18z" fill="url(#cg7)" stroke="#A16207" strokeWidth="1"/>
        </svg>
      );
    case 8: // Orange amber crown with black gem
      return (
        <svg width={s} height={s * 0.72} viewBox="0 0 64 46" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="cg8" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FDBA74"/><stop offset="100%" stopColor="#EA580C"/></linearGradient></defs>
          <path d="M8 36h48l-4-17-7 8L32 11l-13 19-7-8z" fill="url(#cg8)" stroke="#C2410C" strokeWidth="1.3"/>
          <path d="M6 36h52v6H6z" fill="url(#cg8)" stroke="#C2410C" strokeWidth="1.2"/>
          {/* Black/dark gem at top */}
          <circle cx="32" cy="15" r="5" fill="#1F2937" stroke="#374151" strokeWidth="1"/><circle cx="32" cy="14" r="2" fill="#4B5563"/>
          <circle cx="17" cy="24" r="2.8" fill="#FCD34D" stroke="#F59E0B" strokeWidth="0.6"/>
          <circle cx="47" cy="24" r="2.8" fill="#FCD34D" stroke="#F59E0B" strokeWidth="0.6"/>
          <circle cx="14" cy="39" r="2" fill="#FDBA74"/><circle cx="32" cy="39" r="2" fill="#FDBA74"/><circle cx="50" cy="39" r="2" fill="#FDBA74"/>
        </svg>
      );
    case 9: // Ice / snowflake crown
      return (
        <svg width={s} height={s * 0.73} viewBox="0 0 64 47" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="cg9" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#BFDBFE"/><stop offset="100%" stopColor="#3B82F6"/></linearGradient></defs>
          <path d="M7 37h50l-4-17-8 9L32 8l-13 21-8-9z" fill="url(#cg9)" stroke="#1D4ED8" strokeWidth="1.3"/>
          <path d="M5 37h54v6H5z" fill="url(#cg9)" stroke="#1D4ED8" strokeWidth="1.2"/>
          {/* Snowflakes */}
          <text x="18" y="20" fontSize="10" fill="#EFF6FF" opacity="0.9">❄</text>
          <text x="42" y="18" fontSize="9" fill="#EFF6FF" opacity="0.85">❅</text>
          <text x="30" y="24" fontSize="8" fill="#DBEAFE" opacity="0.8">❆</text>
          <circle cx="15" cy="40" r="2" fill="#93C5FD"/><circle cx="32" cy="40" r="2" fill="#93C5FD"/><circle cx="49" cy="40" r="2" fill="#93C5FD"/>
        </svg>
      );
    case 10: // Teal podium / trophy cup
      return (
        <svg width={s} height={s * 0.68} viewBox="0 0 64 43" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="cg10" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5EEAD4"/><stop offset="100%" stopColor="#14B8A6"/></linearGradient></defs>
          {/* Cup body */}
          <path d="M14 8h36v22c0 3-7 5-18 5s-18-2-18-5V8z" fill="url(#cg10)" stroke="#0D9488" strokeWidth="1.3"/>
          {/* Handles */}
          <path d="M14 12H8c-3 0-4 4-2 8s6 4 8 2" fill="none" stroke="#14B8A6" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M50 12h6c3 0 4 4 2 8s-6 4-8 2" fill="none" stroke="#14B8A6" strokeWidth="2.5" strokeLinecap="round"/>
          {/* Base */}
          <rect x="22" y="35" width="20" height="4" rx="1.5" fill="url(#cg10)" stroke="#0D9488" strokeWidth="1"/>
          <rect x="18" y="39" width="28" height="3" rx="1" fill="url(#cg10)" stroke="#0D9488" strokeWidth="1"/>
          {/* Decorative line */}
          <line x1="16" y1="16" x2="48" y2="16" stroke="#99F6E4" strokeWidth="1" opacity="0.5"/>
          <circle cx="32" cy="20" r="3" fill="#99F6E4" opacity="0.4"/>
        </svg>
      );
    default:
      return null;
  }
}

/** Rank badge color for Top 4-10 list items */
function getRankColor(rank: number): string {
  const colors: Record<number, string> = {
    1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32',
    4: '#A855F7', 5: '#06B6D4', 6: '#EC4899',
    7: '#EAB308', 8: '#EA580C', 9: '#3B82F6', 10: '#14B8A6',
  };
  return colors[rank] || '#94a3b8';
}

interface LeaderboardEntry {
  rank: number; userId: string; displayName: string | null;
  avatarUrl: string | null; email: string;
  playbookCount?: number; totalSales?: number;
  totalViews?: number;
  returnRate?: number; // For return rate leaderboard
}

function LeaderboardCard({
  title, icon, dataKey, data,
}: {
  title: string; icon: React.ReactNode; dataKey: string;
  data?: LeaderboardEntry[];
}) {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const _isZh = i18n.language.startsWith('zh');

  if (!data || data.length === 0) return null;

  const podium = data.slice(0, 3);
  const rest = data.slice(3, 10);

  const getLabel = (entry: LeaderboardEntry) => (entry.displayName || entry.email.split('@')[0]);
  const getCount = (entry: LeaderboardEntry) => {
    if (dataKey === 'returnRate') return entry.returnRate ?? 0;
    if (dataKey === 'views') return entry.totalViews ?? 0;
    return dataKey === 'publishers' ? (entry.playbookCount || 0) : (entry.totalSales || 0);
  };
  const formatCount = (entry: LeaderboardEntry) => {
    if (dataKey === 'returnRate') {
      const val = entry.returnRate ?? 0;
      return (val >= 0 ? '+' : '') + val.toFixed(2) + '%';
    }
    return String(getCount(entry));
  };

  return (
    <Card sx={{ mb: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2 }}>
      <CardContent sx={{ pb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          {icon}
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#f1f5f9' }}>{title}</Typography>
        </Box>

        {/* Podium for Top 3 — with crowns */}
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: { xs: 0.8, sm: 1.5 }, mb: rest.length > 0 ? 2 : 0, px: 1 }}>
          {/* Rank 2 — Silver */}
          {podium[1] && (
            <Box onClick={() => navigate('/playbooks?author=' + podium[1].userId + '&authorName=' + encodeURIComponent(getLabel(podium[1])))} sx={{ cursor: 'pointer', textAlign: 'center' }}>
              <Box sx={{ position: 'relative', display: 'inline-block', mb: -0.5 }}>
                <Box sx={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', zIndex: 2 }}>
                  <RankCrown rank={2} size={24} />
                </Box>
                <Avatar src={podium[1].avatarUrl || undefined} sx={{ width: { xs: 46, sm: 52 }, height: { xs: 46, sm: 52 }, mx: 'auto', mb: 0.5, border: `2.5px solid ${getRankColor(2)}`, fontSize: { xs: 14, sm: 16 }, boxShadow: `0 0 12px ${alpha(getRankColor(2), 0.3)}` }}>
                  {(podium[1].displayName || podium[1].email)?.charAt(0).toUpperCase()}
                </Avatar>
              </Box>
              <Typography variant="caption" sx={{ color: getRankColor(2), fontWeight: 700, display: 'block', fontSize: { xs: 13, sm: 15 }, lineHeight: 1 }}>TOP2</Typography>
              <Tooltip title={getLabel(podium[1]) + ' - ' + String(getCount(podium[1]))}>
                <Typography variant="caption" sx={{ color: '#cbd5e1', fontSize: { xs: 9, sm: 10 }, maxWidth: { xs: 60, sm: 70 }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                  {getLabel(podium[1])}
                </Typography>
              </Tooltip>
              <Chip size="small" label={formatCount(podium[1])} sx={{ height: 20, fontSize: 10, bgcolor: alpha(getRankColor(2), 0.12), color: getRankColor(2) }} />
            </Box>
          )}
          {/* Rank 1 — Gold (Center) */}
          {podium[0] && (
            <Box onClick={() => navigate('/playbooks?author=' + podium[0].userId + '&authorName=' + encodeURIComponent(getLabel(podium[0])))} sx={{ cursor: 'pointer', textAlign: 'center' }}>
              <Box sx={{ position: 'relative', display: 'inline-block', mb: -0.5 }}>
                <Box sx={{ position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)', zIndex: 2 }}>
                  <RankCrown rank={1} size={32} />
                </Box>
                <Avatar src={podium[0].avatarUrl || undefined} sx={{ width: { xs: 62, sm: 72 }, height: { xs: 62, sm: 72 }, mx: 'auto', mb: 0.5, border: `3px solid ${getRankColor(1)}`, fontSize: { xs: 18, sm: 22 }, boxShadow: `0 0 16px ${alpha(getRankColor(1), 0.4)}` }}>
                  {(podium[0].displayName || podium[0].email)?.charAt(0).toUpperCase()}
                </Avatar>
              </Box>
              <Typography variant="caption" sx={{ color: getRankColor(1), fontWeight: 800, display: 'block', fontSize: { xs: 15, sm: 18 }, lineHeight: 1 }}>TOP1</Typography>
              <Tooltip title={getLabel(podium[0]) + ' - ' + String(getCount(podium[0]))}>
                <Typography variant="caption" sx={{ color: '#f1f5f9', fontSize: { xs: 10, sm: 11 }, fontWeight: 600, maxWidth: { xs: 70, sm: 85 }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                  {getLabel(podium[0])}
                </Typography>
              </Tooltip>
              <Chip size="small" label={formatCount(podium[0])} sx={{ height: 22, fontSize: { xs: 10, sm: 11 }, bgcolor: alpha(getRankColor(1), 0.15), color: getRankColor(1), fontWeight: 700 }} />
            </Box>
          )}
          {/* Rank 3 — Bronze */}
          {podium[2] && (
            <Box onClick={() => navigate('/playbooks?author=' + podium[2].userId + '&authorName=' + encodeURIComponent(getLabel(podium[2])))} sx={{ cursor: 'pointer', textAlign: 'center' }}>
              <Box sx={{ position: 'relative', display: 'inline-block', mb: -0.5 }}>
                <Box sx={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', zIndex: 2 }}>
                  <RankCrown rank={3} size={22} />
                </Box>
                <Avatar src={podium[2].avatarUrl || undefined} sx={{ width: { xs: 42, sm: 48 }, height: { xs: 42, sm: 48 }, mx: 'auto', mb: 0.5, border: `2px solid ${getRankColor(3)}`, fontSize: { xs: 13, sm: 15 }, boxShadow: `0 0 10px ${alpha(getRankColor(3), 0.25)}` }}>
                  {(podium[2].displayName || podium[2].email)?.charAt(0).toUpperCase()}
                </Avatar>
              </Box>
              <Typography variant="caption" sx={{ color: getRankColor(3), fontWeight: 700, display: 'block', fontSize: { xs: 12, sm: 14 }, lineHeight: 1 }}>TOP3</Typography>
              <Tooltip title={getLabel(podium[2]) + ' - ' + String(getCount(podium[2]))}>
                <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: { xs: 9, sm: 10 }, maxWidth: { xs: 55, sm: 65 }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                  {getLabel(podium[2])}
                </Typography>
              </Tooltip>
              <Chip size="small" label={formatCount(podium[2])} sx={{ height: 20, fontSize: 10, bgcolor: alpha(getRankColor(3), 0.12), color: getRankColor(3) }} />
            </Box>
          )}
        </Box>

        {/* Ranks 4-10 */}
        {rest.length > 0 && (
          <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.06)', pt: 1.5 }}>
            {rest.map((entry) => (
              <Box
                key={entry.userId}
                onClick={() => navigate('/playbooks?author=' + entry.userId + '&authorName=' + encodeURIComponent(getLabel(entry)))}
                sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.6, px: 1, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}
              >
                <Typography variant="caption" sx={{ color: getRankColor(entry.rank), fontWeight: 700, fontStyle: 'italic', fontSize: 11, minWidth: 36 }}>TOP{entry.rank}</Typography>
                <Box sx={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                  <Box sx={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', zIndex: 2 }}>
                    <RankCrown rank={entry.rank} size={18} />
                  </Box>
                  <Avatar src={entry.avatarUrl || undefined} sx={{ width: 30, height: 30, fontSize: 11 }}>
                    {(entry.displayName || entry.email)?.charAt(0).toUpperCase()}
                  </Avatar>
                </Box>
                <Typography variant="caption" sx={{ flex: 1, color: '#cbd5e1', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getLabel(entry)}
                </Typography>
                <Chip size="small" label={formatCount(entry)} sx={{ height: 20, fontSize: 10, minWidth: 36 }} />
              </Box>
            ))}
          </Box>
        )}
        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'rgba(148,163,184,0.5)', fontSize: 10.5, mt: 1, fontStyle: 'italic' }}>
          {_isZh ? '💡 点击用户头像即可查看其发布的帖子' : '💡 Click on a user\'s avatar to view their posts'}
        </Typography>
      </CardContent>
    </Card>
  );
}

/** Podium for return rate leaderboard (top 3 with crowns) */
function ReturnRatePodium({ data, navigate }: { data: LeaderboardEntry[]; navigate: (path: string) => void }) {
  const podium = data.slice(0, 3);
  const getLabel = (e: LeaderboardEntry) => e.displayName || e.email.split('@')[0];
  const formatRate = (val: number | undefined) => {
    const v = val ?? 0;
    return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: { xs: 0.8, sm: 1.5 }, mb: data.length > 3 ? 2 : 0, px: 1 }}>
      {/* Rank 2 */}
      {podium[1] && (
        <Box onClick={() => navigate('/playbooks?author=' + podium[1].userId + '&authorName=' + encodeURIComponent(getLabel(podium[1])))} sx={{ cursor: 'pointer', textAlign: 'center' }}>
          <Box sx={{ position: 'relative', display: 'inline-block', mb: -0.5 }}>
            <Box sx={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', zIndex: 2 }}>
              <RankCrown rank={2} size={24} />
            </Box>
            <Avatar src={podium[1].avatarUrl || undefined} sx={{ width: { xs: 46, sm: 52 }, height: { xs: 46, sm: 52 }, mx: 'auto', mb: 0.5, border: `2.5px solid ${getRankColor(2)}`, fontSize: { xs: 14, sm: 16 }, boxShadow: `0 0 12px ${alpha(getRankColor(2), 0.3)}` }}>
              {getLabel(podium[1]).charAt(0).toUpperCase()}
            </Avatar>
          </Box>
          <Typography variant="caption" sx={{ color: getRankColor(2), fontWeight: 700, display: 'block', fontSize: { xs: 13, sm: 15 }, lineHeight: 1 }}>TOP2</Typography>
          <Tooltip title={getLabel(podium[1])}>
            <Typography variant="caption" sx={{ color: '#cbd5e1', fontSize: { xs: 9, sm: 10 }, maxWidth: { xs: 60, sm: 70 }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{getLabel(podium[1])}</Typography>
          </Tooltip>
          <Chip size="small" label={formatRate(podium[1].returnRate)} sx={{ height: 20, fontSize: 10, bgcolor: (podium[1].returnRate ?? 0) >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: (podium[1].returnRate ?? 0) >= 0 ? '#4ade80' : '#f87171', fontWeight: 600 }} />
        </Box>
      )}
      {/* Rank 1 — Center */}
      {podium[0] && (
        <Box onClick={() => navigate('/playbooks?author=' + podium[0].userId + '&authorName=' + encodeURIComponent(getLabel(podium[0])))} sx={{ cursor: 'pointer', textAlign: 'center' }}>
          <Box sx={{ position: 'relative', display: 'inline-block', mb: -0.5 }}>
            <Box sx={{ position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)', zIndex: 2 }}>
              <RankCrown rank={1} size={32} />
            </Box>
            <Avatar src={podium[0].avatarUrl || undefined} sx={{ width: { xs: 62, sm: 72 }, height: { xs: 62, sm: 72 }, mx: 'auto', mb: 0.5, border: `3px solid ${getRankColor(1)}`, fontSize: { xs: 18, sm: 22 }, boxShadow: `0 0 16px ${alpha(getRankColor(1), 0.4)}` }}>
              {getLabel(podium[0]).charAt(0).toUpperCase()}
            </Avatar>
          </Box>
          <Typography variant="caption" sx={{ color: getRankColor(1), fontWeight: 800, display: 'block', fontSize: { xs: 15, sm: 18 }, lineHeight: 1 }}>TOP1</Typography>
          <Tooltip title={getLabel(podium[0])}>
            <Typography variant="caption" sx={{ color: '#f1f5f9', fontSize: { xs: 10, sm: 11 }, fontWeight: 600, maxWidth: { xs: 70, sm: 85 }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{getLabel(podium[0])}</Typography>
          </Tooltip>
          <Chip size="small" label={formatRate(podium[0].returnRate)} sx={{ height: 22, fontSize: { xs: 10, sm: 11 }, bgcolor: (podium[0].returnRate ?? 0) >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: (podium[0].returnRate ?? 0) >= 0 ? '#4ade80' : '#f87171', fontWeight: 700 }} />
        </Box>
      )}
      {/* Rank 3 */}
      {podium[2] && (
        <Box onClick={() => navigate('/playbooks?author=' + podium[2].userId + '&authorName=' + encodeURIComponent(getLabel(podium[2])))} sx={{ cursor: 'pointer', textAlign: 'center' }}>
          <Box sx={{ position: 'relative', display: 'inline-block', mb: -0.5 }}>
            <Box sx={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', zIndex: 2 }}>
              <RankCrown rank={3} size={22} />
            </Box>
            <Avatar src={podium[2].avatarUrl || undefined} sx={{ width: { xs: 42, sm: 48 }, height: { xs: 42, sm: 48 }, mx: 'auto', mb: 0.5, border: `2px solid ${getRankColor(3)}`, fontSize: { xs: 13, sm: 15 }, boxShadow: `0 0 10px ${alpha(getRankColor(3), 0.25)}` }}>
              {getLabel(podium[2]).charAt(0).toUpperCase()}
            </Avatar>
          </Box>
          <Typography variant="caption" sx={{ color: getRankColor(3), fontWeight: 700, display: 'block', fontSize: { xs: 12, sm: 14 }, lineHeight: 1 }}>TOP3</Typography>
          <Tooltip title={getLabel(podium[2])}>
            <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: { xs: 9, sm: 10 }, maxWidth: { xs: 55, sm: 65 }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{getLabel(podium[2])}</Typography>
          </Tooltip>
          <Chip size="small" label={formatRate(podium[2].returnRate)} sx={{ height: 20, fontSize: 10, bgcolor: (podium[2].returnRate ?? 0) >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: (podium[2].returnRate ?? 0) >= 0 ? '#4ade80' : '#f87171', fontWeight: 600 }} />
        </Box>
      )}
    </Box>
  );
}

export default function RewardsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isZh = i18n.language.startsWith('zh');

  const { data: tasksData, isLoading: tasksLoading } = useGetTasksQuery();
  const { data: creditData } = useGetCreditBalanceQuery();
  const { data: publisherData } = useGetPublisherLeaderboardQuery({ limit: 10 });
  const { data: sellerData } = useGetSellerLeaderboardQuery({ limit: 10 });
  const [returnRatePeriod, setReturnRatePeriod] = useState<string>('3m');
  const [creditToast, setCreditToast] = useState('');
  const { data: returnRateData } = useGetReturnRateLeaderboardQuery({ limit: 10, period: returnRatePeriod });
  const { data: viewsData } = useGetViewsLeaderboardQuery({ limit: 10 });

  const newbieTasks = (tasksData?.data?.newbie || []) as any[];
  const advancedTasks = (tasksData?.data?.advanced || []) as any[];
  const availableCredits = creditData?.data?.available || 0;

  const renderTaskCard = (task: any) => {
    const progress = task.progress;
    const status = progress?.status || 'pending';
    const current = progress?.currentCount || 0;
    const target = task.targetCount;
    const isDailyCapTask = DAILY_CAP_TASK_KEYS.has(task.key);
    // Daily-cap tasks: no total target, show count only. Others: show X/Y progress.
    const percent = isDailyCapTask ? 100 : (target > 0 ? Math.min((current / target) * 100, 100) : 0);
    const isCompleted = status === 'completed' || status === 'claimed';
    const isInProgress = status === 'in_progress';
    const borderLeftColor = task.category === 'newbie' ? '#E5A23C' : '#00d4aa';

    // Daily cap state: today's credit grants vs cap
    const todayGranted = task.todayCreditsGranted || 0;
    const dailyCap = task.dailyCap || 2;
    const isCapHit = isDailyCapTask && todayGranted >= dailyCap;

    return (
      <Card key={task.id} sx={{ mb: 1.5, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderLeft: `3px solid ${borderLeftColor}`, borderRadius: 2, '&:hover': { borderColor: alpha(borderLeftColor, 0.3) }, transition: 'all 0.2s' }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                {task.icon && <Typography sx={{ fontSize: 18, lineHeight: 1 }}>{task.icon}</Typography>}
                <Typography variant="body1" sx={{ fontWeight: 600, color: '#f1f5f9' }}>{isZh && task.titleZh ? task.titleZh : task.title}</Typography>
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.4 }}>{isZh && task.descriptionZh ? task.descriptionZh : task.description}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 260, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <BoltIcon sx={{ fontSize: 16, color: isCapHit ? '#666' : '#E5A23C' }} />
                <Typography variant="caption" sx={{ color: isCapHit ? '#666' : '#E5A23C', fontWeight: 600, whiteSpace: 'nowrap' }}>{isDailyCapTask ? '100 Credits' : `${task.creditReward} Credits`}</Typography>
              </Box>
              {task.badgeKey && (
                <Chip size="small" label="" icon={<WorkspacePremiumIcon sx={{ fontSize: 14 }} />} sx={{ height: 28, width: 28, p: 0, bgcolor: alpha('#E5A23C', 0.12), color: '#E5A23C', '& .MuiChip-icon': { color: '#E5A23C' } }} />
              )}
              {isDailyCapTask ? (
                <Typography variant="caption" sx={{ color: isCapHit ? '#666' : 'text.secondary', whiteSpace: 'nowrap', fontWeight: 600 }}>
                  {isZh ? `今日 ${todayGranted}/${dailyCap}` : `${todayGranted}/${dailyCap} today`}
                </Typography>
              ) : (
                <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap', minWidth: 32, textAlign: 'right' }}>{`${current}/${target}`}</Typography>
              )}
            </Box>
            <Box sx={{ minWidth: 90, textAlign: 'right' }}>
              {isCompleted ? <Chip icon={<CheckCircleIcon />} label={isZh ? '\u5DF2\u5B8C\u6210' : 'Completed'} color="success" size="small" sx={{ fontWeight: 600 }} /> :
                isCapHit ? (
                  /* Daily cap reached — gray button, still navigates but visually disabled */
                  <Button size="small" variant="outlined" onClick={() => navigate(TASK_ACTION_MAP[task.key] || '/dashboard')} sx={{ borderRadius: 20, fontSize: 12, px: 2, borderColor: '#444', color: '#666', bgcolor: 'rgba(100,100,100,0.08)', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(100,100,100,0.15)' } }}>
                    {isZh ? '已达上限' : 'Cap Hit'}
                  </Button>
                ) :
                isInProgress ? <Button size="small" variant="outlined" endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />} onClick={() => navigate(TASK_ACTION_MAP[task.key] || '/dashboard')} sx={{ borderRadius: 20, fontSize: 12, px: 1.5, borderColor: '#00d4aa', color: '#00d4aa', '&:hover': { bgcolor: 'rgba(0,212,170,0.08)' } }}>{isZh ? '\u8FDB\u884C\u4E2D...' : 'In Progress...'}</Button> :
                <Button size="small" variant="contained" onClick={() => navigate(TASK_ACTION_MAP[task.key] || '/dashboard')} sx={{ borderRadius: 20, fontSize: 12, px: 2, background: 'linear-gradient(135deg,#a855f7 0%,#ec4899 100%)', color: '#fff', fontWeight: 700, boxShadow: '0 2px 8px rgba(168,85,247,0.3)', '&:hover': { background: 'linear-gradient(135deg,#9333ea 0%,#db2777 100%)' } }}>{isZh ? '\u53BB\u5B8C\u6210' : 'Go Complete'}</Button>}
            </Box>
          </Box>
          {!isCompleted && !isDailyCapTask && <LinearProgress variant="determinate" value={percent} sx={{ mt: 1.25, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)', '& .MuiLinearProgress-bar': { bgcolor: isInProgress ? '#00d4aa' : 'rgba(255,255,255,0.15)', borderRadius: 2 } }} />}
        </CardContent>
      </Card>
    );
  };

  if (tasksLoading) {
    return (<Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><Box sx={{ width: 40, height: 40, borderTop: '3px solid #00d4aa', border: '3px solid rgba(255,255,255,0.1)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></Box>);
  }

  return (
    <Box sx={{ py: 3, px: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#f1f5f9' }}>{t('growthPlan.title', 'Growth Plan')}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Tooltip title={isZh ? '点击查看积分明细' : 'Click to view credits details'}>
            <Box
              onClick={() => navigate('/credits')}
              sx={{
                px: 2, py: 0.75, borderRadius: 3,
                background: 'linear-gradient(135deg, rgba(229,162,60,0.15), rgba(229,162,60,0.05))',
                border: '1px solid rgba(229,162,60,0.25)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': { background: 'linear-gradient(135deg, rgba(229,162,60,0.25), rgba(229,162,60,0.1))', borderColor: 'rgba(229,162,60,0.5)', transform: 'translateY(-1px)' },
              }}
            >
              <Typography variant="body2" sx={{ color: '#E5A23C', fontWeight: 700 }}><BoltIcon sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5, mb: 0.25 }} />{availableCredits} {t('growthPlan.credits', 'Credits')}</Typography>
            </Box>
          </Tooltip>
        </Box>
      </Box>

      {/* Tasks + Leaderboards in a single column, full width */}
      <Grid container spacing={3}>
        {/* Left: Tasks (full width on all screens) */}
        <Grid size={{ xs: 12, lg: 7 }}>
          {/* Newbie Tasks */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Avatar sx={{ width: 28, height: 28, bgcolor: 'rgba(229,162,60,0.15)', color: '#E5A23C' }}><StarIcon sx={{ fontSize: 16 }} /></Avatar>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#f1f5f9' }}>{t('rewards.newbieTasks', 'Newbie Tasks')}</Typography>
            </Box>
            {newbieTasks.length > 0 ? newbieTasks.map(renderTaskCard) : <Typography variant="body2" sx={{ color: 'text.secondary', py: 2 }}>{t('rewards.noTasks', 'No tasks available')}</Typography>}
          </Box>

          {/* Advanced Tasks */}
          <Box sx={{ mb: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Avatar sx={{ width: 28, height: 28, bgcolor: 'rgba(0,212,170,0.15)', color: '#00d4aa' }}><AssignmentIcon sx={{ fontSize: 16 }} /></Avatar>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#f1f5f9' }}>{t('rewards.advancedTasks', 'Advanced Tasks')}</Typography>
            </Box>
            {advancedTasks.length > 0 ? advancedTasks.map(renderTaskCard) : <Typography variant="body2" sx={{ color: 'text.secondary', py: 2 }}>{t('rewards.noTasks', 'No tasks available')}</Typography>}
          </Box>
        </Grid>

        {/* Right: Leaderboards (full vertical space, no badge wall) */}
        <Grid size={{ xs: 12, lg: 5 }}>
          {/* Return Rate Leaderboard with period selector */}
          <Card sx={{ mb: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2 }}>
            <CardContent sx={{ pb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TrendingUpIcon sx={{ color: '#8b5cf6', fontSize: 20 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#f1f5f9' }}>{isZh ? '\uD83D\uDCC8 \u6536\u76CA\u7387\u6392\u884C' : '\uD83D\uDCC8 Return Rate Leaderboard'}</Typography>
                </Box>
                <ToggleButtonGroup
                  size="small"
                  value={returnRatePeriod}
                  exclusive
                  onChange={(_, val) => { if (val) setReturnRatePeriod(val); }}
                  sx={{
                    '& .MuiToggleButton-root': {
                      px: 1.2, py: 0.3, fontSize: 11, color: '#94a3b8', borderColor: 'rgba(255,255,255,0.1)',
                      '&.Mui-selected': { bgcolor: 'rgba(139,92,246,0.15)', color: '#a78bfa', borderColor: 'rgba(139,92,246,0.4)' },
                    },
                  }}
                >
                  <ToggleButton value="1m">{isZh ? '1\u6708' : '1M'}</ToggleButton>
                  <ToggleButton value="3m">{isZh ? '3\u6708' : '3M'}</ToggleButton>
                  <ToggleButton value="6m">{isZh ? '6\u6708' : '6M'}</ToggleButton>
                  <ToggleButton value="12m">{isZh ? '1\u5E74' : '1Y'}</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {returnRateData?.data && returnRateData.data.length > 0 ? (
                <>
                  {(returnRateData.data as LeaderboardEntry[]).slice(0, 3).length > 0 && (
                    <ReturnRatePodium data={returnRateData.data as LeaderboardEntry[]} navigate={navigate} />
                  )}
                  {(returnRateData.data as LeaderboardEntry[]).slice(3, 10).length > 0 && (
                    <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.06)', pt: 1.5 }}>
                      {(returnRateData.data as LeaderboardEntry[]).slice(3, 10).map((entry: LeaderboardEntry) => {
                        const rrLabel = entry.displayName || entry.email.split('@')[0];
                        return (
                        <Box
                          key={entry.userId}
                          onClick={() => navigate('/playbooks?author=' + entry.userId + '&authorName=' + encodeURIComponent(rrLabel))}
                          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.6, px: 1, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}
                        >
                          <Typography variant="caption" sx={{ color: getRankColor(entry.rank), fontWeight: 700, fontStyle: 'italic', fontSize: 11, minWidth: 36 }}>TOP{entry.rank}</Typography>
                          <Box sx={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                            <Box sx={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', zIndex: 2 }}>
                              <RankCrown rank={entry.rank} size={18} />
                            </Box>
                            <Avatar src={entry.avatarUrl || undefined} sx={{ width: 30, height: 30, fontSize: 11 }}>
                              {(entry.displayName || entry.email)?.charAt(0).toUpperCase()}
                            </Avatar>
                          </Box>
                          <Typography variant="caption" sx={{ flex: 1, color: '#cbd5e1', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {rrLabel}
                          </Typography>
                          <Chip
                            size="small"
                            label={(entry.returnRate ?? 0 >= 0 ? '+' : '') + (entry.returnRate ?? 0).toFixed(2) + '%'}
                            sx={{
                              height: 20, fontSize: 10, minWidth: 50,
                              bgcolor: (entry.returnRate ?? 0) >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                              color: (entry.returnRate ?? 0) >= 0 ? '#4ade80' : '#f87171',
                              fontWeight: 600,
                            }}
                          />
                        </Box>
                        );
                      })}
                    </Box>
                  )}
                </>
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, textAlign: 'center' }}>{isZh ? '\u6682\u65E0\u6570\u636E' : 'No data yet'}</Typography>
              )}
            <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'rgba(148,163,184,0.5)', fontSize: 10.5, mt: 1, fontStyle: 'italic' }}>
              {isZh
                ? '收益率 = 净盈亏 ÷ 投入（入场价×数量÷杠杆）；按平仓日、已扣手续费；至少 5 笔平仓且投入 ≥ $100；换算为 USD'
                : 'Return rate = net P&L ÷ investment (entry×qty÷leverage); by exit date, fees included; min 5 closed trades & $100 investment; converted to USD'}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'rgba(148,163,184,0.5)', fontSize: 10.5, mt: 0.5, fontStyle: 'italic' }}>
              {isZh ? '💡 点击用户头像即可查看其发布的帖子' : '💡 Click on a user\'s avatar to view their posts'}
            </Typography>
            </CardContent>
          </Card>

          {/* Publisher Rankings */}
          <LeaderboardCard title={isZh ? '\uD83C\uDFC6 \u53D1\u5E03\u8005\u6392\u884C' : '\uD83C\uDFC6 Publisher Rankings'} icon={<AutoStoriesIcon sx={{ color: '#00d4aa', fontSize: 20 }} />} dataKey="publishers" data={publisherData?.data} />

          {/* Views Leaderboard — total postViews per user */}
          <LeaderboardCard title={isZh ? '\uD83D\uDC41 \u9605\u8BFB\u91CF\u6392\u884C' : '\uD83D\uDC41 Views Leaderboard'} icon={<VisibilityIcon sx={{ color: '#E5A23C', fontSize: 20 }} />} dataKey="views" data={viewsData?.data} />
        </Grid>
      </Grid>

      <Snackbar
        open={!!creditToast}
        autoHideDuration={2000}
        onClose={() => setCreditToast('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{
          '& .MuiPaper-root': { bgcolor: 'transparent !important', boxShadow: 'none !important', backgroundColor: 'transparent !important' },
          '& .MuiSnackbarContent-root': { backgroundColor: 'transparent !important', color: '#E5A23C !important', fontWeight: 700, borderRadius: 8, fontSize: 15, justifyContent: 'center', padding: '8px 16px' }
        }}
        message={creditToast}
      />
    </Box>
  );
}
