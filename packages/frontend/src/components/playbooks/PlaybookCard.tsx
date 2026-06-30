import {
  Box, Typography, Card, CardContent, CardActions,
  Button, Chip, IconButton, Avatar,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ForumIcon from '@mui/icons-material/Forum';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import PlaybookPublishedAt from './PlaybookPublishedAt';
import {
  getContentCardSx,
  getPlaybookCardTheme,
  getThemedChipSx,
} from '../../utils/contentCardTheme';

export interface PlaybookCardData {
  id: string;
  title: string;
  description?: string | null;
  content?: string | null;
  tags?: string[];
  viewCount?: number;
  purchaseCount?: number;
  commentCount?: number;
  likeCount?: number;
  publishedAt?: string | null;
  user?: {
    id?: string;
    displayName?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  };
  userId?: string;
}

interface PlaybookCardProps {
  playbook: PlaybookCardData;
  displayLabel: (tag: string) => string;
  onView: () => void;
  viewLabel: string;
  width?: object | string;
  showAuthor?: boolean;
  onAuthorClick?: () => void;
  viewedAt?: string;
  viewedAtLabel?: string;
  formatDateTime?: (value: string) => string;
  isFavorite?: boolean;
  onToggleFavorite?: (e: React.MouseEvent) => void;
  isLiked?: boolean;
  onLikeClick?: (e: React.MouseEvent) => void;
  onCommentClick?: (e: React.MouseEvent) => void;
}

export default function PlaybookCard({
  playbook,
  displayLabel,
  onView,
  viewLabel,
  width = { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.333% - 12px)' },
  showAuthor = false,
  onAuthorClick,
  viewedAt,
  viewedAtLabel,
  formatDateTime,
  isFavorite,
  onToggleFavorite,
  isLiked,
  onLikeClick,
  onCommentClick,
}: PlaybookCardProps) {
  const theme = getPlaybookCardTheme(playbook);
  const authorName = playbook.user?.displayName || playbook.user?.email?.split('@')[0] || 'Anonymous';
  const authorAvatar = playbook.user?.avatarUrl || '';
  const summary = playbook.description || playbook.content?.slice(0, 80) || '';

  const commentStat = (
    <Box
      component="span"
      onClick={(e) => {
        if (!onCommentClick) return;
        e.stopPropagation();
        onCommentClick(e);
      }}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.35,
        cursor: onCommentClick ? 'pointer' : 'default',
        borderRadius: 1,
        px: 0.25,
        transition: 'color 0.15s',
        ...(onCommentClick
          ? {
              '&:hover .comment-stat-icon, &:hover .comment-stat-count': { color: theme.accent },
            }
          : {}),
      }}
    >
      <ForumIcon className="comment-stat-icon" sx={{ fontSize: 13, color: '#64748b', transition: 'color 0.15s' }} />
      <Typography className="comment-stat-count" variant="caption" sx={{ color: '#94a3b8', fontSize: 11, transition: 'color 0.15s' }}>
        {playbook.commentCount ?? 0}
      </Typography>
    </Box>
  );

  const likeStat = (
    <Box
      component="span"
      onClick={(e) => {
        if (!onLikeClick) return;
        e.stopPropagation();
        onLikeClick(e);
      }}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.35,
        cursor: onLikeClick ? 'pointer' : 'default',
        borderRadius: 1,
        px: 0.25,
        transition: 'color 0.15s',
        ...(onLikeClick
          ? {
              '&:hover .like-stat-icon, &:hover .like-stat-count': { color: theme.accent },
            }
          : {}),
      }}
    >
      {isLiked ? (
        <ThumbUpIcon className="like-stat-icon" sx={{ fontSize: 13, color: theme.accent, transition: 'color 0.15s' }} />
      ) : (
        <ThumbUpOutlinedIcon className="like-stat-icon" sx={{ fontSize: 13, color: '#64748b', transition: 'color 0.15s' }} />
      )}
      <Typography className="like-stat-count" variant="caption" sx={{ color: isLiked ? theme.accent : '#94a3b8', fontSize: 11, transition: 'color 0.15s' }}>
        {playbook.likeCount ?? 0}
      </Typography>
    </Box>
  );

  const statsRow = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {likeStat}
      {commentStat}
    </Box>
  );

  return (
    <Card
      elevation={0}
      sx={{
        width,
        ...getContentCardSx(theme),
      }}
    >
      <Box sx={{ height: 4, background: theme.gradient }} />
      <CardContent sx={{ flexGrow: 1, p: 2.5 }}>
        {(playbook.tags || []).length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.25 }}>
            {(playbook.tags || []).map((tg) => (
              <Chip key={tg} label={displayLabel(tg)} size="small" sx={getThemedChipSx(theme)} />
            ))}
          </Box>
        )}
        <Typography
          className="content-card-title"
          noWrap
          sx={{
            fontWeight: 700,
            color: '#f1f5f9',
            fontSize: { xs: 15, sm: 16 },
            lineHeight: 1.45,
            mb: 1,
            transition: 'color 0.2s',
          }}
        >
          {playbook.title}
        </Typography>
        <Typography
          sx={{
            color: '#94a3b8',
            fontSize: 13.5,
            lineHeight: 1.65,
            height: 44,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {summary}
        </Typography>
        <Box sx={{ mt: 1.25, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
          {viewedAt && viewedAtLabel && formatDateTime ? (
            <>
              <PlaybookPublishedAt publishedAt={playbook.publishedAt} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 11 }}>
                  {viewedAtLabel}: {formatDateTime(viewedAt)}
                </Typography>
                {statsRow}
              </Box>
            </>
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <VisibilityIcon sx={{ fontSize: 14, color: theme.accent, opacity: 0.85 }} />
                <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 11 }}>
                  {playbook.viewCount ?? playbook.purchaseCount ?? 0}
                </Typography>
                <Box component="span" sx={{ ml: 0.5 }}>{statsRow}</Box>
              </Box>
              <PlaybookPublishedAt publishedAt={playbook.publishedAt} sx={{ display: 'block' }} />
            </>
          )}
        </Box>
        {showAuthor && (
          <Box
            sx={{
              mt: 0.8,
              display: 'flex',
              alignItems: 'center',
              gap: 0.7,
              cursor: onAuthorClick ? 'pointer' : 'default',
              '&:hover': onAuthorClick
                ? {
                    '& .MuiAvatar-root, & img': { transform: 'scale(1.1)' },
                    '& .MuiTypography-caption': { color: theme.accent },
                  }
                : undefined,
            }}
            onClick={onAuthorClick}
          >
            {authorAvatar ? (
              <Box
                component="img"
                src={authorAvatar}
                alt={authorName}
                sx={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover', transition: 'transform 0.15s' }}
              />
            ) : (
              <Avatar
                sx={{
                  width: 18,
                  height: 18,
                  bgcolor: theme.accentSoft,
                  color: theme.accent,
                  fontSize: 10,
                  transition: 'transform 0.15s',
                }}
              >
                {authorName[0]?.toUpperCase()}
              </Avatar>
            )}
            <Typography variant="caption" sx={{ color: '#64748b', fontSize: 11, transition: 'color 0.15s' }}>
              {authorName}
            </Typography>
          </Box>
        )}
      </CardContent>
      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2, pt: 0 }}>
        <Button
          size="small"
          onClick={onView}
          sx={{
            color: theme.accent,
            fontWeight: 600,
            '&:hover': { bgcolor: theme.accentSoft },
          }}
        >
          {viewLabel}
        </Button>
        {onToggleFavorite !== undefined && (
          <IconButton
            size="small"
            onClick={onToggleFavorite}
            sx={{
              color: isFavorite ? '#f43f5e' : '#64748b',
              '&:hover': { color: '#f43f5e' },
            }}
          >
            {isFavorite ? <FavoriteIcon sx={{ fontSize: 18 }} /> : <FavoriteBorderIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        )}
      </CardActions>
    </Card>
  );
}
