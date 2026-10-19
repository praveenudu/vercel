import type * as s from "../database/schema";

type App = typeof s.applications.$inferSelect;

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Mock of a TransUnion SmartMove-style screening provider.
 * Deterministic per applicant so results are stable. Swap `runProviderScreening`
 * for a real API call when integrating a provider.
 */
export function runProviderScreening(app: App) {
  const h = hash(`${app.email.toLowerCase()}|${app.lastName.toLowerCase()}`);
  const creditScore = 540 + (h % 280);
  const evictionRecords = app.priorEviction ? 1 : h % 23 === 0 ? 1 : 0;
  const criminalRecords = h % 31 === 0 ? 1 : 0;
  const collections = creditScore < 620 ? 1 + (h % 3) : h % 9 === 0 ? 1 : 0;
  const incomeVerified = app.monthlyIncome > 0 && h % 11 !== 0;
  const verifiedIncome = incomeVerified ? app.monthlyIncome : Math.round(app.monthlyIncome * 0.7);
  const creditBand = creditScore >= 740 ? "Excellent" : creditScore >= 680 ? "Good" : creditScore >= 620 ? "Fair" : "Poor";
  return { creditScore, creditBand, evictionRecords, criminalRecords, collections, incomeVerified, verifiedIncome };
}

export function scoreApplication(app: App, rent: number, rep: ReturnType<typeof runProviderScreening>) {
  const ratio = rent > 0 ? rep.verifiedIncome / rent : 0;
  const refs = (() => {
    try {
      return (JSON.parse(app.referencesJson) as unknown[]).length;
    } catch {
      return 0;
    }
  })();
  const parts = {
    income: ratio >= 3 ? 30 : ratio >= 2.5 ? 22 : ratio >= 2 ? 12 : 0,
    credit: rep.creditScore >= 740 ? 25 : rep.creditScore >= 680 ? 20 : rep.creditScore >= 620 ? 12 : rep.creditScore >= 580 ? 6 : 0,
    eviction: rep.evictionRecords === 0 ? 15 : 0,
    criminal: rep.criminalRecords === 0 ? 10 : 3,
    employment: app.employmentMonths >= 12 ? 10 : app.employmentMonths >= 6 ? 6 : 2,
    history: (app.monthsAtAddress >= 12 ? 5 : 2) + (refs >= 2 ? 5 : refs === 1 ? 3 : 0),
  };
  const score = Object.values(parts).reduce((a, b) => a + b, 0);
  const recommendation = score >= 75 ? "approve" : score >= 55 ? "conditional" : "decline";
  const riskLevel = score >= 75 ? "low" : score >= 55 ? "moderate" : "high";
  return { score, recommendation, riskLevel, parts, ratio: Math.round(ratio * 100) / 100 };
}
