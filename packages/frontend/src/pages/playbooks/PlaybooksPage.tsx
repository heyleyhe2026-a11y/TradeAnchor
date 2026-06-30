import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, CardActions,
  Button, TextField, InputAdornment, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, CircularProgress, List, ListItem,
  ListItemIcon, ListItemText, IconButton, Alert, Snackbar,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import ForumIcon from '@mui/icons-material/Forum';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import RichTextEditor from '../../components/playbooks/RichTextEditor';
import PlaybookPublishedAt from '../../components/playbooks/PlaybookPublishedAt';
import PlaybookCard from '../../components/playbooks/PlaybookCard';
import { useDisplayTimezone } from '../../hooks/useDisplayTimezone';
import { skipToken } from '@reduxjs/toolkit/query/react';
import {
  useGetMarketplaceQuery, useGetMyPurchasesQuery,
  useGetAuthorStatsQuery,
  useGetPlaybooksQuery, useDeletePlaybookMutation,
  useToggleFavoriteMutation, useGetMyFavoritesQuery,
  useToggleLikeMutation, useGetMyLikesQuery,
  useGetMyBrowsedQuery,
} from '../../store/playbookApi';
import { useGetCurrentSubscriptionQuery } from '../../store/subscriptionApi';
import { fmtDollar, fmtCurrency } from '../../utils/format';
import { tokenStorage } from '../../store/authApi';
import { appendLocaleToPath } from '../../utils/contentLocale';

const PRESET_TAG_KEYS = [
  // Strategy Types — 策略类型
  'Momentum', 'Scalping', 'Swing', 'DayTrading', 'PositionTrading',
  'TrendFollowing', 'MeanReversion', 'Breakout', 'NewsTrading',
  'Arbitrage', 'Algorithmic', 'ValueInvesting',
  // Asset Classes — 资产类别
  'Stocks', 'Futures', 'ETF', 'Indices', 'Bonds', 'Commodities',
  'Options', 'Crypto', 'Forex',
  // Analysis Methods — 分析方法
  'Technical', 'Fundamental', 'PriceAction', 'VolumeAnalysis',
  'SupportResistance', 'PatternRecognition',
];
const ALLOWED_FILE_TYPES = '.doc,.docx,.xls,.xlsx,.pdf,.ex4,.mp4,.ex5,.mq5,.png,.jpg,.jpeg';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MARKET_PAGE_SIZE = 9;

export default function PlaybooksPage() {
  const { t, i18n } = useTranslation();
  const { formatDateTime } = useDisplayTimezone();
  const isZh = i18n.language.startsWith('zh');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authorUserId = searchParams.get('author');
  const authorNameParam = searchParams.get('authorName');
  
  const [tab, setTab] = useState<'market' | 'my' | 'myBrowsed' | 'myPublished' | 'create'>('market');
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [sortBy, setSortBy] = useState<'viewCount' | 'likeCount' | 'publishedAt'>('viewCount');
  const [createForm, setCreateForm] = useState({ title: '', description: '', content: '', tags: [] as string[], tradingSymbols: [] as string[] });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [createError, setCreateError] = useState<string>('');

  /* Market pagination */
  const [marketPage, setMarketPage] = useState(1);

  /* My published management */
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null);

  /* Credit toast */
  const [creditToast, setCreditToast] = useState('');

  /* Preset tags with i18n labels */
  const presetTags = useMemo(() => PRESET_TAG_KEYS.map(key => ({
    key,
    label: t(`playbooks.tag${key}`),
  })), [t]);

  /* Tag display helper: show i18n label for known keys, raw value otherwise */
  const displayLabel = (tagKey: string): string => {
    const found = presetTags.find(p => p.key === tagKey);
    return found ? found.label : tagKey;
  };

  const marketData = useGetMarketplaceQuery({
    search, tag: selectedTag || undefined, page: marketPage, limit: MARKET_PAGE_SIZE, sortBy, sortOrder: 'desc',
    locale: i18n.language,
  });
  const myPurchases = useGetMyPurchasesQuery({});
  const authorStats = useGetAuthorStatsQuery(undefined);
  const { data: subscription } = useGetCurrentSubscriptionQuery();
  const currentUserId = tokenStorage.getUser()?.id || tokenStorage.getUser()?.userId;

  // Fetch user's own published playbooks
  const myPublishedData = useGetPlaybooksQuery({
    userId: currentUserId, status: 'published', sortBy: 'createdAt', sortOrder: 'desc', locale: i18n.language,
  });
  const [deletePlaybook] = useDeletePlaybookMutation();
  const [toggleFavorite] = useToggleFavoriteMutation();
  const [toggleLike] = useToggleLikeMutation();
  const myFavoritesData = useGetMyFavoritesQuery({ page: 1, limit: 100, locale: i18n.language });
  const myLikesData = useGetMyLikesQuery();
  const myBrowsedData = useGetMyBrowsedQuery({ page: 1, limit: 100, locale: i18n.language });

  /* Extract favorite IDs set for quick lookup */
  const favoriteIds = useMemo(() => {
    const ids = new Set<string>();
    myFavoritesData.data?.playbooks?.forEach((pb: any) => ids.add(pb.id));
    return ids;
  }, [myFavoritesData.data]);

  const likeIds = useMemo(() => {
    return new Set(myLikesData.data?.playbookIds ?? []);
  }, [myLikesData.data]);

  /* Toggle favorite handler */
  const handleToggleFavorite = async (playbookId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleFavorite(playbookId).unwrap();
      myFavoritesData.refetch();
      marketData.refetch();
    } catch { /* ignore */ }
  };

  const handleToggleLike = async (playbookId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleLike(playbookId).unwrap();
      myLikesData.refetch();
      marketData.refetch();
      myFavoritesData.refetch();
      myBrowsedData.refetch();
    } catch { /* ignore */ }
  };

  /* Fetch author's playbooks when viewing from leaderboard */
  const [authorPage, setAuthorPage] = useState(1);
  const authorPlaybooksData = useGetPlaybooksQuery(
    authorUserId ? { userId: authorUserId, status: 'published', page: authorPage, limit: MARKET_PAGE_SIZE, sortBy: 'createdAt', sortOrder: 'desc' } : skipToken
  );

  /* Extract author display name from playbook data */
  const authorDisplayName = useMemo(() => {
    if (authorNameParam) return decodeURIComponent(authorNameParam);
    if (!authorPlaybooksData.data?.playbooks?.length) return authorUserId;
    const firstPb = authorPlaybooksData.data.playbooks[0];
    return firstPb.user?.displayName || firstPb.user?.email?.split('@')[0] || authorUserId;
  }, [authorPlaybooksData.data?.playbooks, authorUserId, authorNameParam]);

  /* Reset pagination when filters change */
  useMemo(() => {
    setMarketPage(1);
  }, [search, selectedTag]);

  /* Collect all unique tags from marketplace data + preset tags */
  const allFilterTags = useMemo(() => {
    const tagSet = new Set(PRESET_TAG_KEYS.map(k => k));
    marketData.data?.playbooks?.forEach((pb: any) => {
      (pb.tags || []).forEach((tg: string) => tagSet.add(tg));
    });
    return Array.from(tagSet);
  }, [marketData.data]);

  /* View playbook detail in a new browser tab */
  const handleViewPlaybook = (pb: { id: string }) => {
    window.open(appendLocaleToPath(`/playbooks/${pb.id}`, i18n.language), '_blank', 'noopener,noreferrer');
  };

  const handleCommentPlaybook = (pb: { id: string }) => {
    window.open(appendLocaleToPath(`/playbooks/${pb.id}#comments`, i18n.language), '_blank', 'noopener,noreferrer');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const oversizedFiles = files.filter(f => f.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      alert(`${t('playbooks.fileSizeError', 'Some files exceed the 10MB limit. Please select smaller files.')}`);
      return;
    }
    setSelectedFiles(prev => [...prev, ...files]);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    setCreateError('');
    try {
      const formData = new FormData();
      formData.append('title', createForm.title);
      if (createForm.description) formData.append('description', createForm.description);
      formData.append('content', createForm.content);
      formData.append('tags', JSON.stringify(createForm.tags));
      selectedFiles.forEach(file => {
        formData.append('attachments', file);
      });

      const token = localStorage.getItem('accessToken');
      if (!token) { setCreateError(t('playbooks.notLoggedIn', 'Please log in first')); return; }

      const res = await fetch('/api/v1/playbooks', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setCreateError(errData.message || errData.error || `HTTP ${res.status}: ${res.statusText}`);
        return;
      }
      // Check for credit awards from task completion
      try {
        const json = await res.json();
        const credits = json.data?.creditsAwarded ?? json.creditsAwarded;
        if (credits && credits > 0) {
          setCreditToast(isZh ? `+${credits} 积分已到账！` : `+${credits} credits earned!`);
        }
      } catch { /* ignore parse error */ }
      marketData.refetch();
      myPurchases.refetch();
      authorStats.refetch();
      myPublishedData.refetch();
      setTab('market');
      setCreateForm({ title: '', description: '', content: '', tags: [], tradingSymbols: [] });
      setSelectedFiles([]);
    } catch (err: any) {
      setCreateError(err.message || t('playbooks.createFailed', 'Failed to create strategy. Please check your network connection.'));
    }
  };

  /* Delete playbook (only free ones allowed) */
  const handleConfirmDelete = async () => {
    if (!deleteDialogId) return;
    try {
      await deletePlaybook(deleteDialogId).unwrap();
      setDeleteDialogId(null);
      myPublishedData.refetch();
      authorStats.refetch();
      marketData.refetch();
    } catch {}
  };

  /* Pagination component */
  const Pagination = ({ total, pages, currentPage, onPageChange }: { total: number; pages: number; currentPage: number; onPageChange: (p: number) => void }) => {
    if (pages <= 1) return null;
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mt: 3 }}>
        <Button size="small" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} startIcon={<NavigateBeforeIcon />}>
          {t('playbooks.prevPage')}
        </Button>
        <Typography variant="body2" color="text.secondary">
          {currentPage} / {pages} ({total} {t('playbooks.totalItems')})
        </Typography>
        <Button size="small" disabled={currentPage >= pages} onClick={() => onPageChange(currentPage + 1)} endIcon={<NavigateNextIcon />}>
          {t('playbooks.nextPage')}
        </Button>
      </Box>
    );
  };

  return (
    <Box sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h4" sx={{fontWeight:700}}>
          <ForumIcon sx={{ mr: 1, verticalAlign: 'middle' }} />{t('playbooks.title')}
        </Typography>
        <Box sx={{ display: 'flex' }}>
          <Button variant={tab === 'market' ? 'contained' : 'outlined'} onClick={() => setTab('market')} sx={{ mr: 1 }}>{t('playbooks.communityPlaza', '社区广场')}</Button>
          <Button variant={tab === 'my' ? 'contained' : 'outlined'} onClick={() => setTab('my')} sx={{ mr: 1 }}>{t('playbooks.myLibrary', '我的收藏')}</Button>
          <Button variant={tab === 'myBrowsed' ? 'contained' : 'outlined'} onClick={() => setTab('myBrowsed')} sx={{ mr: 1 }}>{t('playbooks.myBrowsed', '我的浏览')}</Button>
          <Button variant={tab === 'myPublished' ? 'contained' : 'outlined'} onClick={() => setTab('myPublished')} sx={{ mr: 1 }}>{t('playbooks.myPublished')}</Button>
          <Button variant={tab === 'create' ? 'contained' : 'outlined'} startIcon={<AddIcon />} onClick={() => setTab('create')}>{t('playbooks.create', 'New Post')}</Button>
        </Box>
      </Box>

      {/* Author stats — hide when viewing another author's page */}
      {!authorUserId && (() => {
        const publishedCount = myPublishedData.data?.playbooks?.length ?? 0;
        const totalViews = (myPublishedData.data?.playbooks || []).reduce((sum: number, pb: any) => sum + (pb.viewCount ?? 0), 0);
        return (
          <Card sx={{ mb: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="body2" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                {t('playbooks.authorStats')} {publishedCount} | {t('playbooks.totalPurchases')}: {totalViews}
              </Typography>
            </CardContent>
          </Card>
        );
      })()}

      {/* ========== AUTHOR STRATEGIES VIEW (from leaderboard) ========== */}
      {authorUserId && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<NavigateBeforeIcon />}
                onClick={() => navigate('/playbooks')}
                sx={{ borderColor: '#00d4aa', color: '#00d4aa', '&:hover': { borderColor: '#00d4aa', bgcolor: 'rgba(0,212,170,0.08)' } }}
              >
                {t('playbooks.backToMarket')}
              </Button>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                <ForumIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                {t('playbooks.authorStrategies', { author: authorDisplayName })}
              </Typography>
            </Box>
          </Box>

          {authorPlaybooksData.isLoading && <CircularProgress sx={{ display: 'block', mx: 'auto', my: 4 }} />}
          
          {!authorPlaybooksData.isLoading && (!authorPlaybooksData.data?.playbooks || authorPlaybooksData.data.playbooks.length === 0) && (
            <Alert severity="info">{t('playbooks.noAuthorStrategies')}</Alert>
          )}

          {authorPlaybooksData.data?.playbooks && authorPlaybooksData.data.playbooks.length > 0 && (
            <>
              <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2 }}>
                {t('playbooks.totalStrategies', { count: authorPlaybooksData.data.total || authorPlaybooksData.data.playbooks.length })}
              </Typography>

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {authorPlaybooksData.data.playbooks.map((pb: any) => (
                  <PlaybookCard
                    key={pb.id}
                    playbook={pb}
                    displayLabel={displayLabel}
                    onView={() => handleViewPlaybook(pb)}
                    viewLabel={t('playbooks.viewDetails')}
                    isFavorite={favoriteIds.has(pb.id)}
                    onToggleFavorite={(e) => handleToggleFavorite(pb.id, e)}
                    isLiked={likeIds.has(pb.id)}
                    onLikeClick={(e) => handleToggleLike(pb.id, e)}
                    onCommentClick={() => handleCommentPlaybook(pb)}
                  />
                ))}
              </Box>

              {/* Pagination for author strategies */}
              {(authorPlaybooksData.data.pages || 0) > 1 && (
                <Pagination
                  total={authorPlaybooksData.data.total || 0}
                  pages={authorPlaybooksData.data.pages || 1}
                  currentPage={authorPage}
                  onPageChange={(p) => {
                    setAuthorPage(p);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              )}
            </>
          )}
        </>
      )}

      {/* ========== MARKET TAB (with pagination) ========== */}
      {tab === 'market' && !authorUserId && (
        <>
          <TextField fullWidth placeholder={t('playbooks.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} sx={{ mb: 2 }}
            slotProps={{ input: { startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) } }}
          />
          <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip label={t('playbooks.all')} variant={!selectedTag ? 'filled' : 'outlined'} size="small" onClick={() => setSelectedTag('')} />
            {allFilterTags.map(tg => (
              <Chip key={tg} label={displayLabel(tg)} variant={selectedTag === tg ? 'filled' : 'outlined'} size="small" onClick={() => setSelectedTag(tg)} />
            ))}
          </Box>

          {/* Sort options */}
          <Box sx={{ mb: 1.5, display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: '#64748b', mr: 0.5 }}>{isZh ? '\u6392\u5E8F' : 'Sort'}:</Typography>
            {([
              { key: 'viewCount', label: isZh ? '\u9605\u8BFB\u91CF' : 'Views' },
              { key: 'likeCount', label: isZh ? '\u70B9\u8D5E\u6570' : 'Likes' },
              { key: 'publishedAt', label: isZh ? '\u65F6\u95F4' : 'Latest' },
            ] as Array<{ key: 'viewCount' | 'likeCount' | 'publishedAt'; label: string }>).map(opt => (
              <Chip
                key={opt.key}
                label={opt.label}
                size="small"
                variant={sortBy === opt.key ? 'filled' : 'outlined'}
                color={sortBy === opt.key ? 'primary' : 'default'}
                onClick={() => setSortBy(opt.key)}
                sx={{ fontSize: 11 }}
              />
            ))}
          </Box>

          {marketData.data && (
            <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2 }}>
              {(search || selectedTag)
                ? t('playbooks.filteredCount', { count: marketData.data.total })
                : t('playbooks.totalCount', { count: marketData.data.total })
              }
            </Typography>
          )}

          {marketData.isLoading && <CircularProgress sx={{ display: 'block', mx: 'auto', my: 4 }} />}
          {marketData.data && (
            <>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {marketData.data.playbooks.map((pb: any) => {
                  const authorName = pb.user?.displayName || pb.user?.email?.split('@')[0] || 'Anonymous';
                  return (
                    <PlaybookCard
                      key={pb.id}
                      playbook={pb}
                      displayLabel={displayLabel}
                      onView={() => handleViewPlaybook(pb)}
                      viewLabel={t('playbooks.viewDetails')}
                      showAuthor
                      onAuthorClick={() => {
                        const uid = pb.user?.id || pb.userId;
                        if (uid) navigate(`/playbooks?author=${uid}&authorName=${encodeURIComponent(authorName)}`);
                      }}
                      isFavorite={favoriteIds.has(pb.id)}
                      onToggleFavorite={(e) => handleToggleFavorite(pb.id, e)}
                      isLiked={likeIds.has(pb.id)}
                      onLikeClick={(e) => handleToggleLike(pb.id, e)}
                      onCommentClick={() => handleCommentPlaybook(pb)}
                    />
                  );
                })}
              </Box>
              <Pagination
                total={marketData.data.total}
                pages={marketData.data.pages}
                currentPage={marketData.data.currentPage}
                onPageChange={(p) => { setMarketPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              />
            </>
          )}
        </>
      )}

      {/* ========== MY FAVORITES TAB ========== */}
      {tab === 'my' && (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>{t('playbooks.myLibrary', '我的收藏')}</Typography>
          {myFavoritesData.isLoading && <CircularProgress sx={{ display: 'block', mx: 'auto', my: 4 }} />}
          {myFavoritesData.data && (!myFavoritesData.data.playbooks || myFavoritesData.data.playbooks.length === 0) && (
            <Alert severity="info">{t('playbooks.myFavoritesEmpty')}</Alert>
          )}
          {myFavoritesData.data?.playbooks && myFavoritesData.data.playbooks.length > 0 && (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {myFavoritesData.data.playbooks.map((pb: any) => {
                const authorName = pb.user?.displayName || pb.user?.email?.split('@')[0] || 'Anonymous';
                return (
                  <PlaybookCard
                    key={pb.id}
                    playbook={pb}
                    displayLabel={displayLabel}
                    onView={() => handleViewPlaybook(pb)}
                    viewLabel={t('playbooks.open')}
                    showAuthor
                    onAuthorClick={() => {
                      const uid = pb.user?.id || pb.userId;
                      if (uid) navigate(`/playbooks?author=${uid}&authorName=${encodeURIComponent(authorName)}`);
                    }}
                    isFavorite
                    onToggleFavorite={(e) => handleToggleFavorite(pb.id, e)}
                    isLiked={likeIds.has(pb.id)}
                    onLikeClick={(e) => handleToggleLike(pb.id, e)}
                    onCommentClick={() => handleCommentPlaybook(pb)}
                  />
                );
              })}
            </Box>
          )}
        </>
      )}

      {/* ========== MY BROWSED TAB ========== */}
      {tab === 'myBrowsed' && (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>{t('playbooks.myBrowsed', 'My Browsed')}</Typography>
          {myBrowsedData.isLoading && <CircularProgress sx={{ display: 'block', mx: 'auto', my: 4 }} />}
          {myBrowsedData.data && (!myBrowsedData.data.views || myBrowsedData.data.views.length === 0) && (
            <Alert severity="info">{isZh ? '您还没有浏览过任何帖子。' : 'You haven\'t browsed any posts yet.'}</Alert>
          )}
          {myBrowsedData.data?.views && myBrowsedData.data.views.length > 0 && (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {myBrowsedData.data.views.map((v: any) => {
                const pb = v.playbook;
                if (!pb) return null;
                const authorName = pb.user?.displayName || pb.user?.email?.split('@')[0] || 'Anonymous';
                return (
                  <PlaybookCard
                    key={pb.id}
                    playbook={pb}
                    displayLabel={displayLabel}
                    onView={() => handleViewPlaybook(pb)}
                    viewLabel={t('playbooks.open')}
                    showAuthor
                    onAuthorClick={() => {
                      const uid = pb.user?.id || pb.userId;
                      if (uid) navigate(`/playbooks?author=${uid}&authorName=${encodeURIComponent(authorName)}`);
                    }}
                    viewedAt={v.viewedAt}
                    viewedAtLabel={t('playbooks.viewedAt', 'Viewed')}
                    formatDateTime={formatDateTime}
                    isLiked={likeIds.has(pb.id)}
                    onLikeClick={(e) => handleToggleLike(pb.id, e)}
                    onCommentClick={() => handleCommentPlaybook(pb)}
                  />
                );
              })}
            </Box>
          )}
        </>
      )}

      {/* ========== MY PUBLISHED TAB (manage own strategies) ========== */}
      {tab === 'myPublished' && (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>{t('playbooks.myPublished')}</Typography>

          {myPublishedData.isLoading && <CircularProgress sx={{ display: 'block', mx: 'auto', my: 4 }} />}

          {!myPublishedData.isLoading && (!myPublishedData.data?.playbooks || myPublishedData.data.playbooks.length === 0) && (
            <Alert severity="info">{t('playbooks.noPublishedStrategies')}</Alert>
          )}

          {myPublishedData.data?.playbooks?.map((pb: any) => {
            return (
              <Card key={pb.id} sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{pb.title}</Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        {pb.description || pb.content?.slice(0, 120)}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <Typography variant="caption" color="text.secondary">
                          {t('playbooks.tagLabel')}{(pb.tags || []).map(displayLabel).join(', ') || '-'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('playbooks.purchaseCount')}: {pb.viewCount ?? pb._count?.postViews ?? 0}
                        </Typography>
                        <PlaybookPublishedAt publishedAt={pb.publishedAt} />
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
                <CardActions sx={{ justifyContent: 'flex-end', gap: 1 }}>
                  <Button size="small" onClick={() => handleViewPlaybook(pb)}>
                    {t('playbooks.viewDetails')}
                  </Button>
                  <Button size="small" color="error" variant="outlined" startIcon={<DeleteIcon />}
                    onClick={() => setDeleteDialogId(pb.id)}
                  >
                    {t('playbooks.deleteStrategy')}
                  </Button>
                </CardActions>
              </Card>
            );
          })}
        </>
      )}

      {/* ========== CREATE TAB ========== */}
      {tab === 'create' && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>{t('playbooks.createPlaybook')}</Typography>
            {createError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setCreateError('')}>{createError}</Alert>}

            <TextField fullWidth label={t('playbooks.strategyTitle')} value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} sx={{ mb: 2 }} />
            <TextField fullWidth label={t('playbooks.description')} multiline rows={2} value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} sx={{ mb: 2 }} />
            {/* Content field — WYSIWYG with inline image paste */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.75 }}>{t('playbooks.content')}</Typography>
              <RichTextEditor
                value={createForm.content}
                onChange={(content) => setCreateForm((prev) => ({ ...prev, content }))}
                placeholder={t('playbooks.contentRichPlaceholder', 'Write your strategy logic, screenshots, and notes here…')}
              />
            </Box>

            <Typography variant="subtitle2">{t('playbooks.tags')}</Typography>
            <Box sx={{ mb: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {presetTags.map(({ key, label }) => (
                <Chip key={key} label={label} variant={createForm.tags.includes(key) ? 'filled' : 'outlined'} size="small"
                  onClick={() => setCreateForm(prev => ({
                    ...prev, tags: prev.tags.includes(key) ? prev.tags.filter(x => x !== key) : [...prev.tags, key],
                  }))} />
              ))}
            </Box>

            {/* File Upload */}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('playbooks.attachments', 'Attachments (max 10MB each)')}</Typography>
            <Alert severity="info" sx={{ mb: 1.5 }}>
              {t('playbooks.allowedFormats', 'Supported formats: .doc, .docx, .xls, .xlsx, .pdf, .ex4, .mp4, .ex5, .mq5, .png, .jpg')}
            </Alert>
            <Button
              variant="outlined"
              component="label"
              startIcon={<UploadFileIcon />}
              sx={{ mb: 1 }}
            >
              {t('playbooks.selectFiles', 'Select Files')}
              <input type="file" hidden multiple accept={ALLOWED_FILE_TYPES} onChange={handleFileSelect} />
            </Button>
            {selectedFiles.length > 0 && (
              <List dense sx={{ bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 1, mb: 2 }}>
                {selectedFiles.map((f, i) => (
                  <ListItem key={i} secondaryAction={
                    <IconButton edge="end" onClick={() => removeFile(i)}><DeleteIcon /></IconButton>
                  }>
                    <ListItemIcon><InsertDriveFileIcon /></ListItemIcon>
                    <ListItemText
                      primary={f.name}
                      secondary={`${fmtCurrency(f.size / 1024 / 1024)} MB`}
                    />
                  </ListItem>
                ))}
              </List>
            )}

            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Button variant="contained" onClick={handleCreate}>{t('playbooks.publishDraft')}</Button>
              <Button variant="outlined" onClick={() => setTab('market')}>{t('common.cancel')}</Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Delete free strategy confirmation dialog */}
      <Dialog open={!!deleteDialogId} onClose={() => setDeleteDialogId(null)}>
        <DialogTitle sx={{ color: 'error.main' }}>{t('playbooks.deleteConfirmTitle')}</DialogTitle>
        <DialogContent>
          <Typography>{t('playbooks.deleteConfirmBody')}</Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            {t('playbooks.deleteWarning')}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogId(null)}>{t('common.cancel')}</Button>
          <Button variant="contained" color="error" onClick={handleConfirmDelete}>{t('playbooks.confirmDelete')}</Button>
        </DialogActions>
      </Dialog>

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


