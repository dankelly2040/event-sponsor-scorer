import Fuse from "fuse.js";
import { normalizeCompanyName } from "./normalize";

export interface TargetAccount {
  originalName: string;
  normalizedName: string;
  domain?: string;
  tier?: string;
  rowData: Record<string, string>;
}

export interface Attendee {
  originalName: string;
  normalizedName: string;
  title?: string;
  seniority?: string;
  department?: string;
  rowData: Record<string, string>;
}

export interface Match {
  target: TargetAccount;
  attendees: Attendee[];
  bestScore: number; // 0 = perfect, 1 = no match
  matchedName: string;
}

export interface MatchResults {
  matches: Match[];
  unmatchedTargets: TargetAccount[];
  unmatchedAttendees: Attendee[];
  overlapRate: number;
  totalTargets: number;
  totalAttendees: number;
  totalMatchedAccounts: number;
}

export function buildTargetAccounts(
  rows: Record<string, string>[],
  companyCol: string,
  domainCol?: string,
  tierCol?: string
): TargetAccount[] {
  return rows
    .filter((row) => row[companyCol]?.trim())
    .map((row) => ({
      originalName: row[companyCol].trim(),
      normalizedName: normalizeCompanyName(row[companyCol]),
      domain: domainCol ? row[domainCol]?.trim() : undefined,
      tier: tierCol ? row[tierCol]?.trim() : undefined,
      rowData: row,
    }));
}

export function buildAttendees(
  rows: Record<string, string>[],
  companyCol: string,
  titleCol?: string,
  seniorityCol?: string,
  departmentCol?: string
): Attendee[] {
  return rows
    .filter((row) => row[companyCol]?.trim())
    .map((row) => ({
      originalName: row[companyCol].trim(),
      normalizedName: normalizeCompanyName(row[companyCol]),
      title: titleCol ? row[titleCol]?.trim() : undefined,
      seniority: seniorityCol ? row[seniorityCol]?.trim() : undefined,
      department: departmentCol ? row[departmentCol]?.trim() : undefined,
      rowData: row,
    }));
}

// Deduplicate attendees by normalized company name, returning unique company entries
// with all attendees grouped together
function groupAttendeesByCompany(
  attendees: Attendee[]
): Map<string, Attendee[]> {
  const groups = new Map<string, Attendee[]>();
  for (const a of attendees) {
    const key = a.normalizedName;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(a);
  }
  return groups;
}

export function matchAccounts(
  targets: TargetAccount[],
  attendees: Attendee[],
  threshold: number = 0.3
): MatchResults {
  const attendeeGroups = groupAttendeesByCompany(attendees);

  // Build a searchable list of unique attendee company names
  const uniqueCompanies = Array.from(attendeeGroups.entries()).map(
    ([normalized, group]) => ({
      normalizedName: normalized,
      originalName: group[0].originalName,
      attendees: group,
    })
  );

  const fuse = new Fuse(uniqueCompanies, {
    keys: ["normalizedName"],
    threshold,
    includeScore: true,
    isCaseSensitive: false,
  });

  const matches: Match[] = [];
  const unmatchedTargets: TargetAccount[] = [];
  const matchedAttendeeKeys = new Set<string>();

  for (const target of targets) {
    // Try exact normalized match first
    const exactMatch = uniqueCompanies.find(
      (c) => c.normalizedName === target.normalizedName
    );

    if (exactMatch) {
      matches.push({
        target,
        attendees: exactMatch.attendees,
        bestScore: 0,
        matchedName: exactMatch.originalName,
      });
      matchedAttendeeKeys.add(exactMatch.normalizedName);
      continue;
    }

    // Fuzzy match
    const results = fuse.search(target.normalizedName);
    if (results.length > 0 && results[0].score !== undefined) {
      const best = results[0];
      matches.push({
        target,
        attendees: best.item.attendees,
        bestScore: best.score!,
        matchedName: best.item.originalName,
      });
      matchedAttendeeKeys.add(best.item.normalizedName);
    } else {
      unmatchedTargets.push(target);
    }
  }

  const unmatchedAttendees: Attendee[] = [];
  for (const [key, group] of attendeeGroups) {
    if (!matchedAttendeeKeys.has(key)) {
      unmatchedAttendees.push(...group);
    }
  }

  const totalMatchedAccounts = matches.length;
  const overlapRate = targets.length > 0 ? totalMatchedAccounts / targets.length : 0;

  return {
    matches,
    unmatchedTargets,
    unmatchedAttendees,
    overlapRate,
    totalTargets: targets.length,
    totalAttendees: attendees.length,
    totalMatchedAccounts,
  };
}
