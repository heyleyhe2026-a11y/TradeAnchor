import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Card, CardContent, Button, TextField,
  IconButton, Chip, Skeleton, Snackbar,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArticleIcon from '@mui/icons-material/Article';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import RichTextEditor from '../../components/playbooks/RichTextEditor';
import { useGetDiariesQuery, useCreateDiaryMutation, useUpdateDiaryMutation, useDeleteDiaryMutation } from '../../store/diaryApi';

type FilterType = 'all' | 'today' | 'week' | 'month';

/** Strip markdown image syntax ![alt](url) from text to get clean preview */
function stripMarkdownImages(text: string): string {
  return text.replace(/!\[.*?\]\(.*?\)/g, '').trim();
}

/** Extract first image URL from markdown content */
function extractFirstImage(content: string): string | null {
  const match = content.match(/!\[.*?\]\((.*?)\)/);
  return match ? match[1] : null;
}

export default function DiaryPage() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const { data: diaryData, isLoading } = useGetDiariesQuery();
  const [create] = useCreateDiaryMutation();
  const [update] = useUpdateDiaryMutation();
  const [remove] = useDeleteDiaryMutation();
  const entries = diaryData?.entries || [];

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [delId, setDelId] = useState<string | null>(null);
  const [creditToast, setCreditToast] = useState('');

  // --- Detail view ---
  const [viewEntry, setViewEntry] = useState<any>(null);

  // --- Filter ---
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredEntries = useMemo(() => {
    const now = new Date();
    return entries.filter((e: any) => {
      const d = new Date(e.createdAt);
      if (filter === 'today') {
        return d.toDateString() === now.toDateString();
      }
      if (filter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 86400000);
        return d >= weekAgo;
      }
      if (filter === 'month') {
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        return d >= monthAgo;
      }
      return true;
    });
  }, [entries, filter]);

  // Stats
  const todayCount = useMemo(() =>
    entries.filter((e: any) => new Date(e.createdAt).toDateString() === new Date().toDateString()).length,
    [entries]);
  const weekCount = useMemo(() =>
    entries.filter((e: any) => new Date(e.createdAt) > new Date(Date.now() - 7 * 86400000)).length,
    [entries]);
  const monthCount = useMemo(() =>
    entries.filter((e: any) => new Date(e.createdAt) > new Date(Date.now() - 30 * 86400000)).length,
    [entries]);

  const openNew = () => { setEditId(null); setTitle(''); setContent(''); setOpen(true); };
  const openEdit = (e: any) => { setEditId(e.id); setTitle(e.title); setContent(e.content); setOpen(true); };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;
    if (editId) { await update({ id: editId, data: { title: title.trim(), content: content.trim() } }).unwrap(); }
    else {
      const result = await create({ title: title.trim(), content: content.trim() }).unwrap();
      if (result.creditsAwarded && result.creditsAwarded > 0) {
        setCreditToast(isZh ? `+${result.creditsAwarded} 积分已到账！` : `+${result.creditsAwarded} credits earned!`);
      }
    }
    setOpen(false);
  };

  return (
    <Box>
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4"><ArticleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />{t('diary.title')}</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>{t('diary.newEntry')}</Button>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {/* Left: Diary list */}
          <Box sx={{ flex: { xs: 1, md: 2 }, minWidth: 0 }}>
            <Card>
              <CardContent>
                {/* Filter buttons */}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2, alignItems: 'center' }}>
                  {([
                    ['all', isZh ? '全部' : 'All', entries.length],
                    ['today', isZh ? '今日' : 'Today', todayCount],
                    ['week', isZh ? '本周' : 'This Week', weekCount],
                    ['month', isZh ? '本月' : 'This Month', monthCount],
                  ] as [FilterType, string, number][]).map(([key, label, count]) => (
                    <Chip
                      key={key}
                      label={`${label} (${count})`}
                      color={filter === key ? 'primary' : 'default'}
                      variant={filter === key ? 'filled' : 'outlined'}
                      onClick={() => setFilter(key)}
                      sx={{ cursor: 'pointer' }}
                      clickable
                    />
                  ))}
                </Box>

                {isLoading ? (
                  <Box>
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} height={120} sx={{ mb: 1.5 }} variant="rounded" />
                    ))}
                  </Box>
                ) : !filteredEntries.length ? (
                  <Typography color="textSecondary" sx={{ py: 6, textAlign: 'center' }}>
                    {t('diary.noEntries')}
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {filteredEntries.map((e: any) => {
                      const firstImg = extractFirstImage(e.content);
                      const cleanText = stripMarkdownImages(e.content).slice(0, 150);
                      return (
                        <Card
                          key={e.id}
                          onClick={() => setViewEntry(e)}
                          sx={{
                            cursor: 'pointer',
                            transition: 'transform .15s, box-shadow .15s',
                            '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 },
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}
                        >
                          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                              {firstImg && (
                                <Box
                                  sx={{
                                    width: 100,
                                    height: 80,
                                    flexShrink: 0,
                                    borderRadius: 1,
                                    overflow: 'hidden',
                                    bgcolor: 'rgba(255,255,255,0.05)',
                                  }}
                                >
                                  <img
                                    src={firstImg}
                                    alt=""
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={(ev) => { (ev.target as HTMLStyleElement).style.display = 'none'; }}
                                  />
                                </Box>
                              )}
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <Typography variant="subtitle1" sx={{ maxWidth: '70%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                                    {e.title}
                                  </Typography>
                                  <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }} onClick={(ev) => ev.stopPropagation()}>
                                    <IconButton size="small" onClick={() => openEdit(e)} title={isZh ? '编辑' : 'Edit'}>
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton size="small" color="error" onClick={() => setDelId(e.id)} title={isZh ? '删除' : 'Delete'}>
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Box>
                                </Box>
                                <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                                  {new Date(e.createdAt).toLocaleString()}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  color="textSecondary"
                                  sx={{ mt: 0.8, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                                >
                                  {cleanText || (isZh ? '[包含图片]' : '[Contains images]')}
                                </Typography>
                              </Box>
                            </Box>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>

          <Box sx={{ flex: { xs: 1, md: 0.8 }, minWidth: 250 }}>
            <Card><CardContent>
              <Typography variant="h6" gutterBottom>{t('diary.summary')}</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                <Chip label={`${entries.length} ${t('diary.total')}`} color="primary" />
                <Chip label={`${todayCount} ${isZh ? '今日' : 'Today'}`} />
                <Chip label={`${weekCount} ${t('diary.thisWeek')}`} />
                <Chip label={`${monthCount} ${isZh ? '本月' : 'Month'}`} color="secondary" variant="outlined" />
              </Box>
              <Typography variant="caption" color="textSecondary" sx={{ mt: 2, display: 'block' }}>
                {t('diary.hint')}
              </Typography>
            </CardContent></Card>
          </Box>
        </Box>

        <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>{editId ? t('diary.editEntry') : t('diary.newEntryTitle')}</DialogTitle>
          <DialogContent dividers>
            <TextField
              fullWidth margin="normal" label={t('diary.entryTitle')}
              value={title} onChange={(e) => setTitle(e.target.value)}
              autoFocus error={!title.trim()} helperText={!title.trim() ? t('common.required') : ''}
            />
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 0.75 }}>
                {t('diary.content')}
              </Typography>
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder={t('diary.contentRichPlaceholder', 'Write your trade notes, emotions, and lessons here…')}
                minHeight={240}
              />
              {!content.trim() && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                  {t('common.required')}
                </Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>{t('diary.cancel')}</Button>
            <Button variant="contained" onClick={handleSave} disabled={!title.trim() || !content.trim()}>
              {editId ? t('diary.save') : t('diary.create')}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={!!delId} onClose={() => setDelId(null)}>
          <DialogTitle>{t('diary.deleteEntry')}</DialogTitle>
          <DialogContent><Typography>{t('diary.confirmDelete')}</Typography></DialogContent>
          <DialogActions>
            <Button onClick={() => setDelId(null)}>{t('common.cancel')}</Button>
            <Button color="error" variant="contained" onClick={async () => {
              if (delId) { await remove(delId).unwrap(); setDelId(null); }
            }}>{t('common.delete')}</Button>
          </DialogActions>
        </Dialog>

        {/* Detail View Dialog */}
        <Dialog
          open={!!viewEntry}
          onClose={() => setViewEntry(null)}
          maxWidth="md"
          fullWidth
        >
          {viewEntry && (
            <>
              <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">{viewEntry.title}</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <IconButton size="small" color="primary" onClick={() => { setViewEntry(null); openEdit(viewEntry); }} title={isZh ? '编辑' : 'Edit'}>
                    <EditIcon />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => { setViewEntry(null); setDelId(viewEntry.id); }} title={isZh ? '删除' : 'Delete'}>
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </DialogTitle>
              <DialogContent dividers>
                <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 2 }}>
                  {new Date(viewEntry.createdAt).toLocaleString()}
                </Typography>
                <Box
                  sx={{
                    fontSize: 15,
                    lineHeight: 1.8,
                    '& img': { maxWidth: '100%', borderRadius: 1, maxHeight: 400, objectFit: 'contain' },
                    '& pre': { bgcolor: 'rgba(0,0,0,0.25)', p: 1.5, borderRadius: 1, overflowX: 'auto', fontSize: 13 },
                    '& code': { bgcolor: 'rgba(255,255,255,0.08)', px: 0.5, py: 0.2, borderRadius: 0.3, fontSize: '0.9em' },
                  }}
                >
                  <ReactMarkdown remarkPlugins={[remarkBreaks]}>{viewEntry.content}</ReactMarkdown>
                </Box>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setViewEntry(null)} startIcon={<VisibilityIcon />}>
                  {isZh ? '关闭' : 'Close'}
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>
      </Box>

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
