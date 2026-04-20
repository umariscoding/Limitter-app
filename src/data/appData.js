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
      { text: "3 Limits", enabled: true },
      { text: "Fixed 1-Hour Timer", enabled: true },
      { text: "3 Free Overrides / Month", enabled: true },
      { text: "Custom Timers", enabled: false },
      { text: "$1.99 per Extra Override", enabled: true },
    ],
  },
  {
    id: "2",
    name: "Pro",
    price: 4.99,
    priceLabel: "$4.99 / mo",
    badge: null,
    features: [
      { text: "Up to 3 Devices", enabled: true },
      { text: "Unlimited Limits", enabled: true },
      { text: "Custom Timers", enabled: true },
      { text: "15 Free Overrides / Month", enabled: true },
      { text: "Usage Analytics", enabled: true },
      { text: "Journaling", enabled: false },
    ],
  },
  {
    id: "3",
    name: "Elite",
    price: 11.99,
    priceLabel: "$11.99 / mo",
    badge: "Most Popular",
    features: [
      { text: "Up to 10 Devices", enabled: true },
      { text: "Unlimited Limits", enabled: true },
      { text: "Custom Timers", enabled: true },
      { text: "Unlimited Overrides", enabled: true },
      { text: "Usage Analytics", enabled: true },
      { text: "Journaling & AI Insights", enabled: true },
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

// ─── CONFIRM OVERRIDE SCREEN ─────────────────────────────────
export const overrideConfig = {
  oneTimeFee: 1.99,
  feeLabel: "$1.99",
  overrideTitle: "Temporary Override",
  overrideDescription: "Temporarily unlocks the selected device",
  expiresAt: "at midnight (daily reset)",
  expiresLabel: "Override expires at midnight (daily reset)",
};


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
  severityCritical: "Critical",
  severityWarning: "Warning",
  severityInfo: "Info",
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
  upgradeBtnActive: "Top Plan Active",
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
  topPlanBadge: "You're on the Top Plan",
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
