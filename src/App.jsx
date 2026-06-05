import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import useGoogleMaps from '@/hooks/useGoogleMaps';

import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';

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
import CustomerQuotes from './pages/admin/CustomerQuotes';
import AdminTeam from './pages/admin/AdminTeam';
import AdminSetPassword from './pages/admin/AdminSetPassword';
import AdminTracking from './pages/admin/AdminTracking';
import AdminInvoices from './pages/admin/AdminInvoices';
import AdminReviews from './pages/admin/AdminReviews';
import AdminCalendar from './pages/admin/AdminCalendar';
import SubcontractorDashboard from './pages/admin/SubcontractorDashboard';
import SubInvoiceApprovals from './pages/admin/SubInvoiceApprovals';
import SubDocUpload from './pages/SubDocUpload';
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
import ScheduleCalendar from './pages/estimator/Calendar';
import QuickARMeasure from './pages/estimator/QuickARMeasure';
import MarginGuard from './pages/estimator/MarginGuard';
import SubBidPortal from './pages/SubBidPortal';
import SubOnboardingPortal from './pages/SubOnboardingPortal';
import DailyLogs from './pages/estimator/DailyLogs';
import CommsHub from './pages/estimator/CommsHub';
import EmailTemplates from './pages/estimator/EmailTemplates';
import ProjectTasks from './pages/estimator/ProjectTasks';
import CommandCenter from './pages/estimator/CommandCenter';
import BenchmarkSettings from './pages/estimator/BenchmarkSettings';
import CommsPerformance from './pages/estimator/CommsPerformance';
import TradeCalculators from './pages/estimator/TradeCalculators';
import CodeLookup from './pages/estimator/CodeLookup';
import EstimateApproval from './pages/EstimateApproval';
import BookWalkthrough from './pages/BookWalkthrough';
import ReceiptScanner from './pages/estimator/ReceiptScanner';
import RoofMeasurement from './pages/estimator/RoofMeasurement';
import FieldCrewApp from './pages/FieldCrewApp';
import FieldCrewAdmin from './pages/estimator/FieldCrewAdmin';
import TimeOffManagement from './pages/estimator/TimeOffManagement';
import StaffTimeOff from './pages/StaffTimeOff';
import PayrollApprovalPortal from './pages/admin/PayrollApprovalPortal';
import CustomerPortal from './pages/CustomerPortal';
import SubcontractorPortal from './pages/SubcontractorPortal';
import HeadingAudit from '@/components/dev/HeadingAudit';
import PerfAudit from '@/components/dev/PerfAudit';
import RedirectHandler from '@/components/RedirectHandler';
import Error500 from './pages/Error500';

const AuthenticatedApp = () => {
  const { isLoadingPublicSettings } = useAuth();

  if (isLoadingPublicSettings) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  const loginRedirect = <Login />;

  return (
    <>
    <Routes>
      {/* ── Auth pages (always public) ── */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* ── Public website (no login required) ── */}
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
        <Route path="/budget-estimator" element={<BudgetEstimator />} />
        <Route path="/start" element={<StartProject />} />
      </Route>

      {/* ── Public token-based portals (no login required) ── */}
      <Route path="/estimate-approval" element={<EstimateApproval />} />
      <Route path="/book-walkthrough" element={<BookWalkthrough />} />
      <Route path="/customer-portal" element={<CustomerPortal />} />
      <Route path="/subcontractor-portal" element={<SubcontractorPortal />} />
      <Route path="/sub-bid-portal" element={<SubBidPortal />} />
      <Route path="/sub-onboarding" element={<SubOnboardingPortal />} />
      <Route path="/sub-doc-upload" element={<SubDocUpload />} />
      <Route path="/payroll-approval" element={<PayrollApprovalPortal />} />
      <Route path="/vendor/invoice-update" element={<VendorInvoiceUpload />} />
      <Route path="/my-projects" element={<MyProjects />} />
      <Route path="/project" element={<ProjectDetail />} />
      <Route path="/shared-design" element={<SharedDesign />} />
      <Route path="/admin/set-password" element={<AdminSetPassword />} />

      {/* ── Protected: requires Base44 login ── */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Login />} />}>
        {/* Admin Hub */}
        <Route path="/admin" element={<AdminHub />}>
          <Route index element={<AdminDashboard />} />
          <Route path="leads" element={<AdminLeads embedded />} />
          <Route path="blog" element={<AdminBlog embedded />} />
          <Route path="cms" element={<AdminCMS />} />
          <Route path="seo" element={<AdminSEO />} />
          <Route path="estimates" element={<CustomerQuotes />} />
          <Route path="team" element={<AdminTeam />} />
          <Route path="tracking" element={<AdminTracking />} />
          <Route path="invoices" element={<AdminInvoices />} />
          <Route path="reviews" element={<AdminReviews />} />
          <Route path="calendar" element={<AdminCalendar />} />
          <Route path="subcontractors" element={<SubcontractorDashboard />} />
          <Route path="sub-approvals" element={<SubInvoiceApprovals />} />
          <Route path="payroll-approvals" element={<PayrollApprovalPortal />} />
          <Route path="profile" element={<CompanyProfilePage />} />
        </Route>

        {/* Estimating Suite */}
        <Route path="/estimator" element={<EstimatorLayout />}>
          <Route index element={<CommandCenter />} />
          <Route path="dashboard" element={<EstimatorDashboard />} />
          <Route path="comms-settings" element={<BenchmarkSettings />} />
          <Route path="comms-performance" element={<CommsPerformance />} />
          <Route path="projects" element={<ProjectList />} />
          <Route path="projects/:id" element={<EstimatorProjectDetail />} />
          <Route path="calendar" element={<ScheduleCalendar />} />
          <Route path="walkthrough" element={<Walkthrough />} />
          <Route path="vendors" element={<AdminVendors />} />
          <Route path="toolbox" element={<EstimatorToolbox />} />
          <Route path="mto" element={<MTOGenerator />} />
          <Route path="sow" element={<SoWGenerator />} />
          <Route path="measure" element={<QuickARMeasure />} />
          <Route path="margin" element={<MarginGuard />} />
          <Route path="logs" element={<DailyLogs />} />
          <Route path="comms" element={<CommsHub />} />
          <Route path="email-templates" element={<EmailTemplates />} />
          <Route path="tasks" element={<ProjectTasks />} />
          <Route path="calculators" element={<TradeCalculators />} />
          <Route path="codes" element={<CodeLookup />} />
          <Route path="receipts" element={<ReceiptScanner />} />
          <Route path="roof-measure" element={<RoofMeasurement />} />
          <Route path="customers" element={<CustomerHistory />} />
          <Route path="field-crew" element={<FieldCrewAdmin />} />
          <Route path="time-off" element={<TimeOffManagement />} />
          <Route path="company" element={<CompanyProfilePage />} />
        </Route>

        {/* Field crew & staff apps */}
        <Route path="/field" element={<FieldCrewApp />} />
        <Route path="/staff/time-off" element={<StaffTimeOff />} />
      </Route>

      <Route path="/500" element={<Error500 />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    {import.meta.env.DEV && <HeadingAudit />}
    {import.meta.env.DEV && <PerfAudit />}
  </>
  );
};

function GoogleMapsLoader() {
  useGoogleMaps(); // load once at app root so all routes have it
  return null;
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <GoogleMapsLoader />
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