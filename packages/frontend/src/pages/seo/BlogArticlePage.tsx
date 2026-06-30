import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import DownloadIcon from '@mui/icons-material/Download';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import LegalFooter from '../../components/LegalFooter';
import RiskDisclaimerBanner from '../../components/RiskDisclaimerBanner';
import { usePageSeo } from '../../hooks/usePageSeo';
import {
  getBlogArticleContent,
  getBlogArticlePath,
  type BlogArticleSlug,
  type BlogSection,
} from '../../data/blogArticles';

interface Props {
  slug: BlogArticleSlug;
}

function renderSection(section: BlogSection, index: number) {
  switch (section.type) {
    case 'p':
      return (
        <Typography key={index} sx={{ fontSize: 15, color: '#cbd5e1', mb: 2.5, lineHeight: 1.85 }}>
          {section.text}
        </Typography>
      );
    case 'h2':
      return (
        <Typography
          key={index}
          component="h2"
          variant="h5"
          sx={{ fontWeight: 700, color: '#00d4aa', mb: 2, mt: 5, fontSize: { xs: '1.25rem', md: '1.4rem' } }}
        >
          {section.text}
        </Typography>
      );
    case 'h3':
      return (
        <Typography
          key={index}
          component="h3"
          sx={{ fontWeight: 700, color: '#f1f5f9', mb: 1.25, mt: 3, fontSize: 16 }}
        >
          {section.text}
        </Typography>
      );
    case 'ul':
      return (
        <Box component="ul" key={index} sx={{ pl: 2.5, mb: 2.5, color: '#cbd5e1' }}>
          {section.items.map((item) => (
            <Typography component="li" key={item.slice(0, 48)} sx={{ fontSize: 15, lineHeight: 1.85, mb: 0.75 }}>
              {item}
            </Typography>
          ))}
        </Box>
      );
    case 'table':
      return (
        <TableContainer
          key={index}
          sx={{
            mb: 3,
            borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.08)',
            overflowX: 'auto',
          }}
        >
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'rgba(0,212,170,0.08)' }}>
                {section.headers.map((header) => (
                  <TableCell key={header} sx={{ color: '#00d4aa', fontWeight: 700, borderColor: 'rgba(255,255,255,0.06)' }}>
                    {header}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {section.rows.map((row) => (
                <TableRow key={row.join('-')}>
                  {row.map((cell) => (
                    <TableCell key={cell} sx={{ color: '#cbd5e1', borderColor: 'rgba(255,255,255,0.06)', fontSize: 14 }}>
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      );
    default:
      return null;
  }
}

export default function BlogArticlePage({ slug }: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isZh = i18n.language.startsWith('zh');
  const article = getBlogArticleContent(slug, i18n.language);
  const pagePath = getBlogArticlePath(slug);
  const playbookPath = article.cta.playbookUrl.startsWith('http')
    ? new URL(article.cta.playbookUrl).pathname
    : article.cta.playbookUrl;

  const jsonLd = useMemo(
    () => [
      {
        id: `${slug}-article`,
        data: {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: article.h1,
          description: article.metaDescription,
          datePublished: article.publishedAt,
          author: { '@type': 'Organization', name: 'TradeAnchor' },
          publisher: {
            '@type': 'Organization',
            name: 'TradeAnchor',
            logo: { '@type': 'ImageObject', url: 'https://mytradewiseoc.com/logo.png' },
          },
          mainEntityOfPage: `https://mytradewiseoc.com${pagePath}`,
        },
      },
      {
        id: `${slug}-faq`,
        data: {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: article.faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.q,
            acceptedAnswer: { '@type': 'Answer', text: faq.a },
          })),
        },
      },
    ],
    [slug, pagePath, article.h1, article.metaDescription, article.publishedAt, article.faqs],
  );

  usePageSeo({
    title: article.metaTitle,
    description: article.metaDescription,
    path: pagePath,
    ogType: 'article',
    lang: isZh ? 'zh-CN' : 'en',
    keywords: article.keywords,
    jsonLd,
  });

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0e17', color: '#f1f5f9', display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          bgcolor: 'rgba(10,14,23,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, cursor: 'pointer' }} onClick={() => navigate('/')}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1.5,
                  background: 'linear-gradient(135deg,#00d4aa 0%,#00a888 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TrendingUpIcon sx={{ color: '#0a0e17', fontSize: 24 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', lineHeight: 1.3 }}>TradeAnchor</Typography>
                <Typography sx={{ fontSize: 10.5, letterSpacing: 1.8, color: '#64748b', textTransform: 'uppercase', lineHeight: 1.3 }}>
                  {t('landing.hero.tagline')}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <LanguageSwitcher />
              <Button
                variant="contained"
                size="small"
                onClick={() => navigate('/register')}
                sx={{ bgcolor: '#00d4aa', color: '#0a0e17', fontWeight: 700, '&:hover': { bgcolor: '#33dfbb' }, boxShadow: 'none' }}
              >
                {t('landing.nav.freeStart')}
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      <Box sx={{ py: { xs: 5, md: 8 }, flex: 1 }}>
        <Container maxWidth="md">
          <Chip
            label={isZh ? '策略解读' : 'Strategy Guide'}
            size="small"
            sx={{ mb: 2, bgcolor: 'rgba(0,212,170,0.12)', color: '#00d4aa', fontWeight: 600 }}
          />
          <Typography component="h1" variant="h3" sx={{ fontWeight: 800, color: '#fff', mb: 2, fontSize: { xs: '1.75rem', md: '2.25rem' }, lineHeight: 1.2 }}>
            {article.h1}
          </Typography>
          <Typography sx={{ fontSize: { xs: 16, md: 18 }, color: '#94a3b8', mb: 1.5, lineHeight: 1.75 }}>
            {article.subtitle}
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#64748b', mb: 4 }}>
            {article.publishedAt} · {article.readMinutes} {isZh ? '分钟阅读' : 'min read'}
          </Typography>

          {article.sections.map((section, index) => renderSection(section, index))}

          <Card
            elevation={0}
            sx={{
              mt: 6,
              mb: 5,
              bgcolor: 'rgba(0,212,170,0.06)',
              border: '1px solid rgba(0,212,170,0.25)',
              borderRadius: 2,
            }}
          >
            <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <DownloadIcon sx={{ color: '#00d4aa' }} />
                <Typography component="h2" sx={{ fontWeight: 800, color: '#f1f5f9', fontSize: 20 }}>
                  {article.cta.title}
                </Typography>
              </Box>
              {article.cta.body.map((para) => (
                <Typography key={para.slice(0, 40)} sx={{ fontSize: 14.5, color: '#94a3b8', lineHeight: 1.8, mb: 1.5 }}>
                  {para}
                </Typography>
              ))}
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2.5 }}>
                <Button
                  variant="contained"
                  onClick={() => navigate(playbookPath)}
                  sx={{
                    bgcolor: '#00d4aa',
                    color: '#0a0e17',
                    fontWeight: 700,
                    '&:hover': { bgcolor: '#33dfbb', boxShadow: '0 0 24px rgba(0,212,170,0.35)' },
                  }}
                >
                  {isZh ? '查看社区帖子' : 'View Community Post'} →
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/register')}
                  sx={{ borderColor: 'rgba(255,255,255,0.15)', color: '#e2e8f0', fontWeight: 600 }}
                >
                  {article.cta.registerLabel}
                </Button>
                <Button
                  variant="text"
                  onClick={() => navigate('/rewards')}
                  sx={{ color: '#00d4aa', fontWeight: 600 }}
                >
                  {article.cta.rewardsLabel}
                </Button>
              </Box>
            </CardContent>
          </Card>

          <Typography component="h2" variant="h5" sx={{ fontWeight: 700, color: '#00d4aa', mb: 2.5 }}>
            {isZh ? '常见问题' : 'Frequently Asked Questions'}
          </Typography>
          {article.faqs.map((faq) => (
            <Box key={faq.q} sx={{ mb: 3 }}>
              <Typography component="h3" sx={{ fontWeight: 700, color: '#f1f5f9', fontSize: 16, mb: 0.75 }}>
                {faq.q}
              </Typography>
              <Typography sx={{ fontSize: 14.5, color: '#94a3b8', lineHeight: 1.75 }}>{faq.a}</Typography>
            </Box>
          ))}
        </Container>
      </Box>

      <Box sx={{ px: 2, pb: 2 }}>
        <RiskDisclaimerBanner />
      </Box>
      <LegalFooter />
    </Box>
  );
}
