import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';

import UserNotRegisteredError from '@/components/UserNotRegisteredError';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);
  return null;
}

// App pages (existing)
import StartProject from './pages/StartProject';
import MyProjects from './pages/MyProjects';
import ProjectDetail from './pages/ProjectDetail';
import SharedDesign from './pages/SharedDesign';

// Website pages
import WebsiteLayout from './components/website/WebsiteLayout';
import WebHome from './pages/website/WebHome';
import WebAbout from './pages/website/WebAbout';
import WebContact from './pages/website/WebContact';
import WebServicePage from './pages/website/WebServicePage';
import WebServices from './pages/website/WebServices';
import WebServiceAreas from './pages/website/WebServiceAreas';
import WebRegionPage from './pages/website/WebRegionPage';
import WebTownPage from './pages/website/WebTownPage';
import WebGallery from './pages/website/WebGallery';
import WebFinancing from './pages/website/WebFinancing';
import WebBlog from './pages/website/WebBlog';
import WebBlogPost from './pages/website/WebBlogPost';
import WebPrivacyPolicy from './pages/website/WebPrivacyPolicy';
import WebSitemap from './pages/website/WebSitemap';
import AdminLeads from './pages/AdminLeads';
import AdminBlog from './pages/AdminBlog';
import AdminHub from './pages/AdminHub';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCMS from './pages/admin/AdminCMS';
import AdminSEO from './pages/admin/AdminSEO';
import AdminEstimates from './pages/admin/AdminEstimates';
import AdminTeam from './pages/admin/AdminTeam';
import AdminSetPassword from './pages/admin/AdminSetPassword';
import AdminTracking from './pages/admin/AdminTracking';
import AdminInvoices from './pages/admin/AdminInvoices';
import BudgetEstimator from './pages/BudgetEstimator';
import VendorInvoiceUpload from './pages/VendorInvoiceUpload';
import EstimatorLayout from './pages/estimator/EstimatorLayout';
import EstimatorDashboard from './pages/estimator/EstimatorDashboard';
import ProjectList from './pages/estimator/ProjectList';
import EstimatorProjectDetail from './pages/estimator/ProjectDetail';
import Walkthrough from './pages/estimator/Walkthrough';
import AdminVendors from './pages/estimator/AdminVendors';
import CompanyProfilePage from './pages/estimator/CompanyProfilePage';
import EstimatorToolbox from './pages/estimator/EstimatorToolbox';
import MTOGenerator from './pages/estimator/MTOGenerator';
import SoWGenerator from './pages/estimator/SoWGenerator';
import CustomerHistory from './pages/estimator/CustomerHistory';
import QuickARMeasure from './pages/estimator/QuickARMeasure';
import MarginGuard from './pages/estimator/MarginGuard';
import DailyLogs from './pages/estimator/DailyLogs';
import TradeCalculators from './pages/estimator/TradeCalculators';
import CodeLookup from './pages/estimator/CodeLookup';
import EstimateApproval from './pages/EstimateApproval';
import CustomerPortal from './pages/CustomerPortal';
import HeadingAudit from '@/components/dev/HeadingAudit';
import PerfAudit from '@/components/dev/PerfAudit';
import RedirectHandler from '@/components/RedirectHandler';
import Error500 from './pages/Error500';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <>
    <Routes>
      {/* Public website routes */}
      <Route element={<WebsiteLayout />}>
        <Route path="/" element={<WebHome />} />
        <Route path="/about" element={<WebAbout />} />
        <Route path="/contact" element={<WebContact />} />
        <Route path="/gallery" element={<WebGallery />} />
        <Route path="/financing" element={<WebFinancing />} />
        <Route path="/blog" element={<WebBlog />} />
        <Route path="/services" element={<WebServices />} />
        <Route path="/services/:service" element={<WebServicePage />} />
        <Route path="/service-areas" element={<WebServiceAreas />} />
        <Route path="/service-areas/greater-boston" element={<WebRegionPage />} />
        <Route path="/service-areas/metro-west" element={<WebRegionPage />} />
        <Route path="/service-areas/south-shore" element={<WebRegionPage />} />
        <Route path="/service-areas/:town" element={<WebTownPage />} />
        <Route path="/blog/:slug" element={<WebBlogPost />} />
        <Route path="/privacy-policy" element={<WebPrivacyPolicy />} />
        <Route path="/sitemap" element={<WebSitemap />} />
      </Route>

      {/* Admin Hub — unified admin backend */}
      <Route path="/admin" element={<AdminHub />}>
        <Route index element={<AdminDashboard />} />
        <Route path="leads" element={<AdminLeads embedded />} />
        <Route path="blog" element={<AdminBlog embedded />} />
        <Route path="cms" element={<AdminCMS />} />
        <Route path="seo" element={<AdminSEO />} />
        <Route path="estimates" element={<AdminEstimates />} />
        <Route path="team" element={<AdminTeam />} />
        <Route path="tracking" element={<AdminTracking />} />
        <Route path="invoices" element={<AdminInvoices />} />
        <Route path="profile" element={<CompanyProfilePage />} />
      </Route>
      <Route path="/admin/set-password" element={<AdminSetPassword />} />

      {/* Estimating Suite */}
      <Route path="/estimator" element={<EstimatorLayout />}>
        <Route index element={<EstimatorDashboard />} />
        <Route path="projects" element={<ProjectList />} />
        <Route path="projects/:id" element={<EstimatorProjectDetail />} />
        <Route path="walkthrough" element={<Walkthrough />} />
        <Route path="vendors" element={<AdminVendors />} />
        <Route path="toolbox" element={<EstimatorToolbox />} />
        <Route path="mto" element={<MTOGenerator />} />
        <Route path="sow" element={<SoWGenerator />} />
        <Route path="measure" element={<QuickARMeasure />} />
        <Route path="margin" element={<MarginGuard />} />
        <Route path="logs" element={<DailyLogs />} />
        <Route path="calculators" element={<TradeCalculators />} />
        <Route path="codes" element={<CodeLookup />} />
        <Route path="customers" element={<CustomerHistory />} />
        <Route path="company" element={<CompanyProfilePage />} />
      </Route>
      <Route path="/estimate-approval" element={<EstimateApproval />} />
      <Route path="/customer-portal" element={<CustomerPortal />} />
      <Route path="/vendor/invoice-update" element={<VendorInvoiceUpload />} />
      <Route path="/start" element={<StartProject />} />
      <Route path="/budget-estimator" element={<BudgetEstimator />} />
      <Route path="/my-projects" element={<MyProjects />} />
      <Route path="/project" element={<ProjectDetail />} />
      <Route path="/shared-design" element={<SharedDesign />} />

      <Route path="/500" element={<Error500 />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    {import.meta.env.DEV && <HeadingAudit />}
    {import.meta.env.DEV && <PerfAudit />}
  </>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <RedirectHandler />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App