import { MatchResults } from "./matcher";

export type Grade = "A" | "B" | "C" | "D" | "F";
export type Recommendation =
  | "Strong yes"
  | "Likely yes"
  | "Maybe"
  | "Probably not"
  | "Pass";

export interface ScoreBreakdown {
  overallScore: number; // 0-100
  grade: Grade;
  recommendation: Recommendation;
  overlapScore: number;
  overlapGrade: Grade;
  contactQualityScore: number | null;
  contactQualityGrade: Grade | null;
  costScore: number | null;
  costGrade: Grade | null;
  costPerTarget: number | null;
  avgAttendeesPerMatch: number;
  details: string[];
}

function toGrade(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  if (score >= 25) return "D";
  return "F";
}

function overlapToScore(rate: number): number {
  // >30% = 100, 20-30% = 80, 10-20% = 60, 5-10% = 35, <5% = 15
  if (rate >= 0.3) return 100;
  if (rate >= 0.2) return 70 + ((rate - 0.2) / 0.1) * 30;
  if (rate >= 0.1) return 50 + ((rate - 0.1) / 0.1) * 20;
  if (rate >= 0.05) return 25 + ((rate - 0.05) / 0.05) * 25;
  return (rate / 0.05) * 25;
}

function costToScore(costPerTarget: number): number {
  // <$500 = 100, $500-1500 = 80, $1500-2500 = 60, $2500-5000 = 35, >$5000 = 15
  if (costPerTarget <= 500) return 100;
  if (costPerTarget <= 1500) return 80;
  if (costPerTarget <= 2500) return 60;
  if (costPerTarget <= 5000) return 35;
  return 15;
}

const RELEVANT_TITLE_KEYWORDS = [
  "engineer",
  "developer",
  "cto",
  "vp eng",
  "vp of eng",
  "head of eng",
  "director of eng",
  "architect",
  "tech lead",
  "staff",
  "principal",
  "senior",
  "product",
  "cpo",
  "founder",
  "ceo",
  "co-founder",
  "cofounder",
  "mobile",
  "frontend",
  "front-end",
  "full stack",
  "fullstack",
  "software",
  "devops",
  "platform",
  "infrastructure",
  "sre",
];

function isTitleRelevant(title: string): boolean {
  const lower = title.toLowerCase();
  return RELEVANT_TITLE_KEYWORDS.some((kw) => lower.includes(kw));
}

export function scoreResults(
  results: MatchResults,
  sponsorshipCost?: number,
  costMultiplier: number = 2.5
): ScoreBreakdown {
  const details: string[] = [];

  // Overlap score (weight: 50%)
  const overlapScore = overlapToScore(results.overlapRate);
  const overlapGrade = toGrade(overlapScore);
  details.push(
    `${results.totalMatchedAccounts} of ${results.totalTargets} target accounts found in attendee list (${(results.overlapRate * 100).toFixed(1)}% overlap)`
  );

  // Contact quality (weight: 30%)
  let contactQualityScore: number | null = null;
  let contactQualityGrade: Grade | null = null;

  const matchesWithTitles = results.matches.filter((m) =>
    m.attendees.some((a) => a.title)
  );
  if (matchesWithTitles.length > 0) {
    const allMatchedAttendees = results.matches.flatMap((m) => m.attendees);
    const attendeesWithTitles = allMatchedAttendees.filter((a) => a.title);
    const relevantCount = attendeesWithTitles.filter((a) =>
      isTitleRelevant(a.title!)
    ).length;
    const titleRelevanceRate =
      attendeesWithTitles.length > 0
        ? relevantCount / attendeesWithTitles.length
        : 0;

    // Contact density score
    const avgPerMatch =
      results.totalMatchedAccounts > 0
        ? allMatchedAttendees.length / results.totalMatchedAccounts
        : 0;
    const densityScore = Math.min(100, avgPerMatch * 25); // 4+ attendees per account = 100

    // Combined
    const titleScore = titleRelevanceRate * 100;
    contactQualityScore = titleScore * 0.6 + densityScore * 0.4;
    contactQualityGrade = toGrade(contactQualityScore);

    details.push(
      `${(titleRelevanceRate * 100).toFixed(0)}% of attendees at matched accounts have relevant titles`
    );
    details.push(
      `Average ${avgPerMatch.toFixed(1)} attendees per matched account`
    );
  }

  // Cost efficiency (weight: 20%)
  let costScore: number | null = null;
  let costGrade: Grade | null = null;
  let costPerTarget: number | null = null;

  if (sponsorshipCost && results.totalMatchedAccounts > 0) {
    const fullyLoaded = sponsorshipCost * costMultiplier;
    costPerTarget = fullyLoaded / results.totalMatchedAccounts;
    costScore = costToScore(costPerTarget);
    costGrade = toGrade(costScore);
    details.push(
      `Estimated fully loaded cost: $${fullyLoaded.toLocaleString()} ($${costPerTarget.toLocaleString(undefined, { maximumFractionDigits: 0 })} per target account)`
    );
  }

  // Weighted overall score
  let overallScore: number;
  if (contactQualityScore !== null && costScore !== null) {
    overallScore =
      overlapScore * 0.5 + contactQualityScore * 0.3 + costScore * 0.2;
  } else if (contactQualityScore !== null) {
    overallScore = overlapScore * 0.6 + contactQualityScore * 0.4;
  } else if (costScore !== null) {
    overallScore = overlapScore * 0.7 + costScore * 0.3;
  } else {
    overallScore = overlapScore;
  }

  const grade = toGrade(overallScore);

  // Recommendation
  let recommendation: Recommendation;
  if (overallScore >= 85) {
    recommendation = "Strong yes";
  } else if (overallScore >= 65) {
    recommendation = "Likely yes";
  } else if (overallScore >= 45) {
    recommendation = "Maybe";
  } else if (overallScore >= 25) {
    recommendation = "Probably not";
  } else {
    recommendation = "Pass";
  }

  const avgAttendeesPerMatch =
    results.totalMatchedAccounts > 0
      ? results.matches.reduce((sum, m) => sum + m.attendees.length, 0) /
        results.totalMatchedAccounts
      : 0;

  return {
    overallScore: Math.round(overallScore),
    grade,
    recommendation,
    overlapScore: Math.round(overlapScore),
    overlapGrade,
    contactQualityScore:
      contactQualityScore !== null ? Math.round(contactQualityScore) : null,
    contactQualityGrade,
    costScore: costScore !== null ? Math.round(costScore) : null,
    costGrade,
    costPerTarget,
    avgAttendeesPerMatch,
    details,
  };
}
