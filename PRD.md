# Event sponsor scorer

## What is this?

A free, single-page web tool that helps event marketers answer: "Should I sponsor this event?" Upload your target account list and last year's attendee list, get a match score and a clear recommendation.

## Why this exists

Most event sponsorship decisions are made with gut feel plus a sales rep's pitch deck. Enterprise ABM platforms (6sense, Demandbase) can do account matching, but they cost $50K+/year. There's no lightweight, self-serve tool for this. The companies spending $50K-500K/year on events without an ABM platform are the audience.

## Core user flow

1. Upload target prospect list (CSV/Excel)
2. Upload event attendee list (CSV/Excel)
3. Map columns (the tool auto-detects but lets you confirm which column is company name, job title, etc.)
4. Hit "Score this event"
5. See results: overall score, matched accounts, match details, and a clear recommendation

## Inputs

### Target prospect list (required)
- Company name (required)
- Domain (optional, improves matching)
- Employee count or company size tier (optional, used for quality scoring)
- Industry (optional)
- Deal stage or account tier (optional, e.g. Tier 1/2/3 or "net-new"/"in-pipeline"/"customer")

### Event attendee list (required)
- Company name (required)
- Job title (optional, used for contact quality scoring)
- Seniority or level (optional)
- Department or function (optional)

### Event details (optional, entered manually)
- Sponsorship cost
- Estimated fully loaded multiplier (default: 2.5x, since fully loaded cost is typically 2-3x the listed price)
- Number of other sponsors
- Speaking slot included (yes/no)

## Scoring system

### Primary score: Account overlap (weight: 50%)

The most predictive single metric for B2B event sponsorship decisions.

```
overlap_rate = matched_target_accounts / total_target_accounts
```

Grading:
- A (90-100): >30% overlap
- B (70-89): 20-30% overlap
- C (50-69): 10-20% overlap
- D (25-49): 5-10% overlap
- F (0-24): <5% overlap

### Secondary score: Contact quality (weight: 30%)

Only calculated if job title/seniority data is available in the attendee list.

Sub-metrics:
- **Contact density**: Average number of attendees per matched account (more people from an account = stronger signal). >3 is great, 1 is weak.
- **Title relevance**: Percentage of matched attendees with relevant job titles. The tool should have a configurable "relevant titles" list with sensible defaults (Engineering, Product, CTO, VP Eng, etc.).
- **Seniority distribution**: Weighted score based on seniority levels present. For B2B SaaS: C-suite = 5, VP = 4, Director = 3, Manager = 2, IC = 1. For developer tools, senior ICs should be weighted higher (Staff/Senior/Principal = 3).

### Tertiary score: Cost efficiency (weight: 20%)

Only calculated if sponsorship cost is provided.

- **Cost per target account reached**: Fully loaded cost / number of matched accounts. Benchmark: <$1,500 is good, $1,500-2,500 is acceptable, >$2,500 needs strong justification.
- **Estimated pipeline multiple**: If average deal size is provided, calculate expected pipeline value vs. cost. The 3x pipeline rule: good events generate at least 3x their fully loaded cost in qualified pipeline.

### Overall recommendation

Based on composite weighted score, output one of:
- **Strong yes**: Go sponsor this event. High account overlap and good cost efficiency.
- **Likely yes**: The numbers look solid. Worth pursuing.
- **Maybe**: Moderate overlap. Worth it if there are strategic reasons (speaking slot, competitor presence, community credibility).
- **Probably not**: Low overlap or poor cost efficiency. Hard to justify on the numbers alone.
- **Pass**: Very low overlap. Your money is better spent elsewhere.

Quick decision thresholds (using account overlap as primary signal):
- Strong yes: >25% overlap AND cost per target account <$1,500
- Likely yes: >15% overlap AND cost per target account <$2,500
- Maybe: 10-15% overlap OR cost per target account $2,500-5,000
- Probably not: 5-10% overlap
- Pass: <5% overlap

## Matching algorithm

### Company name normalization (critical, solves ~70% of matching)
1. Lowercase everything
2. Strip common suffixes: Inc, LLC, Corp, Ltd, Co, Company, Group, Holdings, GmbH, SA, PLC, LP, LLP
3. Replace "&" with "and" (or vice versa, normalize to one)
4. Strip punctuation (periods, commas)
5. Strip "The" prefix
6. Trim whitespace, collapse multiple spaces

### Fuzzy matching
After normalization, use Fuse.js with a configurable similarity threshold (default: 0.3, where 0 is perfect match and 1 is no match). If matching quality isn't good enough with Fuse.js, swap in fuzzball's token_set_ratio, which handles word reordering better ("Chase JPMorgan" vs "JPMorgan Chase").

### Domain matching (bonus)
If both lists include domains, do an exact domain match as a high-confidence signal that supplements fuzzy name matching.

### User review step
Show all matches with confidence scores. Let users confirm, reject, or manually match. A table with: target account name, best match from attendee list, confidence score, and a confirm/reject toggle.

## Results display

### Summary card
- Overall score (letter grade + numeric) and recommendation
- Account overlap rate with grade
- Number of matched accounts / total target accounts
- Contact quality score (if data available)
- Cost per target account (if cost provided)

### Match detail table
- Target account name
- Matched attendee company name
- Match confidence (high/medium/low)
- Number of attendees from that company
- Job titles of attendees (if available)
- Confirm/reject toggle for each match

### Download
- Export results as CSV: all matches with scores, plus unmatched accounts from both lists

## Tech stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Expo (web-only) + Expo Router + TypeScript | Dogfooding Expo Web, file-based routing, SPA output mode |
| CSV parsing | PapaParse | Industry standard, streaming, lightweight |
| Excel parsing | SheetJS (dynamic import) | Client-side .xlsx support |
| Fuzzy matching | Fuse.js + normalization layer | Fast, configurable. Fallback: fuzzball token_set_ratio |
| UI | React DOM elements + Tailwind (or NativeWind) | Web-only project, no need for RN component abstraction layer |
| Hosting | EAS Hosting | Expo's own hosting service, simple deploy via `eas deploy` |
| Heavy computation | Web Worker | Keep UI responsive for large lists (>2K rows) |

### Expo web config
```json
{
  "expo": {
    "platforms": ["web"],
    "web": {
      "output": "single"
    }
  }
}
```

### Deploy
```
npx expo export --platform web
eas deploy
```

### Privacy
All processing happens client-side. No data is uploaded to any server. This is a key selling point for event marketers handling prospect lists and attendee data.

## Scope for v1

### In scope
- CSV and Excel file upload and parsing
- Auto-detect column mapping with manual override
- Company name normalization + fuzzy matching
- Account overlap score with letter grade
- Contact quality score (if title/seniority data present)
- Cost efficiency score (if cost provided)
- Overall recommendation
- Match review table with confirm/reject
- CSV export of results

### Out of scope (future)
- CRM integration (pull target list from HubSpot/Salesforce)
- Intent data enrichment
- Historical event comparison (score multiple events side by side)
- Domain enrichment via API (e.g. Clearbit)
- Saved lists or accounts
- Authentication or user accounts

## Open questions

1. Should there be a "developer tools mode" that weights senior ICs higher than the default B2B seniority weighting?
2. Should the tool suggest a maximum sponsorship price based on the overlap data (i.e., "based on match quality, this event is worth up to $X")?
3. Is there value in showing "accounts on the attendee list that are NOT on your target list but match your ICP criteria"? This could surface net-new opportunities.
