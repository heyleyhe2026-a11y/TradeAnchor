import { useTranslation } from 'react-i18next';
import { Box, Typography, Card, CardContent, LinearProgress } from '@mui/material';
import { useGetConfidenceScoreQuery } from '../store/dashboardApi';

interface DimensionProps {
  label: string;
  value: number;
  isRiskScore?: boolean;
}

function ScoreBar({ label, value, isRiskScore = false }: DimensionProps) {
  const color = isRiskScore
    ? (value >= 70 ? '#ef476f' : value >= 40 ? '#fbbf24' : '#00d4aa')
    : (value >= 70 ? '#00d4aa' : value >= 40 ? '#fbbf24' : '#ef476f');

  const displayLabel = (val: number) => {
    if (isRiskScore) {
      if (val >= 70) return 'high';
      if (val >= 40) return 'medium';
      return 'low';
    }
    if (val >= 70) return 'excellent';
    if (val >= 40) return 'good';
    return 'weak';
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.8 }}>
        <Typography variant="body2" sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#cbd5e1' }}>{label}</Typography>
        <Typography variant="body2" sx={{ fontSize: '0.9rem', fontWeight: 700, color }}>{Math.round(value)}%</Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={value}
        sx={{
          height: 12,
          borderRadius: 6,
          bgcolor: 'rgba(255,255,255,0.06)',
          '& .MuiLinearProgress-bar': {
            borderRadius: 6,
            bgcolor: color,
          },
        }}
      />
    </Box>
  );
}

export default function AiConfidenceCard() {
  const { t } = useTranslation();
  const { data: score, isLoading } = useGetConfidenceScoreQuery();

  if (isLoading || !score) return null;

  return (
    <Card sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ pt: 2.5, pb: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Typography variant="h6" sx={{ mb: 2 }}>
          {t('aiConfidence.title')}
        </Typography>

        {/* Dimensions - Fill remaining space */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <ScoreBar label={t('aiConsistency')} value={score.executionConsistency} />
          <ScoreBar label={t('aiRiskExposure')} value={score.riskExposure} />
          <ScoreBar label={t('aiConcentration')} value={score.concentrationRisk} />
          <ScoreBar label={t('aiOverTrading')} value={score.overTradingSeverity} isRiskScore />
        </Box>
      </CardContent>
    </Card>
  );
}
