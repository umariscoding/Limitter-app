// ─── DASHBOARD SCREEN 
export const userProfile = {
  appName: "Limitter",
  plan: "Pro",           // "Free" | "Pro" | "Elite"
  overridesUsed: 3,
  overridesTotal: 15,
  totalUsageToday: "4h 20m",
};

export const categories = [
  { id: "1", name: "Social Media", time: "1h 45m", color: "#6366F1", icon: "smartphone" },
  { id: "2", name: "Gaming", time: "55m", color: "#EC4899", icon: "gamepad-2" },
  { id: "3", name: "Productivity", time: "40m", color: "#10B981", icon: "trending-up" },
  { id: "4", name: "Entertainment", time: "1h 00m", color: "#F59E0B", icon: "film" },
];

// ─── DEVICE MANAGEMENT 
export const devices = [
  {
    id: "1", name: "iPhone 14 Pro", type: "phone",
    model: "Apple iPhone 14 Pro", status: "Active", icon: "smartphone"
  },
  {
    id: "2", name: "iPad Mini", type: "tablet",
    model: "Apple iPad Mini 6th Gen", status: "Locked", icon: "tablet"
  },
  {
    id: "3", name: "MacBook Air", type: "laptop",
    model: "Apple MacBook Air M2", status: "Active", icon: "laptop"
  },
  {
    id: "4", name: "Windows PC", type: "desktop",
    model: "Custom Desktop PC", status: "Locked", icon: "monitor"
  },
];

export const deviceLimit = {
  plan: "Pro",
  maxActiveDevices: 2,
  infoText: "Pro Plan: 2 Active Devices Max. Lock one to activate another.",
  sharedLimitNote: "Time limits are shared across all devices (account-wide)",
};

// ─── OVERRIDE LOGS 
export const overrideLogs = [
  {
    id: "1", app: "Instagram", dateTime: "Jun 14, 2025 — 11:20 PM",
    device: "iPhone 14 Pro"
  },
  {
    id: "2", app: "YouTube", dateTime: "Jun 13, 2025 — 3:05 PM",
    device: "iPad Mini"
  },
  {
    id: "3", app: "Call of Duty", dateTime: "Jun 12, 2025 — 9:42 PM",
    device: "MacBook Air"
  },
  {
    id: "4", app: "TikTok", dateTime: "Jun 11, 2025 — 7:15 PM",
    device: "iPhone 14 Pro"
  },
  {
    id: "5", app: "Twitch", dateTime: "Jun 10, 2025 — 1:30 AM",
    device: "MacBook Air"
  },
];

// ─── MANAGED CONTENT (Apps & Websites) 
export const managedContent = [
  {
    id: "1", name: "Instagram", category: "Social Media",
    status: "Active", icon: "smartphone"
  },
  {
    id: "2", name: "YouTube", category: "Entertainment",
    status: "Active", icon: "film"
  },
  {
    id: "3", name: "Call of Duty", category: "Gaming",
    status: "Inactive", icon: "gamepad-2"
  },
  {
    id: "4", name: "Twitter/X", category: "Social Media",
    status: "Active", icon: "smartphone"
  },
  {
    id: "5", name: "Netflix", category: "Entertainment",
    status: "Inactive", icon: "film"
  },
  {
    id: "6", name: "Notion", category: "Productivity",
    status: "Active", icon: "trending-up"
  },
];

// ─── CONTROL & PLANS SCREEN 
export const planDetails = {
  currentPlan: "Pro",
  status: "Active",
  benefits: "5 Devices • Unlimited Overrides • Smart Override Enabled",
  deviceSlotsUsed: 4,
  deviceSlotsTotal: 5,
};

export const usageControls = [
  {
    id: "1", title: "Daily Time Limits",
    description: "Set max daily usage per category",
    icon: "clock", route: "DailyLimitsScreen"
  },
  {
    id: "2", title: "Lockout Schedule",
    description: "Block usage during set time windows",
    icon: "calendar", route: "LockoutScheduleScreen"
  },
];

export const featureToggles = [
  {
    id: "1", key: "safeBrowsing", title: "Safe Browsing",
    description: "Filter adult and harmful content",
    defaultValue: true
  },
  {
    id: "2", key: "smartOverride", title: "Smart Override",
    description: "Allow requests for extra screen time",
    defaultValue: true
  },
];

// ─── SUBSCRIPTION PLANS SCREEN 
export const subscriptionPlans = [
  {
    id: "1",
    name: "Free",
    price: 0.00,
    priceLabel: "$0 / mo",
    badge: null,
    features: [
      { text: "1 Device", enabled: true },
      { text: "Standard Overrides", enabled: true },
      { text: "Basic Blocking", enabled: true },
      { text: "Web Filtering", enabled: true },
      { text: "Custom Overrides", enabled: false },
      { text: "Advanced Tracking", enabled: false },
    ],
  },
  {
    id: "2",
    name: "Pro",
    price: 9.99,
    priceLabel: "$9.99 / mo",
    badge: null,
    features: [
      { text: "Up to 5 Devices", enabled: true },
      { text: "3 Instant Overrides/day", enabled: true },
      { text: "Advanced Tracking", enabled: true },
      { text: "Custom Overrides", enabled: true },
      { text: "Web Filtering", enabled: true },
      { text: "AI Insights", enabled: false },
      { text: "Geo-Fencing", enabled: false },
    ],
  },
  {
    id: "3",
    name: "Elite",
    price: 19.99,
    priceLabel: "$19.99 / mo",
    badge: "Most Popular",
    features: [
      { text: "Unlimited Devices", enabled: true },
      { text: "Unlimited Overrides", enabled: true },
      { text: "AI Insights", enabled: true },
      { text: "Geo-Fencing", enabled: true },
      { text: "Custom Overrides", enabled: true },
      { text: "24/7 Priority Support", enabled: true },
    ],
  },
];

export const addonPricing = {
  extraDeviceLabel: "Extra Child Devices",
  extraDevicePricePerUnit: 2.99,
  maxExtraDevices: 10,
};

export const trustSignals = [
  {
    id: "1", icon: "shield-check", title: "30-Day Money Back Guarantee",
    subtitle: "No questions asked. Cancel anytime.",
    bgColor: "#F0FDF4", iconColor: "#16A34A"
  },
  {
    id: "2", icon: "lock", title: "Secure Stripe Payment",
    subtitle: "Your payment info is encrypted and never stored.",
    bgColor: "#EFF6FF", iconColor: "#2563EB"
  },
];

// ─── ANALYTICS SCREEN ────────────────────────────────────────
export const todayUsage = {
  totalTime: "5h 02m",
  dailyLimitHours: 6,
  dailyLimitLabel: "6h 00m",
  usedMinutes: 302,
  limitMinutes: 360,
};

export const hourlyChart = [
  { label: "8am",  minutes: 20 },
  { label: "9am",  minutes: 45 },
  { label: "10am", minutes: 30 },
  { label: "11am", minutes: 55 },
  { label: "12pm", minutes: 70 },
  { label: "1pm",  minutes: 40 },
  { label: "2pm",  minutes: 25 },
  { label: "3pm",  minutes: 60 },
  { label: "4pm",  minutes: 35 },
  { label: "5pm",  minutes: 15 },
];

export const thresholdAlert = {
  warningPercent: 75,
  criticalPercent: 90,
  message: "Alerts trigger at 75% and 90% of your daily limit.",
};

export const appBreakdown = [
  {
    id: "1",
    name: "Instagram",
    category: "Social Media",
    icon: "instagram",
    color: "#E1306C",
    usedMinutes: 85,
    limitMinutes: 90,
  },
  {
    id: "2",
    name: "Roblox",
    category: "Gaming",
    icon: "gamepad-2",
    color: "#EC4899",
    usedMinutes: 60,
    limitMinutes: 80,
  },
  {
    id: "3",
    name: "YouTube Kids",
    category: "Entertainment",
    icon: "youtube",
    color: "#FF0000",
    usedMinutes: 45,
    limitMinutes: 60,
  },
  {
    id: "4",
    name: "Duolingo",
    category: "Productivity",
    icon: "book-open",
    color: "#10B981",
    usedMinutes: 20,
    limitMinutes: 45,
  },
];

export const quickInsights = {
  mostUsedCategory: {
    name: "Gaming",
    totalTime: "1h 45m",
    icon: "gamepad-2",
    color: "#EC4899",
  },
  alertsTriggered: {
    count: 7,
    label: "Limit warnings today",
    devicesAffected: 3,
  },
};

export const analyticsLabels = {
  headerTitle: "Usage Analytics",
  headerSubtitle: "Today's breakdown",
  usageLabel: "Today's Usage",
  limitLabel: "Daily Limit: ",
  resetsIn: "Resets in:",
  hourlyActivity: "Hourly Activity",
  appBreakdown: "App Breakdown",
  viewAllLink: "View All Apps & Sites",
  viewAllButton: "View All Apps & Sites ->",
  quickInsights: "Quick Insights",
  mostUsedCategory: "Most Used Category",
  alertsTriggered: "Alerts Triggered",
  todayAt: " today",
};

// ─── CONFIRM OVERRIDE SCREEN ─────────────────────────────────
export const overrideConfig = {
  oneTimeFee: 1.99,
  feeLabel: "$1.99",
  overrideTitle: "Temporary Override",
  overrideDescription: "Temporarily unlocks the selected device",
  expiresAt: "today at 4:30 PM",
  expiresLabel: "Expires today at 4:30 PM",
};

export const overrideTierLogic = {
  Free: {
    isFree: false,
    showPrice: true,
    priceLabel: "$1.99",
    remainingOverrides: 0,
    remainingLabel: "",
  },
  Pro: {
    isFree: true,
    showPrice: false,
    priceLabel: "Free",
    remainingOverrides: 12,
    remainingLabel: "Free (12 Remaining)",
  },
  Elite: {
    isFree: true,
    showPrice: false,
    priceLabel: "Free",
    remainingOverrides: "Unlimited",
    remainingLabel: "Free (Unlimited)",
  },
};

export const savedPaymentMethods = [
  {
    id: "1",
    type: "Visa",
    last4: "4242",
    expiry: "12/26",
    isDefault: true,
  },
  {
    id: "2",
    type: "Mastercard",
    last4: "5555",
    expiry: "08/25",
    isDefault: false,
  },
  {
    id: "3",
    type: "Visa",
    last4: "1234",
    expiry: "03/27",
    isDefault: false,
  },
];

export const expressCheckout = {
  showApplePay: true,
  showGooglePay: true,
  showPayPal: false, // NEVER show PayPal — excluded by design
};

export const aiNudgeMessages = [
  {
    id: "1",
    context: "homework",
    message: "Your child has 30 mins of math homework left. Are you sure you want to unlock access now?",
    icon: "book-open",
    severity: "warning", // "warning" | "critical" | "info"
  },
  {
    id: "2",
    context: "late_night",
    message: "It's past 10 PM. Late screen time can affect sleep quality significantly.",
    icon: "moon",
    severity: "critical",
  },
  {
    id: "3",
    context: "limit_reached",
    message: "Daily screen time limit has been reached. Overriding may impact tomorrow's focus.",
    icon: "alert-triangle",
    severity: "critical",
  },
  {
    id: "4",
    context: "general",
    message: "You're requesting extra screen time. Consider if this aligns with your family goals.",
    icon: "info",
    severity: "info",
  },
];

export const activeNudgeContext = "homework";

export const overrideLabels = {
  headerTitle: "Confirm Override",
  headerSubtitle: "Review before unlocking",
  freeUsageNote: "Using 1 monthly override credit",
  oneTimePaymentNote: "One-time payment",
  noPaymentRequired: "No payment required. Your override credit will be used.",
  paymentMethodTitle: "Payment Method",
  addNewCard: "Add New Card",
  orPayWith: "Or pay with",
  aiInsightTitle: "ScreenGuard AI Insight",
  aiPoweredBy: "Powered by ScreenGuard AI • Context: ",
  severityCritical: "🔴 Critical",
  severityWarning: "⚠ Warning",
  severityInfo: "ℹ Info",
  btnFree: "Confirm & Unlock Device (Free)",
  btnPaidPrefix: "Confirm & Pay ",
  btnPaidSuffix: " & Unlock",
  alertUnlockedTitle: "Device Unlocked!",
  alertCreditUsed: "Override credit used. Remaining: ",
  alertPaymentSuccessTitle: "Payment Successful",
  alertPaymentProcessed: "Payment processed. Device Unlocked!",
  securityMain: "Secured by Stripe & ScreenGuard AI",
  securitySub: "256-bit encryption • PCI DSS Compliant",
  alertPaySheetApple: "Apple Pay sheet launching...",
  alertPaySheetGoogle: "Google Pay sheet launching...",
  alertCardEntrySoon: "Card entry coming soon...",
};

export const dashboardLabels = {
  welcomeMessage: "Login Successful! Welcome to Limitter.",
  totalUsageLabel: "Total Usage Today (All Devices)",
  categoriesTitle: "Categories",
  viewDetails: "View Details →",
  yourDevicesTitle: "Your Devices",
  manageAll: "Manage All",
  lockNow: "Lock Now",
  unlock: "Unlock",
  navHome: "Home",
  navUsage: "Usage",
  navSettings: "Settings",
  overridesUsedLabel: "Overrides Used: ",
};

export const controlLabels = {
  headerTitle: "Control & Plans",
  memberSuffix: " Member",
  deviceSlotsLabel: "Device Slots Used",
  slotRemaining: " slot remaining",
  slotsRemaining: " slots remaining",
  upgradeBtn: "Upgrade to Elite",
  upgradeBtnActive: "Top Plan Active ✓",
  managedDevicesTitle: "Managed Devices",
  managedDevicesSubtitle: "Tap a device to manage it",
  addNewDevice: "+ Add New Device",
  usageControlsTitle: "Usage Controls",
  accountTitle: "Account",
  notificationSettings: "Notification Settings",
  signOut: "Sign Out",
  signOutConfirm: "Are you sure you want to sign out?",
  cancel: "Cancel",
  pairingAlert: "Pairing...",
};

export const subscriptionLabels = {
  headerTitle: "Choose Your Plan",
  headerSubtitle: "Scale your digital wellness control",
  topPlanBadge: "You're on the Top Plan ✓",
  upgradePrefix: "Upgrade to ",
  alertActivatedTitle: "Plan Activated!",
  alertActivatedMsg: "You are now on the ",
  btnDashboard: "Go to Dashboard",
  addOnsTitle: "Add-Ons",
  totalMonthlyLabel: "Total Monthly",
  extraDevicesSuffix: " Extra Devices ",
  deviceMo: " / device / mo",
  mo: " / mo",
};

export const overrideLogLabels = {
  headerTitle: "Override Logs",
  emptyState: "No overrides recorded yet.",
};

export const addContentLabels = {
  headerTitle: "Managed Content",
  addNew: "+ Add New App / Website",
  comingSoonTitle: "Coming Soon",
  comingSoonMsg: "This feature is under development.",
};
