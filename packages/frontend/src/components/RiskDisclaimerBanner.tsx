import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Alert, IconButton, Collapse } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

export default function RiskDisclaimerBanner() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const [expanded, setExpanded] = useState(false);

  return (
    <Alert
      severity="warning"
      icon={<WarningAmberIcon sx={{ fontSize: 24 }} />}
      sx={{
        mt: 0,
        borderRadius: 2,
        py: 1,
        bgcolor: 'rgba(239,68,68,0.04)',
        border: '1px solid rgba(239,68,68,0.12)',
        color: '#94a3b8',
        alignItems: 'center',
        '& .MuiAlert-icon': { color: '#ef4444', alignItems: 'center' },
      }}
    >
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#f87171', fontSize: 18 }}>
            {isZh ? '风险提示' : 'Risk Disclaimer'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', fontSize: 18, lineHeight: 1.7, flex: '1 1 auto' }}>
            {isZh
              ? '本平台AI报告、社区帖子仅用于交易知识学习，不构成任何投资理财建议。'
              : 'All AI analysis & community posts on TradeAnchor are for trading education only, NOT financial investment advice.'}
          </Typography>

          <IconButton size="small" onClick={() => setExpanded(!expanded)} sx={{
            color: '#94a3b8', fontSize: 16, fontWeight: 500, px: 0.5, py: 0.25,
            '&:hover': { color: '#f87171', bgcolor: 'transparent' },
          }}>
            {expanded ? <ExpandLessIcon sx={{ fontSize: 20 }} /> : <ExpandMoreIcon sx={{ fontSize: 20 }} />}
            <span style={{ fontSize: 16 }}>{expanded ? (isZh ? '收起' : 'Less') : (isZh ? '详情' : 'More')}</span>
          </IconButton>
        </Box>

        {/* Expandable details */}
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box sx={{
            mt: 1.5,
            p: 1.5,
            borderRadius: 1.5,
            bgcolor: 'rgba(239,68,68,0.03)',
            borderLeft: '2px solid rgba(239,68,68,0.2)',
          }}>
            {isZh ? (
              <>
                <Typography variant="body2" sx={{ display: 'block', color: '#94a3b8', fontSize: 18, mb: 0.5, lineHeight: 1.7 }}>• 本平台 AI 分析报告和社区帖子仅供交易知识学习和交流，不构成任何投资理财建议。</Typography>
                <Typography variant="body2" sx={{ display: 'block', color: '#94a3b8', fontSize: 18, mb: 0.5, lineHeight: 1.7 }}>• 过往表现不代表未来收益，所有用户生成内容由发布者自行负责，平台不对第三方用户帖子承担责任。</Typography>
                <Typography variant="body2" sx={{ display: 'block', color: '#94a3b8', fontSize: 18, mb: 0.5, lineHeight: 1.7 }}>• 交易存在高风险。</Typography>
                <Typography variant="body2" sx={{ display: 'block', color: '#64748b', fontSize: 18, mt: 0.75, lineHeight: 1.6 }}>
                  TradeAnchor 是一款独立的 SaaS 交易记账软件，与 TradeWise 及其他类似名称的产品或金融机构无任何关联。
                </Typography>
              </>
            ) : (
              <>
                <Typography variant="body2" sx={{ display: 'block', color: '#94a3b8', fontSize: 18, mb: 0.5, lineHeight: 1.7 }}>• All AI analysis & community posts are for trading education only, NOT financial investment advice.</Typography>
                <Typography variant="body2" sx={{ display: 'block', color: '#94a3b8', fontSize: 18, mb: 0.5, lineHeight: 1.7 }}>• Past performance does not guarantee future profits. All user-generated content is the sole responsibility of its publisher. TradeAnchor shall not be liable for third-party user posts.</Typography>
                <Typography variant="body2" sx={{ display: 'block', color: '#94a3b8', fontSize: 18, mb: 0.5, lineHeight: 1.7 }}>• Trading involves high financial risks.</Typography>
                <Typography variant="body2" sx={{ display: 'block', color: '#64748b', fontSize: 18, mt: 0.75, lineHeight: 1.6 }}>
                  TradeAnchor is an independent SaaS trading journal platform, with no affiliation to TradeWise or other similarly named products or financial entities.
                </Typography>
              </>
            )}
          </Box>
        </Collapse>
      </Box>
    </Alert>
  );
}
