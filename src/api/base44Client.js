import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

export const ADMIN_SESSION_KEY = "coen_admin_session";
export const ADMIN_SESSION_TOKEN_KEY = "coen_admin_session_token";

const ADMIN_FUNCTIONS = new Set([
  "adminAiAssistant",
  "adminAuth",
  "adminEntities",
  "applySeoSuggestions",
  "autoLabelInvoices",
  "bulkGenerateBlogPosts",
  "checkExpiredDocsHoldProjects",
  "checkInsuranceExpiry",
  "checkGmailConnection",
  "checkPaymentReminders",
  "deleteLead",
  "emailCampaigns",
  "disconnectGmail",
  "computeInvoiceGates",
  "emailEstimateToCustomer",
  "generateBlogImages",
  "generateBlogPost",
  "generateEstimate",
  "generateMTO",
  "generateMTOFromUploads",
  "generateSoWFromUploads",
  "generateSitemap",
  "getGmailConnectUrl",
  "getInvoiceAttachment",
  "getSearchVisibility",
  "importHomeDepotPro",
  "listEmployeeOnboarding",
  "listPayrollApprovals",
  "manageAdminUsers",
  "matchInvoiceProjects",
  "resyncInvoiceAttachments",
  "revertSeoChanges",
  "reviewAndApplySeoSuggestions",
  "roofSolarData",
  "runSeoAudit",
  "seedProjectWorkflow",
  "saveSiteContent",
  "scanGmailInvoices",
  "scanGmailVoicemails",
  "scanPermitEmails",
  "scanSubBidEmails",
  "scanQuoteReplies",
  "scanReceipt",
  "sendApprovalEmail",
  "sendBrandedEmail",
  "sendChangeOrderNotification",
  "sendCompliantSms",
  "sendCustomerNotification",
  "sendCustomerPortalInvite",
  "sendMTOEmail",
  "sendSmsNotification",
  "sendSoWEmail",
  "sendSubBidInvite",
  "sendSubcontractorAssignment",
  "sendSubcontractorSmsAssignment",
  "sendSubOnboardingInvite",
  "sendEmployeeOnboardingInvite",
  "reviewEmployeeOnboarding",
  "sendSubcontractorSms",
  "sendVendorInvoiceLink",
  "sendWeeklyCrewReport",
  "sendWeeklyPMSummary",
  "syncEstimateToQuickBooks",
  "syncGoogleCalendar",
  "updateBlogSchedule",
  "updateInvoiceRecord",
  "generateCommunications",
  "detectInboundGmailComms",
]);

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

function getStoredAdminSessionToken() {
  if (typeof window === "undefined") return null;
  try {
    const explicitToken = window.localStorage.getItem(ADMIN_SESSION_TOKEN_KEY);
    if (explicitToken) return explicitToken;

    const rawSession = window.localStorage.getItem(ADMIN_SESSION_KEY);
    if (!rawSession) return null;
    const session = JSON.parse(rawSession);
    return session?.session_token || session?.sessionToken || null;
  } catch {
    return null;
  }
}

// Only attach the custom admin token to admin-only functions. Public tokenized
// portals and lead/customer endpoints should never receive an admin credential.
if (base44?.functions?.invoke) {
  const originalInvoke = base44.functions.invoke.bind(base44.functions);
  base44.functions.invoke = (name, payload = {}, ...rest) => {
    const adminSessionToken = ADMIN_FUNCTIONS.has(name) ? getStoredAdminSessionToken() : null;
    const nextPayload = adminSessionToken && payload && typeof payload === "object" && !Array.isArray(payload)
      ? { ...payload, admin_session_token: adminSessionToken }
      : payload;
    return originalInvoke(name, nextPayload, ...rest);
  };
}