import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import RootLayout from '../layouts/RootLayout';
import AppLayout from '../layouts/AppLayout';
import NotFoundPage from '../pages/NotFoundPage';
import RouteErrorBoundary from '../pages/RouteErrorBoundary';
import { SEO_LANDING_SLUGS } from '../data/seoLandingPages';
import { BLOG_ARTICLE_SLUGS } from '../data/blogArticles';

const PricingPage = lazy(() =>
  import('../pages/PricingPage').then((m) => ({ default: m.default }))
);
const TermsOfServicePage = lazy(() =>
  import('../pages/legal/TermsOfServicePage').then((m) => ({ default: m.default }))
);
const PrivacyPolicyPage = lazy(() =>
  import('../pages/legal/PrivacyPolicyPage').then((m) => ({ default: m.default }))
);
const RefundPolicyPage = lazy(() =>
  import('../pages/legal/RefundPolicyPage').then((m) => ({ default: m.default }))
);

// Public Pages
const LandingPage = lazy(() =>
  import('../pages/LandingPage').then((m) => ({ default: m.default }))
);
const LoginPage = lazy(() =>
  import('../pages/auth/LoginPage').then((m) => ({ default: m.default }))
);
const RegisterPage = lazy(() =>
  import('../pages/auth/RegisterPage').then((m) => ({ default: m.default }))
);
const VerifyEmailPage = lazy(() =>
  import('../pages/auth/VerifyEmailPage').then((m) => ({ default: m.default }))
);
const SeoLandingPage = lazy(() =>
  import('../pages/seo/SeoLandingPage').then((m) => ({ default: m.default }))
);
const BlogArticlePage = lazy(() =>
  import('../pages/seo/BlogArticlePage').then((m) => ({ default: m.default }))
);

// App (Authenticated) Pages
const DashboardPage = lazy(() =>
  import('../pages/dashboard/DashboardPage').then((m) => ({ default: m.default }))
);
const TradesPage = lazy(() =>
  import('../pages/trades/TradesPage').then((m) => ({ default: m.default }))
);
const AiReportsPage = lazy(() =>
  import('../pages/ai-reports/AiReportsPage').then((m) => ({ default: m.default }))
);
const DiaryPage = lazy(() =>
  import('../pages/diary/DiaryPage').then((m) => ({ default: m.default }))
);
const PlaybooksPage = lazy(() =>
  import('../pages/playbooks/PlaybooksPage').then((m) => ({ default: m.default }))
);
const PlaybookDetailPage = lazy(() =>
  import('../pages/playbooks/PlaybookDetailPage').then((m) => ({ default: m.default }))
);
const SubscriptionPage = lazy(() =>
  import('../pages/settings/SubscriptionPage').then((m) => ({ default: m.default }))
);
const CreditsPage = lazy(() =>
  import('../pages/settings/CreditsPage').then((m) => ({ default: m.default }))
);
const SettingsPage = lazy(() =>
  import('../pages/settings/SettingsPage').then((m) => ({ default: m.default }))
);
const HelpPage = lazy(() =>
  import('../pages/settings/HelpPage').then((m) => ({ default: m.default }))
);
const CalendarPage = lazy(() =>
  import('../pages/calendar/CalendarPage').then((m) => ({ default: m.default }))
);
const RewardsPage = lazy(() =>
  import('../pages/rewards/RewardsPage').then((m) => ({ default: m.default }))
);
const BlogListPage = lazy(() =>
  import('../pages/blog/BlogListPage').then((m) => ({ default: m.default }))
);

// Loading fallback component
function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 36, height: 36, border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: '#00d4aa', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}

function suspenseWrap(component: React.ReactNode) {
  return <Suspense fallback={<PageLoader />}>{component}</Suspense>;
}

const router = createBrowserRouter(
  [
  // ===== PUBLIC ROUTES (no sidebar) =====
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: suspenseWrap(<LandingPage />),
      },
      {
        path: 'zh',
        element: suspenseWrap(<LandingPage />),
      },
      {
        path: 'login',
        element: suspenseWrap(<LoginPage />),
      },
      {
        path: 'register',
        element: suspenseWrap(<RegisterPage />),
      },
      {
        path: 'verify-email',
        element: suspenseWrap(<VerifyEmailPage />),
      },
      {
        path: 'pricing',
        element: suspenseWrap(<PricingPage />),
      },
      {
        path: 'terms',
        element: suspenseWrap(<TermsOfServicePage />),
      },
      {
        path: 'privacy',
        element: suspenseWrap(<PrivacyPolicyPage />),
      },
      {
        path: 'refund',
        element: suspenseWrap(<RefundPolicyPage />),
      },
      ...SEO_LANDING_SLUGS.map((slug) => ({
        path: slug,
        element: suspenseWrap(<SeoLandingPage slug={slug} />),
      })),
      ...BLOG_ARTICLE_SLUGS.map((slug) => ({
        path: `blog/${slug}`,
        element: suspenseWrap(<BlogArticlePage slug={slug} />),
      })),
    ],
  },

  // ===== AUTHENTICATED ROUTES (with sidebar + header) =====
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: 'dashboard',
        element: suspenseWrap(<DashboardPage />),
      },
      {
        path: 'trades',
        element: suspenseWrap(<TradesPage />),
      },
      {
        path: 'ai-reports',
        element: suspenseWrap(<AiReportsPage />),
      },
      {
        path: 'diary',
        element: suspenseWrap(<DiaryPage />),
      },
      {
        path: 'playbooks/:id',
        element: suspenseWrap(<PlaybookDetailPage />),
      },
      {
        path: 'playbooks',
        element: suspenseWrap(<PlaybooksPage />),
      },
      {
        path: 'blogs',
        element: suspenseWrap(<BlogListPage />),
      },
      {
        path: 'subscription',
        element: suspenseWrap(<SubscriptionPage />),
      },
      {
        path: 'credits',
        element: suspenseWrap(<CreditsPage />),
      },
      {
        path: 'settings',
        element: suspenseWrap(<SettingsPage />),
      },
      {
        path: 'help',
        element: suspenseWrap(<HelpPage />),
      },
      {
        path: 'calendar',
        element: suspenseWrap(<CalendarPage />),
      },
      {
        path: 'rewards',
        element: suspenseWrap(<RewardsPage />),
      },
    ],
  },

  // ===== CATCH-ALL 404 (must be last) =====
  {
    path: '*',
    element: <NotFoundPage />,
  },
],
);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
