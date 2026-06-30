import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  Chip,
  TextField,
  InputAdornment,
  Grid,
} from '@mui/material';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { searchBlogArticles, type BlogArticleSlug } from '../../data/blogArticles';
import { tokenStorage } from '../../store/authApi';
import { isDeveloperEmail } from '../../utils/developer';
import {
  buildAutoTheme,
  getContentCardSx,
  getThemedChipSx,
  hexToRgba,
  type ContentCardTheme,
} from '../../utils/contentCardTheme';

interface BlogCardTheme extends ContentCardTheme {
  categoryEn: string;
  categoryZh: string;
}

const BLOG_CARD_THEMES: Partial<Record<BlogArticleSlug, BlogCardTheme>> = {
  'monday-gap-breakout-xauusd-ea': {
    accent: '#f59e0b',
    accentSoft: 'rgba(245,158,11,0.14)',
    chipBg: 'rgba(245,158,11,0.16)',
    chipColor: '#fcd34d',
    gradient: 'linear-gradient(135deg, rgba(245,158,11,0.22) 0%, rgba(217,119,6,0.04) 100%)',
    categoryEn: 'Gold · Weekly',
    categoryZh: '黄金 · 周周期',
  },
  'twinklestar-kdj-bollinger-ea-mt4': {
    accent: '#a78bfa',
    accentSoft: 'rgba(167,139,250,0.14)',
    chipBg: 'rgba(167,139,250,0.16)',
    chipColor: '#ddd6fe',
    gradient: 'linear-gradient(135deg, rgba(167,139,250,0.22) 0%, rgba(124,58,237,0.04) 100%)',
    categoryEn: 'MT4 · Indicators',
    categoryZh: 'MT4 · 指标',
  },
  'turtle-system-donchian-breakout-ea-mt4': {
    accent: '#38bdf8',
    accentSoft: 'rgba(56,189,248,0.14)',
    chipBg: 'rgba(56,189,248,0.16)',
    chipColor: '#bae6fd',
    gradient: 'linear-gradient(135deg, rgba(56,189,248,0.22) 0%, rgba(14,165,233,0.04) 100%)',
    categoryEn: 'Trend · Donchian',
    categoryZh: '趋势 · 唐奇安',
  },
  'the-one-eurusd-volatility-scalper-mt4': {
    accent: '#22d3ee',
    accentSoft: 'rgba(34,211,238,0.14)',
    chipBg: 'rgba(34,211,238,0.16)',
    chipColor: '#a5f3fc',
    gradient: 'linear-gradient(135deg, rgba(34,211,238,0.22) 0%, rgba(6,182,212,0.04) 100%)',
    categoryEn: 'Forex · Scalper',
    categoryZh: '外汇 · 剥头皮',
  },
  'gold-dashboard-ai-m1-scalper-mt4': {
    accent: '#34d399',
    accentSoft: 'rgba(52,211,153,0.14)',
    chipBg: 'rgba(52,211,153,0.16)',
    chipColor: '#a7f3d0',
    gradient: 'linear-gradient(135deg, rgba(52,211,153,0.22) 0%, rgba(16,185,129,0.04) 100%)',
    categoryEn: 'AI · Gold M1',
    categoryZh: 'AI · 黄金 M1',
  },
  'xauusd-one-candle-ny-session-scalper-mt4': {
    accent: '#fb923c',
    accentSoft: 'rgba(251,146,60,0.14)',
    chipBg: 'rgba(251,146,60,0.16)',
    chipColor: '#fed7aa',
    gradient: 'linear-gradient(135deg, rgba(251,146,60,0.22) 0%, rgba(234,88,12,0.04) 100%)',
    categoryEn: 'NY Session · Scalp',
    categoryZh: '纽约时段 · 剥头皮',
  },
  'aquilagold-h1-dual-sma-breakout-mt4': {
    accent: '#eab308',
    accentSoft: 'rgba(234,179,8,0.14)',
    chipBg: 'rgba(234,179,8,0.16)',
    chipColor: '#fde047',
    gradient: 'linear-gradient(135deg, rgba(234,179,8,0.22) 0%, rgba(202,138,4,0.04) 100%)',
    categoryEn: 'Gold · H1 Breakout',
    categoryZh: '黄金 · H1 突破',
  },
};

function buildBlogAutoTheme(slug: string): BlogCardTheme {
  const base = buildAutoTheme(slug);
  return {
    ...base,
    categoryEn: 'Strategy Guide',
    categoryZh: '策略解读',
  };
}

function getBlogCardTheme(slug: BlogArticleSlug): BlogCardTheme {
  return BLOG_CARD_THEMES[slug] ?? buildBlogAutoTheme(slug);
}

export default function BlogListPage() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const [search, setSearch] = useState('');
  const articles = useMemo(
    () => searchBlogArticles(i18n.language, search),
    [i18n.language, search],
  );
  const user = tokenStorage.getUser() as { email?: string } | null;
  const isDeveloper = isDeveloperEmail(user?.email);
  const hasSearch = search.trim().length > 0;

  return (
    <Box sx={{ mt: 2, mb: 4 }}>
      {/* Hero header */}
      <Box
        sx={{
          mb: 3,
          p: { xs: 2.5, md: 3 },
          borderRadius: 3,
          border: '1px solid rgba(0,212,170,0.18)',
          background: 'linear-gradient(135deg, rgba(0,212,170,0.12) 0%, rgba(15,23,42,0.6) 45%, rgba(10,14,23,0.9) 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 160,
            height: 160,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,212,170,0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, position: 'relative' }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #00d4aa 0%, #00a888 100%)',
              flexShrink: 0,
            }}
          >
            <MenuBookIcon sx={{ color: '#0a0e17', fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#f8fafc', mb: 0.75, lineHeight: 1.2 }}>
              {t('blog.listTitle', 'Blog')}
            </Typography>
            <Typography sx={{ color: '#94a3b8', maxWidth: 640, lineHeight: 1.7, fontSize: 15 }}>
              {t(
                'blog.listSubtitle',
                'Strategy guides and EA logic breakdowns. Click a title to read the full article.',
              )}
            </Typography>
            {!hasSearch && articles.length > 0 && (
              <Chip
                label={isZh ? `${articles.length} 篇文章` : `${articles.length} articles`}
                size="small"
                sx={{
                  mt: 1.5,
                  height: 24,
                  fontSize: 11,
                  fontWeight: 600,
                  bgcolor: 'rgba(0,212,170,0.14)',
                  color: '#5eead4',
                  border: '1px solid rgba(0,212,170,0.25)',
                }}
              />
            )}
          </Box>
        </Box>
      </Box>

      <TextField
        fullWidth
        placeholder={t('blog.searchPlaceholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{
          mb: 2.5,
          '& .MuiOutlinedInput-root': {
            bgcolor: 'rgba(15,23,42,0.55)',
            borderRadius: 2,
            '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
            '&:hover fieldset': { borderColor: 'rgba(0,212,170,0.35)' },
            '&.Mui-focused fieldset': { borderColor: '#00d4aa' },
          },
          '& .MuiInputBase-input': { color: '#e2e8f0' },
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#64748b' }} />
              </InputAdornment>
            ),
          },
        }}
      />

      {hasSearch && (
        <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2 }}>
          {articles.length > 0
            ? t('blog.resultCount', { count: articles.length })
            : t('blog.noResults')}
        </Typography>
      )}

      {isDeveloper && (
        <Alert
          severity="info"
          sx={{
            mb: 3,
            bgcolor: 'rgba(0,212,170,0.08)',
            color: '#94a3b8',
            border: '1px solid rgba(0,212,170,0.2)',
          }}
        >
          {t(
            'blog.developerHint',
            'Developer: add or edit articles in packages/frontend/src/data/blogArticles.ts, then deploy frontend. The list updates automatically from BLOG_ARTICLE_SLUGS.',
          )}
        </Alert>
      )}

      {articles.length === 0 ? (
        <Box
          sx={{
            py: 8,
            px: 3,
            textAlign: 'center',
            borderRadius: 3,
            border: '1px dashed rgba(255,255,255,0.12)',
            bgcolor: 'rgba(15,23,42,0.4)',
          }}
        >
          <Typography sx={{ color: '#64748b' }}>
            {hasSearch ? t('blog.noResults') : t('blog.emptyList', 'No articles yet.')}
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {articles.map((article) => {
            const theme = getBlogCardTheme(article.slug);
            const category = isZh ? theme.categoryZh : theme.categoryEn;

            return (
              <Grid size={{ xs: 12 }} key={article.slug}>
                <Card
                  component="a"
                  href={article.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  elevation={0}
                  sx={{
                    textDecoration: 'none',
                    ...getContentCardSx(theme),
                    '&:hover': {
                      ...getContentCardSx(theme)['&:hover'],
                      '& .blog-card-arrow': { color: theme.accent, opacity: 1 },
                    },
                  }}
                >
                  <Box sx={{ height: 4, background: theme.gradient }} />
                  <CardContent sx={{ p: 2.5, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1.25 }}>
                      <Chip label={category} size="small" sx={getThemedChipSx(theme)} />
                      <OpenInNewIcon
                        className="blog-card-arrow"
                        sx={{ fontSize: 18, color: '#64748b', opacity: 0.7, transition: 'color 0.2s, opacity 0.2s' }}
                      />
                    </Box>

                    <Typography
                      className="content-card-title"
                      sx={{
                        fontWeight: 700,
                        color: '#f1f5f9',
                        fontSize: { xs: 15, sm: 16 },
                        lineHeight: 1.45,
                        mb: 1,
                        transition: 'color 0.2s',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {article.title}
                    </Typography>

                    <Typography
                      sx={{
                        color: '#94a3b8',
                        fontSize: 13.5,
                        lineHeight: 1.65,
                        mb: 2,
                        flex: 1,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {article.subtitle}
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 'auto' }}>
                      <Chip
                        icon={<CalendarTodayIcon sx={{ fontSize: '14px !important', color: `${theme.accent} !important` }} />}
                        label={article.publishedAt}
                        size="small"
                        sx={{
                          height: 26,
                          fontSize: 11,
                          bgcolor: 'rgba(255,255,255,0.04)',
                          color: '#cbd5e1',
                          border: '1px solid rgba(255,255,255,0.08)',
                          '& .MuiChip-icon': { ml: 0.75 },
                        }}
                      />
                      <Chip
                        icon={<AccessTimeIcon sx={{ fontSize: '14px !important', color: `${theme.accent} !important` }} />}
                        label={`${article.readMinutes} ${isZh ? '分钟' : 'min'}`}
                        size="small"
                        sx={{
                          height: 26,
                          fontSize: 11,
                          bgcolor: 'rgba(255,255,255,0.04)',
                          color: '#cbd5e1',
                          border: '1px solid rgba(255,255,255,0.08)',
                          '& .MuiChip-icon': { ml: 0.75 },
                        }}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
