import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Chip, Button, Divider,
  CircularProgress, List, ListItem, ListItemIcon, ListItemText,
  IconButton, Snackbar, Alert, alpha,
  Avatar, Collapse, Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText, Tooltip,
} from '@mui/material';
import RichTextEditor from '../../components/playbooks/RichTextEditor';
import PlaybookPublishedAt from '../../components/playbooks/PlaybookPublishedAt';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ImageIcon from '@mui/icons-material/Image';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import BoltIcon from '@mui/icons-material/Bolt';
import SendIcon from '@mui/icons-material/Send';
import ReplyIcon from '@mui/icons-material/Reply';
import DeleteIcon from '@mui/icons-material/Delete';
import ChatIcon from '@mui/icons-material/Chat';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { useGetPlaybookByIdQuery, useGetMyPurchasesQuery, useToggleFavoriteMutation, useGetMyFavoritesQuery, useCreateCommentMutation, useGetCommentsQuery, useDeleteCommentMutation } from '../../store/playbookApi';
import { fmtCurrency } from '../../utils/format';
import { tokenStorage } from '../../store/authApi';
import { getContentLocale } from '../../utils/contentLocale';

const COMMENT_MAX_LENGTH = 5000;

function isCommentEmpty(markdown: string): boolean {
  const trimmed = markdown.trim();
  if (!trimmed) return true;
  return !trimmed.replace(/!\[[^\]]*]\([^)]+\)/g, '').replace(/\s+/g, '');
}

function countDescendantReplies(commentId: string, comments: Array<{ id: string; parentId?: string | null }>): number {
  const children = comments.filter((c) => c.parentId === commentId);
  return children.reduce((sum, child) => sum + 1 + countDescendantReplies(child.id, comments), 0);
}

const PRESET_TAG_KEYS = [
  'Momentum', 'Scalping', 'Swing', 'DayTrading', 'PositionTrading',
  'TrendFollowing', 'MeanReversion', 'Breakout', 'NewsTrading',
  'Arbitrage', 'Algorithmic', 'ValueInvesting',
  'Stocks', 'Futures', 'ETF', 'Indices', 'Bonds', 'Commodities',
  'Options', 'Crypto', 'Forex',
  'Technical', 'Fundamental', 'PriceAction', 'VolumeAnalysis',
  'SupportResistance', 'PatternRecognition',
];

/** Compute credit cost for downloading an attachment based on file extension */
function getAttachmentCreditCost(filename: string): number {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico']);
  if (IMAGE_EXTENSIONS.has(ext)) return 0;
  const DOC_EXTENSIONS = new Set(['pdf', 'docx', 'doc', 'xls', 'xlsx']);
  if (DOC_EXTENSIONS.has(ext)) return 100;
  const MT_EXTENSIONS = new Set(['mq4', 'ex4', 'mq5', 'ex5']);
  if (MT_EXTENSIONS.has(ext)) return 200;
  return 100; // default
}

export default function PlaybookDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const contentLocale = getContentLocale();
  const { data: playbook, isLoading, error, isFetching } = useGetPlaybookByIdQuery(
    { id: id!, locale: contentLocale },
    { skip: !id },
  );
  const { data: purchasesData } = useGetMyPurchasesQuery({ page: 1, limit: 1000 });

  // Comment state
  const [comment, setComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);  // comment ID being replied to
  const [deleteTarget, setDeleteTarget] = useState<{ commentId: string; replyCount: number } | null>(null);
  const [commentDeleteSuccess, setCommentDeleteSuccess] = useState(false);
  const [showOriginalPost, setShowOriginalPost] = useState(false);
  const [showOriginalComments, setShowOriginalComments] = useState<Record<string, boolean>>({});

  // Download error toast state
  const [downloadError, setDownloadError] = useState('');
  const [downloadingFilename, setDownloadingFilename] = useState<string | null>(null);
  const [pendingDownload, setPendingDownload] = useState<{
    attachment: { originalName: string; filename: string; path: string; size: number; mimetype: string };
    creditCost: number;
  } | null>(null);

  // Get current user tier
  const currentUser = tokenStorage.getUser();
  const userTier = currentUser?.tier || 'free';

  // Comment API (independent from rating)
  const [createComment] = useCreateCommentMutation();
  const [deleteComment, { isLoading: deletingComment }] = useDeleteCommentMutation();
  const { data: commentsData, refetch: refetchComments } = useGetCommentsQuery(
    { id: id!, page: 1, limit: 100, locale: contentLocale },
    { skip: !id },
  );

  // Favorite state
  const [toggleFavorite] = useToggleFavoriteMutation();
  const myFavoritesData = useGetMyFavoritesQuery({ page: 1, limit: 1000 });
  const isFavorited = myFavoritesData.data?.playbooks?.some((f: any) => f.id === id) ?? false;

  /* Tag display helper */
  const displayLabel = (tagKey: string): string => {
    if (PRESET_TAG_KEYS.includes(tagKey)) return t(`playbooks.tag${tagKey}`, tagKey);
    return tagKey;
  };

  /* Determine ownership & access */
  const currentUserId = currentUser?.id || currentUser?.userId;
  const pb = playbook?.data ?? playbook;

  const isOwner = !!pb && !!currentUserId && (
    pb.user?.id === currentUserId || pb.userId === currentUserId
  );

  // Post author ID for "作者" badge
  const postAuthorId = pb?.user?.id || pb?.userId;

  const isZh = i18n.language.startsWith('zh');
  const contentStr = typeof pb?.content === 'string' ? pb.content : '';

  useEffect(() => {
    setShowOriginalPost(false);
    setShowOriginalComments({});
  }, [i18n.language]);

  const showPostOriginal = showOriginalPost && pb?.isTranslated;
  const displayTitle = showPostOriginal && pb?.originalTitle ? pb.originalTitle : pb?.title;
  const displayDescription = showPostOriginal && pb?.originalDescription != null
    ? pb.originalDescription
    : pb?.description;
  const displayContent = showPostOriginal && pb?.originalContent ? pb.originalContent : contentStr;

  const sourceLocaleLabel = (locale?: string) => {
    if (!locale) return '';
    return locale.startsWith('zh') ? (isZh ? '中文' : 'Chinese') : (isZh ? '英文' : 'English');
  };

  const scrollToComments = useCallback(() => {
    window.setTimeout(() => {
      document.getElementById('playbook-comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const editor = document.getElementById('playbook-comment-editor');
      if (editor instanceof HTMLElement) {
        editor.focus();
      }
    }, 200);
  }, []);

  useEffect(() => {
    if (location.hash === '#comments' && !isLoading && pb) {
      scrollToComments();
    }
  }, [location.hash, isLoading, pb, scrollToComments]);

  const handleBack = () => {
    const historyIdx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof historyIdx === 'number' && historyIdx > 0) {
      navigate(-1);
      return;
    }
    navigate('/playbooks');
  };

  if (isLoading) {
    return <CircularProgress sx={{ display: 'block', mx: 'auto', my: 4 }} />;
  }

  // Handle insufficient credits (402)
  const isCreditError = (error as any)?.status === 402 || (error as any)?.error === 'Insufficient credits';
  if (isCreditError) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <LockIcon sx={{ fontSize: 56, color: '#E5A23C', mb: 1.5 }} />
        <Typography variant="h6" sx={{ mb: 0.5, color: '#f1f5f9' }}>
          {isZh ? '积分不足' : 'Insufficient Credits'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 420, mx: 'auto', px: 2 }}>
          {isZh ? '积分不足，无法下载该附件！请通过完成任务获取更多积分，或升级到专业版/高级版以免费下载所有附件。' : 'Insufficient credits to download this attachment! Complete tasks to earn more or upgrade to Pro/Premium for free downloads.'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', mt: 1 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={handleBack}>
            {t('common.back', 'Go Back')}
          </Button>
          <Button variant="contained" onClick={() => navigate('/rewards')} sx={{
            background: 'linear-gradient(135deg, #00d4aa, #00a085)',
          }}>
            {isZh ? '去赚积分' : 'Earn Credits'}
          </Button>
          <Button variant="outlined" onClick={() => navigate('/settings')} sx={{
            borderColor: '#E5A23C', color: '#E5A23C',
          }}>
            {isZh ? '升级订阅' : 'Upgrade Plan'}
          </Button>
        </Box>
      </Box>
    );
  }

  if (error || !pb) {
    return (
      <Box sx={{ py: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">{t('playbooks.notFound', 'Strategy not found')}</Typography>
        <Button startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ mt: 2 }}>
          {t('common.back', 'Go Back')}
        </Button>
      </Box>
    );
  }

  /* Submit comment (or reply) */
  const handleSubmitComment = async () => {
    const trimmed = comment.trim();
    if (isCommentEmpty(trimmed) || !id) return;
    if (trimmed.length > COMMENT_MAX_LENGTH) {
      alert(isZh ? `评论内容不能超过 ${COMMENT_MAX_LENGTH} 个字符` : `Comment must be under ${COMMENT_MAX_LENGTH} characters`);
      return;
    }
    setSubmittingComment(true);
    try {
      await createComment({ id, content: trimmed, parentId: replyTo ?? undefined }).unwrap();
      setComment('');
      setReplyTo(null);
      refetchComments();
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleReply = (commentId: string) => {
    setReplyTo(commentId);
    setComment('');
  };

  const handleDeleteComment = async () => {
    if (!deleteTarget || !id) return;
    try {
      await deleteComment({ id, commentId: deleteTarget.commentId }).unwrap();
      if (replyTo === deleteTarget.commentId) {
        setReplyTo(null);
        setComment('');
      }
      setDeleteTarget(null);
      setCommentDeleteSuccess(true);
      refetchComments();
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  const cancelReply = () => {
    setReplyTo(null);
    setComment('');
  };

  /* Toggle favorite */
  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleFavorite(id!).unwrap();
      myFavoritesData.refetch();
    } catch { /* ignore */ }
  };

  /* Download attachment */
  const handleDownloadAttachment = async (attachment: {
    originalName: string; filename: string; path: string; size: number; mimetype: string;
  }) => {
    try {
      setDownloadError('');
      setDownloadingFilename(attachment.filename);
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/v1/playbooks/${id}/attachments/${encodeURIComponent(attachment.filename)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 402 || data?.error?.includes('Insufficient') || data?.error?.includes('credits')) {
          setDownloadError(isZh ? '积分不足！请通过完成任务获取更多积分，或升级到专业版/高级版以免费下载附件。' : 'Insufficient credits! Complete tasks to earn more or upgrade to Pro/Premium for free downloads.');
          return;
        }
        throw new Error(data.error || 'Download failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setDownloadError(err.message || (isZh ? '下载失败，请重试' : 'Download failed, please try again'));
    } finally {
      setDownloadingFilename(null);
    }
  };

  const handleAttachmentClick = (attachment: {
    originalName: string; filename: string; path: string; size: number; mimetype: string;
  }) => {
    const creditCost = getAttachmentCreditCost(attachment.filename);
    const isImage = creditCost === 0;
    const isVip = userTier !== 'free';

    if (isOwner || isVip || isImage) {
      void handleDownloadAttachment(attachment);
      return;
    }

    setPendingDownload({ attachment, creditCost });
  };

  const handleConfirmDownload = async () => {
    if (!pendingDownload) return;
    const { attachment } = pendingDownload;
    setPendingDownload(null);
    await handleDownloadAttachment(attachment);
  };

  const attachments = (pb.attachments || []) as Array<{
    originalName: string; filename: string; path: string; size: number; mimetype: string;
  }>;

  /** Shared styles for markdown content box */
  const contentBoxSx = {
    p: { xs: 2, md: 2.5 },
    bgcolor: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 2,
    lineHeight: 1.85,
    color: '#e2e8f0',
    fontSize: '0.95rem',
    '& p': { color: '#e2e8f0', mb: 1.5 },
    '& h1, & h2, & h3, & h4': { color: '#f8fafc', fontWeight: 700, mt: 2, mb: 1 },
    '& strong': { color: '#f1f5f9', fontWeight: 700 },
    '& li': { color: '#e2e8f0', mb: 0.75 },
    '& ol, & ul': { pl: 2.5, my: 1 },
    '& img': { maxWidth: '100%', borderRadius: 1 },
    '& a': { color: '#33dfbb', textDecoration: 'underline' },
    '& pre': { bgcolor: 'rgba(0,0,0,0.25)', p: 1.5, borderRadius: 1, overflowX: 'auto', color: '#e2e8f0' },
    '& code': { bgcolor: 'rgba(0,0,0,0.2)', color: '#f1f5f9', px: 0.5, py: 0.15, borderRadius: 0.5, fontSize: '0.9em' },
  };

  const commentBodySx = {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 1.7,
    mb: 1,
    '& p': { color: '#cbd5e1', mb: 0.75, mt: 0 },
    '& img': { display: 'block', maxWidth: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 1, my: 0.75 },
    '& a': { color: '#33dfbb', textDecoration: 'underline' },
    '& strong': { color: '#f1f5f9' },
    '& em': { fontStyle: 'italic' },
  };

  const sectionTitleSx = { mb: 1, fontWeight: 600, color: '#f1f5f9' };

  return (
    <Box sx={{ py: 3, width: '100%', maxWidth: '100%' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ mb: 2 }}>
        {t('common.back', 'Back')}
      </Button>

      <Card sx={{
        width: '100%',
        maxWidth: '100%',
        bgcolor: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <CardContent sx={{ px: { xs: 2, sm: 3, md: 4 }, py: { xs: 2, md: 3 } }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            <Box sx={{ flex: 1, minWidth: 0, pr: { md: 2 } }}>
              {pb.tags?.[0] && (
                <Chip label={displayLabel(pb.tags[0])} size="small" sx={{ mb: 1 }} />
              )}
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#f8fafc', lineHeight: 1.35 }}>
                {displayTitle}
              </Typography>
              {pb.isTranslated && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75, flexWrap: 'wrap' }}>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    {t('playbooks.translatedFrom', { locale: sourceLocaleLabel(pb.sourceLocale) })}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => setShowOriginalPost((v) => !v)}
                    sx={{ minWidth: 'auto', p: 0, fontSize: 12, color: '#00d4aa', textTransform: 'none' }}
                  >
                    {showPostOriginal ? t('playbooks.showTranslation') : t('playbooks.showOriginal')}
                  </Button>
                </Box>
              )}
              {displayDescription && (
                <Typography variant="body1" sx={{ mt: 1.25, color: '#cbd5e1', lineHeight: 1.75, fontSize: '1.05rem' }}>
                  {displayDescription}
                </Typography>
              )}
            </Box>
            <Box sx={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
              {isOwner && (
                <Chip label={t('playbooks.myPost', 'My Post')} color="info" size="small" />
              )}
              <IconButton onClick={handleToggleFavorite} sx={{
                color: isFavorited ? '#f43f5e' : '#64748b',
                '&:hover': { color: '#f43f5e' },
              }}>
                {isFavorited
                  ? <FavoriteIcon sx={{ fontSize: 24 }} />
                  : <FavoriteBorderIcon sx={{ fontSize: 24 }} />}
              </IconButton>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                {isFavorited ? t('playbooks.unfavorite') : t('playbooks.favorite')}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Content Section */}
          <Typography variant="subtitle1" sx={sectionTitleSx}>
            <VisibilityOffIcon sx={{ verticalAlign: 'middle', mr: 0.5, fontSize: 18, color: '#00d4aa' }} />
            {t('playbooks.contentLabel', 'Post Content')}
          </Typography>
          <Box sx={contentBoxSx}>
            {isFetching && pb?.isTranslated === undefined ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#64748b' }}>
                <CircularProgress size={16} sx={{ color: '#00d4aa' }} />
                <Typography variant="body2">{t('playbooks.contentTranslating')}</Typography>
              </Box>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkBreaks]}>{displayContent}</ReactMarkdown>
            )}
          </Box>

          {/* Attachments with Credit Cost Display */}
          {attachments.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={sectionTitleSx}>
                <DownloadIcon sx={{ verticalAlign: 'middle', mr: 0.5, fontSize: 18, color: '#00d4aa' }} />
                {t('playbooks.attachments', 'Attachments')} ({attachments.length})
                {isZh ? ' — 点击下载' : ' — Click to download'}
              </Typography>
              <List dense sx={{ bgcolor: 'rgba(0,0,0,0.02)', borderRadius: 1 }}>
                {attachments.map((att, idx) => {
                  const creditCost = getAttachmentCreditCost(att.filename);
                  const isImage = creditCost === 0;
                  const isVip = userTier !== 'free';

                  return (
                    <ListItem
                      key={idx}
                      sx={{
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
                        transition: 'bgcolor 0.15s',
                      }}
                      secondaryAction={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {!isVip && !isImage && creditCost > 0 && (
                            <Chip
                              size="small"
                              label={`${creditCost}`}
                              sx={{
                                height: 20, minWidth: 32, fontSize: 11,
                                bgcolor: alpha('#E5A23C', 0.15), color: '#E5A23C',
                                fontWeight: 700, border: 'none',
                                '& .MuiChip-label': { px: 0.8 },
                              }}
                              icon={<BoltIcon sx={{ fontSize: 12, color: '#E5A23C !important' }} />}
                            />
                          )}
                          {isVip && !isImage && (
                            <Chip
                              size="small"
                              label={isZh ? 'VIP免费' : 'VIP FREE'}
                              sx={{
                                height: 20, fontSize: 10,
                                bgcolor: 'linear-gradient(135deg,#a855f7 0%,#ec4899 100%)',
                                color: '#fff', fontWeight: 700, border: 'none',
                              }}
                              icon={<WorkspacePremiumIcon sx={{ fontSize: 13, color: '#fff !important' }} />}
                            />
                          )}
                          <IconButton
                            edge="end"
                            disabled={downloadingFilename === att.filename}
                            onClick={() => handleAttachmentClick(att)}
                            title={isVip || isImage
                              ? (isZh ? '点击下载' : 'Click to download')
                              : (isZh ? `下载消耗 ${creditCost} 积分` : `Costs ${creditCost} credits`)}
                            sx={{
                              color: isVip || isImage ? '#00d4aa' : '#E5A23C',
                              '&:hover': { bgcolor: isVip || isImage ? 'rgba(0,212,170,0.08)' : 'rgba(229,162,60,0.08)' },
                            }}
                          >
                            {downloadingFilename === att.filename
                              ? <CircularProgress size={20} sx={{ color: 'inherit' }} />
                              : <DownloadIcon />}
                          </IconButton>
                        </Box>
                      }
                    >
                      <ListItemIcon>{isImage ? <ImageIcon sx={{ color: '#06b6d4' }} /> : <InsertDriveFileIcon />}</ListItemIcon>
                      <ListItemText
                        primary={att.originalName}
                        secondary={`${fmtCurrency(att.size / 1024 / 1024)} MB${!isVip && !isImage && creditCost > 0 ? `  ·  ${isZh ? `${creditCost} 积分` : `${creditCost} credits`}` : ''}`}
                        slotProps={{
                          primary: { sx: { color: '#f1f5f9', fontWeight: 500 } },
                          secondary: { sx: { color: '#94a3b8' } },
                        }}
                      />
                    </ListItem>
                  );
                })}
              </List>
            </>
          )}

          {/* Download confirmation dialog (free tier, non-image attachments) */}
          <Dialog open={!!pendingDownload} onClose={() => setPendingDownload(null)} maxWidth="xs" fullWidth>
            <DialogTitle>{t('playbooks.confirmDownloadTitle')}</DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ color: 'text.secondary', mb: 1 }}>
                {t('playbooks.confirmDownloadBody', {
                  filename: pendingDownload?.attachment.originalName ?? '',
                  credits: pendingDownload?.creditCost ?? 0,
                })}
              </DialogContentText>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                {t('playbooks.confirmDownloadNote')}
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setPendingDownload(null)}>{t('common.cancel')}</Button>
              <Button
                variant="contained"
                onClick={() => void handleConfirmDownload()}
                sx={{ bgcolor: '#E5A23C', '&:hover': { bgcolor: '#c8892f' } }}
              >
                {t('playbooks.confirmDownloadBtn', { credits: pendingDownload?.creditCost ?? 0 })}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Download Error Snackbar */}
          <Snackbar
            open={!!downloadError}
            autoHideDuration={5000}
            onClose={() => setDownloadError('')}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            sx={{ top: { xs: 70, md: 80 } }}
          >
            <Alert severity="warning" variant="filled" onClose={() => setDownloadError('')} sx={{ maxWidth: 500 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{downloadError}</Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                  <Button size="small" color="inherit" variant="outlined" onClick={() => navigate('/rewards')}>
                    {isZh ? '去赚积分' : 'Earn Credits'}
                  </Button>
                  <Button size="small" color="inherit" variant="outlined" onClick={() => navigate('/settings')}>
                    {isZh ? '升级订阅' : 'Upgrade'}
                  </Button>
                </Box>
              </Box>
            </Alert>
          </Snackbar>

          {/* Delete comment confirmation */}
          <Dialog open={!!deleteTarget} onClose={() => !deletingComment && setDeleteTarget(null)} maxWidth="xs" fullWidth>
            <DialogTitle>{t('playbooks.deleteCommentTitle', 'Delete Comment')}</DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ color: 'text.secondary' }}>
                {deleteTarget && deleteTarget.replyCount > 0
                  ? t('playbooks.deleteCommentWithRepliesBody', {
                      count: deleteTarget.replyCount,
                      defaultValue: `Are you sure you want to delete this comment and its ${deleteTarget.replyCount} reply/replies? This action cannot be undone.`,
                    })
                  : t('playbooks.deleteCommentBody', 'Are you sure you want to delete this comment? This action cannot be undone.')}
              </DialogContentText>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setDeleteTarget(null)} disabled={deletingComment}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                color="error"
                variant="contained"
                onClick={handleDeleteComment}
                disabled={deletingComment}
                startIcon={deletingComment ? <CircularProgress size={14} /> : undefined}
              >
                {t('playbooks.deleteComment', 'Delete')}
              </Button>
            </DialogActions>
          </Dialog>

          <Snackbar
            open={commentDeleteSuccess}
            autoHideDuration={3000}
            onClose={() => setCommentDeleteSuccess(false)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert severity="success" onClose={() => setCommentDeleteSuccess(false)}>
              {t('playbooks.commentDeleted', 'Comment deleted')}
            </Alert>
          </Snackbar>

          {/* Tags */}
          {(pb.tags && pb.tags.length > 1) && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('playbooks.tags')}</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {pb.tags.map((tag: string) => (
                  <Chip key={tag} label={displayLabel(tag)} size="small" variant="outlined" />
                ))}
              </Box>
            </>
          )}

          {/* ===== Comments Section ===== */}
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', color: 'text.secondary' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <VisibilityIcon sx={{ fontSize: 14 }} />
              <Typography variant="caption">
                {t('playbooks.purchaseCount', 'Views')}: {pb.viewCount ?? pb.purchaseCount ?? pb._count?.purchases ?? 0}
              </Typography>
            </Box>
            {pb.publishedAt && (
              <PlaybookPublishedAt publishedAt={pb.publishedAt} />
            )}
          </Box>

          {/* ===== Comments Section ===== */}
          <Divider sx={{ my: 2 }} />
          <Box id="playbook-comments">
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5, color: '#f1f5f9' }}>
              <ChatIcon sx={{ verticalAlign: 'middle', mr: 0.5, color: '#00d4aa' }} />
              {isZh ? '\u8BC4\u8BBA\u4EA4\u6D41' : 'Comments'}
              {commentsData?.data?.total ? ` (${commentsData.data.total})` : ''}
            </Typography>

            {/* Comment form (or reply form) */}
            <Card sx={{ mb: 2, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                {replyTo && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, px: 1, py: 0.5, bgcolor: 'rgba(0,212,170,0.08)', borderRadius: 1 }}>
                    <Typography variant="caption" sx={{ color: '#00d4aa', flex: 1 }}>
                      {isZh ? '\u6B63\u5728\u56DE\u590D\u67D0\u6761\u8BC4\u8BBA' : 'Replying to a comment'}
                    </Typography>
                    <Button size="small" onClick={cancelReply} sx={{ fontSize: 12, color: '#94a3b8', minWidth: 'auto', p: 0 }}>
                      {isZh ? '\u53D6\u6D88' : 'Cancel'}
                    </Button>
                  </Box>
                )}
                <RichTextEditor
                  value={comment}
                  onChange={setComment}
                  editorId="playbook-comment-editor"
                  minHeight={140}
                  showHint={false}
                  preferPlainTextPaste
                  placeholder={
                    replyTo
                      ? (isZh ? '输入您的回复…可粘贴截图' : 'Write your reply… paste screenshots here')
                      : (isZh ? '分享您对此帖子的看法…可粘贴截图' : 'Share your thoughts… paste screenshots here')
                  }
                />
                <Button
                  variant="contained"
                  startIcon={submittingComment ? <CircularProgress size={14} /> : <SendIcon />}
                  onClick={handleSubmitComment}
                  disabled={isCommentEmpty(comment) || submittingComment || comment.length > COMMENT_MAX_LENGTH}
                  size="small"
                  sx={{
                    mt: 1,
                    bgcolor: '#00d4aa', color: '#fff', fontWeight: 700,
                    '&:hover': { bgcolor: '#00b892' },
                  }}
                >
                  {replyTo
                    ? (isZh ? '\u53D1\u8868\u56DE\u590D' : 'Post Reply')
                    : (isZh ? '\u53D1\u8868\u8BC4\u8BBA' : 'Post Comment')
                  }
                </Button>
              </CardContent>
            </Card>

            {/* Comments list with nested replies */}
            {commentsData?.data?.comments && commentsData.data.comments.length > 0 ? (
              <Box sx={{ mt: 1 }}>
                {commentsData.data.comments.map((c: any) => {
                  const cAuthor = c.authorName;
                  const cAvatar = c.authorAvatar;
                  const isOwn = c.userId === currentUserId;
                  const isPostAuthor = !!postAuthorId && c.userId === postAuthorId;

                  // Separate top-level and reply comments
                  if (c.isReply) return null; // render replies inside parent

                  // Find replies to this comment
                  const replies = commentsData.data.comments.filter((r: any) => r.parentId === c.id);

                  return (
                    <Box key={c.id} sx={{ mb: 2 }}>
                      {/* Top-level comment */}
                      <Card sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
                            {cAvatar ? (
                              <Box component="img" src={cAvatar} alt={cAuthor} sx={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              <Avatar sx={{ width: 26, height: 26, bgcolor: 'rgba(0,212,170,0.12)', color: '#00d4aa', fontSize: 12 }}>{cAuthor[0]?.toUpperCase()}</Avatar>
                            )}
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: 13 }}>{cAuthor}</Typography>
                            {isPostAuthor && (
                              <Chip label={isZh ? '\u4F5C\u8005' : 'Author'} size="small" sx={{ height: 18, fontSize: 10, ml: 0.5, bgcolor: 'rgba(0,212,170,0.12)', color: '#00d4aa', fontWeight: 600 }} />
                            )}
                            {isOwn && !isPostAuthor && (
                              <Chip label={isZh ? '\u6211' : 'Me'} size="small" sx={{ height: 18, fontSize: 10, ml: 0.5 }} />
                            )}
                            <Typography variant="caption" sx={{ color: '#64748b', ml: 'auto' }}>{new Date(c.createdAt).toLocaleDateString()}</Typography>
                          </Box>
                          <Box sx={commentBodySx}>
                            <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                              {c.isTranslated && showOriginalComments[c.id] && c.originalContent
                                ? c.originalContent
                                : c.content}
                            </ReactMarkdown>
                          </Box>
                          {c.isTranslated && (
                            <Button
                              size="small"
                              onClick={() => setShowOriginalComments((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
                              sx={{ minWidth: 'auto', p: 0, mt: 0.5, fontSize: 11, color: '#64748b', textTransform: 'none' }}
                            >
                              {showOriginalComments[c.id] ? t('playbooks.showTranslation') : t('playbooks.showOriginal')}
                            </Button>
                          )}

                          {/* Reply / delete actions */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <IconButton size="small" onClick={() => handleReply(c.id)} sx={{
                              color: '#64748b', fontSize: 14, gap: 0.3,
                              '&:hover': { color: '#00d4aa' },
                            }}>
                              <ReplyIcon sx={{ fontSize: 14 }} />
                              <Typography component="span" variant="caption" sx={{ fontSize: 11 }}>
                                {replies.length > 0
                                  ? `${replies.length}${isZh ? '\u6761\u56DE\u590D' : ' replies'}`
                                  : (isZh ? '\u56DE\u590D' : 'Reply')}
                              </Typography>
                            </IconButton>
                            {isOwn && (
                              <Tooltip title={t('playbooks.deleteComment', 'Delete')}>
                                <IconButton
                                  size="small"
                                  onClick={() => setDeleteTarget({
                                    commentId: c.id,
                                    replyCount: countDescendantReplies(c.id, commentsData.data.comments),
                                  })}
                                  sx={{ color: '#64748b', '&:hover': { color: '#f87171' } }}
                                >
                                  <DeleteIcon sx={{ fontSize: 15 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>

                          {/* Nested replies */}
                          {replies.length > 0 && (
                            <Collapse in timeout="auto" unmountOnExit>
                              <Box sx={{ mt: 1, pl: 2, borderLeft: '2px solid rgba(0,212,170,0.15)' }}>
                                {replies.map((r: any) => {
                                  const rAuthor = r.authorName || 'Anonymous';
                                  const rAvatar = r.authorAvatar || '';
                                  const isRown = r.userId === currentUserId;
                                  const isRpostAuthor = !!postAuthorId && r.userId === postAuthorId;
                                  return (
                                    <Card key={r.id} sx={{ mb: 1, bgcolor: 'rgba(255,255,255,0.015)', border: 'none', boxShadow: 'none' }}>
                                      <CardContent sx={{ py: 1, '&:last-child': { pb: 1 }, ':last-of-type': { pb: 0 } }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.3 }}>
                                          {rAvatar ? (
                                            <Box component="img" src={rAvatar} alt={rAuthor} sx={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
                                          ) : (
                                            <Avatar sx={{ width: 20, height: 20, bgcolor: 'rgba(0,212,170,0.1)', color: '#00d4aa', fontSize: 10 }}>{rAuthor[0]?.toUpperCase()}</Avatar>
                                          )}
                                          <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 12, color: '#e2e8f0' }}>{rAuthor}</Typography>
                                          {isRpostAuthor && (
                                            <Chip label={isZh ? '\u4F5C\u8005' : 'Author'} size="small" sx={{ height: 16, fontSize: 9, bgcolor: 'rgba(0,212,170,0.12)', color: '#00d4aa', fontWeight: 600 }} />
                                          )}
                                          {isRown && !isRpostAuthor && (
                                            <Chip label={isZh ? '\u6211' : 'Me'} size="small" sx={{ height: 16, fontSize: 9 }} />
                                          )}
                                          <Typography variant="caption" sx={{ color: '#475569', ml: 'auto', fontSize: 10 }}>{new Date(r.createdAt).toLocaleDateString()}</Typography>
                                        </Box>
                                        <Box sx={{ ...commentBodySx, mb: 0, fontSize: 13, color: '#94a3b8' }}>
                                          <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                                            {r.isTranslated && showOriginalComments[r.id] && r.originalContent
                                              ? r.originalContent
                                              : r.content}
                                          </ReactMarkdown>
                                        </Box>
                                        {r.isTranslated && (
                                          <Button
                                            size="small"
                                            onClick={() => setShowOriginalComments((prev) => ({ ...prev, [r.id]: !prev[r.id] }))}
                                            sx={{ minWidth: 'auto', p: 0, mt: 0.25, fontSize: 10, color: '#64748b', textTransform: 'none' }}
                                          >
                                            {showOriginalComments[r.id] ? t('playbooks.showTranslation') : t('playbooks.showOriginal')}
                                          </Button>
                                        )}
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                          <IconButton size="small" onClick={() => handleReply(r.id)} sx={{
                                            color: '#475569', fontSize: 13, gap: 0.3, p: 0.3,
                                            '&:hover': { color: '#00d4aa' },
                                          }}>
                                            <ReplyIcon sx={{ fontSize: 12 }} />
                                            <Typography component="span" variant="caption" sx={{ fontSize: 10 }}>{isZh ? '\u56DE\u590D' : 'Reply'}</Typography>
                                          </IconButton>
                                          {isRown && (
                                            <Tooltip title={t('playbooks.deleteComment', 'Delete')}>
                                              <IconButton
                                                size="small"
                                                onClick={() => setDeleteTarget({
                                                  commentId: r.id,
                                                  replyCount: countDescendantReplies(r.id, commentsData.data.comments),
                                                })}
                                                sx={{ color: '#475569', p: 0.3, '&:hover': { color: '#f87171' } }}
                                              >
                                                <DeleteIcon sx={{ fontSize: 13 }} />
                                              </IconButton>
                                            </Tooltip>
                                          )}
                                        </Box>
                                      </CardContent>
                                    </Card>
                                  );
                                })}
                              </Box>
                            </Collapse>
                          )}
                        </CardContent>
                      </Card>
                    </Box>
                  );
                })}
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}>
                {isZh ? '\u6682\u65E0\u8BC4\u8BBA\uFF0C\u6210\u4E3A\u7B2C\u4E00\u4E2A\u8BC4\u8BBA\u7684\u7528\u6237\uFF01' : 'No comments yet. Be the first to comment!'}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
