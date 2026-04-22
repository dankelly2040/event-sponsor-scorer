const SUFFIXES = [
  "inc",
  "incorporated",
  "llc",
  "llp",
  "lp",
  "corp",
  "corporation",
  "ltd",
  "limited",
  "co",
  "company",
  "group",
  "holdings",
  "gmbh",
  "sa",
  "plc",
  "ag",
  "pty",
  "pte",
  "bv",
  "nv",
  "srl",
  "sarl",
];

const SUFFIX_PATTERN = new RegExp(
  `\\b(${SUFFIXES.join("|")})\\b\\.?`,
  "gi"
);

export function normalizeCompanyName(name: string): string {
  let n = name.toLowerCase().trim();

  // Strip "the" prefix
  n = n.replace(/^the\s+/, "");

  // Normalize ampersand
  n = n.replace(/&/g, "and");

  // Strip suffixes
  n = n.replace(SUFFIX_PATTERN, "");

  // Strip punctuation
  n = n.replace(/[.,\-'"()]/g, " ");

  // Collapse whitespace
  n = n.replace(/\s+/g, " ").trim();

  return n;
}
