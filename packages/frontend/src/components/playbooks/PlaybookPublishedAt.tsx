import { Typography, TypographyProps } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useDisplayTimezone } from '../../hooks/useDisplayTimezone';

interface PlaybookPublishedAtProps {
  publishedAt?: string | Date | null;
  sx?: TypographyProps['sx'];
}

export default function PlaybookPublishedAt({ publishedAt, sx }: PlaybookPublishedAtProps) {
  const { t } = useTranslation();
  const { formatDateTime } = useDisplayTimezone();

  if (!publishedAt) return null;

  return (
    <Typography variant="caption" color="text.secondary" sx={sx}>
      {t('playbooks.publishedAt')}: {formatDateTime(publishedAt)}
    </Typography>
  );
}
