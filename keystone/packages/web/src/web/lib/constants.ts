export const METHODS = [["zelle", "Zelle"], ["check", "Check"], ["cash", "Cash"], ["ach", "Bank transfer (ACH)"], ["other", "Other"]] as const;
export type Method = (typeof METHODS)[number][0];

export const TRADES = [["general", "General handyman"], ["plumbing", "Plumbing"], ["electrical", "Electrical"], ["hvac", "HVAC"], ["appliance", "Appliance repair"], ["roofing", "Roofing"], ["landscaping", "Landscaping"], ["cleaning", "Cleaning"], ["pest", "Pest control"], ["painting", "Painting"]] as const;
export const tradeLabel = (t: string) => TRADES.find((x) => x[0] === t)?.[1] ?? t;

export const PRIORITIES = ["low", "normal", "high", "emergency"] as const;
export const MAINT_CATEGORIES = ["plumbing", "electrical", "hvac", "appliance", "general", "pest", "roofing", "landscaping", "other"] as const;
export const MAINT_STATUSES = ["new", "assigned", "scheduled", "in_progress", "completed", "closed"] as const;
