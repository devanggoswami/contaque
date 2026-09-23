/**
 * Utility to calculate plan expiry display information according to Contaque LeadOS rules:
 * - Free users show: "No active subscription"
 * - Active paid plan with date: "Plan expires on: 23 Oct 2026" (formatted in IST)
 * - Expired paid plan: "Plan expired on: 23 Oct 2026"
 * - Date must come dynamically from user's plan_expires_at - never hardcoded
 * - Displays in IST (Asia/Kolkata) using format "DD MMM YYYY" (e.g. 23 Oct 2026)
 */
export function getPlanExpiryInfo(plan, planExpiresAt) {
  const normalizedPlan = (plan || 'free').toLowerCase();
  const isPaidPlan = normalizedPlan.includes('plus') || normalizedPlan.includes('pack');

  if (!isPaidPlan) {
    return {
      status: 'free',
      isExpired: false,
      displayText: 'No active subscription',
      formattedDate: null,
      badgeClass: 'free-subscription'
    };
  }

  if (!planExpiresAt) {
    return {
      status: 'active',
      isExpired: false,
      displayText: 'Active subscription',
      formattedDate: null,
      badgeClass: 'active-subscription'
    };
  }

  const expiryDate = new Date(planExpiresAt);
  const isValidDate = !isNaN(expiryDate.getTime());

  if (!isValidDate) {
    return {
      status: 'active',
      isExpired: false,
      displayText: 'Active subscription',
      formattedDate: null,
      badgeClass: 'active-subscription'
    };
  }

  const formattedDate = expiryDate.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const isExpired = expiryDate.getTime() < Date.now();

  if (isExpired) {
    return {
      status: 'expired',
      isExpired: true,
      displayText: `Plan expired on: ${formattedDate}`,
      formattedDate,
      badgeClass: 'expired-subscription'
    };
  }

  return {
    status: 'active',
    isExpired: false,
    displayText: `Plan expires on: ${formattedDate}`,
    formattedDate,
    badgeClass: 'active-subscription'
  };
}

export function formatPlanExpiryDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}
