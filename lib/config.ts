// SOLACE resort locale. Prices are in Indian rupees (the project brief budgets in ₹), so
// the resort runs on India Standard Time. The database stores UTC (timestamptz); dates
// and times are shown, and "today" is decided, in this zone.
export const RESORT = {
  name: "SOLACE",
  locale: "en-IN",
  timeZone: "Asia/Kolkata",
  currency: "INR",
} as const;
