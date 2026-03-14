// ─── DASHBOARD SCREEN 
export const userProfile = {
  appName: "Limitter",
  plan: "Pro",           // "Free" | "Pro" | "Elite"
  overridesUsed: 3,
  overridesTotal: 15,
  totalUsageToday: "4h 20m",
};

export const categories = [
  { id: "1", name: "Social Media", time: "1h 45m", color: "#6366F1", icon: "📱" },
  { id: "2", name: "Gaming", time: "55m", color: "#EC4899", icon: "🎮" },
  { id: "3", name: "Productivity", time: "40m", color: "#10B981", icon: "📈" },
  { id: "4", name: "Entertainment", time: "1h 00m", color: "#F59E0B", icon: "🎬" },
];

// ─── DEVICE MANAGEMENT 
export const devices = [
  {
    id: "1", name: "iPhone 14 Pro", type: "phone",
    model: "Apple iPhone 14 Pro", status: "Active", icon: "📱"
  },
  {
    id: "2", name: "iPad Mini", type: "tablet",
    model: "Apple iPad Mini 6th Gen", status: "Locked", icon: "📱"
  },
  {
    id: "3", name: "MacBook Air", type: "laptop",
    model: "Apple MacBook Air M2", status: "Active", icon: "💻"
  },
  {
    id: "4", name: "Windows PC", type: "desktop",
    model: "Custom Desktop PC", status: "Locked", icon: "🖥️"
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
    status: "Active", icon: "📱"
  },
  {
    id: "2", name: "YouTube", category: "Entertainment",
    status: "Active", icon: "🎬"
  },
  {
    id: "3", name: "Call of Duty", category: "Gaming",
    status: "Inactive", icon: "🎮"
  },
  {
    id: "4", name: "Twitter/X", category: "Social Media",
    status: "Active", icon: "📱"
  },
  {
    id: "5", name: "Netflix", category: "Entertainment",
    status: "Inactive", icon: "🎬"
  },
  {
    id: "6", name: "Notion", category: "Productivity",
    status: "Active", icon: "📈"
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
