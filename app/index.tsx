import { useState, useCallback, useRef } from "react";
import {
  parseFile,
  guessCompanyColumn,
  guessTitleColumn,
  exportToCsv,
  ACCEPTED_FORMATS,
  FORMAT_LABEL,
} from "../lib/csv";
import {
  buildTargetAccounts,
  buildAttendees,
  matchAccounts,
  MatchResults,
  Match,
} from "../lib/matcher";
import { scoreResults, ScoreBreakdown, Grade } from "../lib/scorer";

type Step = "upload" | "map" | "results";

interface FileData {
  rows: Record<string, string>[];
  headers: string[];
  fileName: string;
}

// --- Score ring SVG component ---
function ScoreRing({
  score,
  size = 160,
  strokeWidth = 12,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color =
    score >= 85
      ? "#16a34a"
      : score >= 65
        ? "#65a30d"
        : score >= 45
          ? "#eab308"
          : score >= 25
            ? "#ea580c"
            : "#dc2626";

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f0f0f0"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: 44,
            fontWeight: 700,
            color: "#111",
            lineHeight: 1,
          }}
        >
          {score}
        </span>
        <span style={{ fontSize: 14, color: "#999", marginTop: 2 }}>/ 100</span>
      </div>
    </div>
  );
}

// --- Progress bar component ---
function ProgressBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div
      style={{
        width: "100%",
        height: 4,
        backgroundColor: "#f0f0f0",
        borderRadius: 2,
        marginTop: 6,
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          backgroundColor: color,
          borderRadius: 2,
        }}
      />
    </div>
  );
}

// --- File drop zone component ---
function FileDropZone({
  label,
  hint,
  fileData,
  onFile,
}: {
  label: string;
  hint: string;
  fileData: FileData | null;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      style={{
        flex: 1,
        border: fileData ? "2px solid #111" : "2px dashed #d4d4d4",
        borderRadius: 12,
        padding: "28px 24px",
        textAlign: "center",
        cursor: "pointer",
        backgroundColor: fileData ? "#fafafa" : "#fff",
        transition: "border-color 0.15s",
      }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_FORMATS}
        onChange={onFile}
        style={{ display: "none" }}
      />
      {fileData ? (
        <>
          <div style={{ fontSize: 20, marginBottom: 6 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ verticalAlign: "middle" }}>
              <path d="M9 12l2 2 4-4" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="12" r="10" stroke="#16a34a" strokeWidth="2"/>
            </svg>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>
            {fileData.fileName}
          </div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
            {fileData.rows.length.toLocaleString()} rows
          </div>
        </>
      ) : (
        <>
          <div style={{ marginBottom: 8 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="#bbb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>{label}</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4, lineHeight: 1.4 }}>{hint}</div>
        </>
      )}
    </div>
  );
}

// --- Grade color helper ---
function gradeColor(grade: Grade): string {
  const map: Record<Grade, string> = {
    A: "#16a34a",
    B: "#65a30d",
    C: "#eab308",
    D: "#ea580c",
    F: "#dc2626",
  };
  return map[grade];
}

function recColor(rec: string): string {
  const map: Record<string, string> = {
    "Strong yes": "#16a34a",
    "Likely yes": "#65a30d",
    Maybe: "#eab308",
    "Probably not": "#ea580c",
    Pass: "#dc2626",
  };
  return map[rec] || "#888";
}

function recLabel(rec: string): string {
  const map: Record<string, string> = {
    "Strong yes": "Strong yes",
    "Likely yes": "Likely yes",
    Maybe: "Needs justification",
    "Probably not": "Probably not",
    Pass: "Pass",
  };
  return map[rec] || rec;
}

// --- Main page ---
export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [targetData, setTargetData] = useState<FileData | null>(null);
  const [attendeeData, setAttendeeData] = useState<FileData | null>(null);

  const [targetCompanyCol, setTargetCompanyCol] = useState("");
  const [attendeeCompanyCol, setAttendeeCompanyCol] = useState("");
  const [attendeeTitleCol, setAttendeeTitleCol] = useState("");

  const [sponsorshipCost, setSponsorshipCost] = useState("");
  const [costMultiplier, setCostMultiplier] = useState("2.5");

  const [matchResults, setMatchResults] = useState<MatchResults | null>(null);
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown | null>(
    null
  );

  const threshold = 0.3;

  const handleFile = useCallback(
    async (
      e: React.ChangeEvent<HTMLInputElement>,
      setter: (data: FileData) => void,
      companySetter: (col: string) => void,
      titleSetter?: (col: string) => void
    ) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const rows = await parseFile(file);
      if (rows.length === 0) return;
      const headers = Object.keys(rows[0]);
      setter({ rows, headers, fileName: file.name });
      const guessedCompany = guessCompanyColumn(headers);
      if (guessedCompany) companySetter(guessedCompany);
      if (titleSetter) {
        const guessedTitle = guessTitleColumn(headers);
        if (guessedTitle) titleSetter(guessedTitle);
      }
    },
    []
  );

  const handleScore = useCallback(() => {
    if (!targetData || !attendeeData || !targetCompanyCol || !attendeeCompanyCol)
      return;
    const targets = buildTargetAccounts(targetData.rows, targetCompanyCol);
    const attendees = buildAttendees(
      attendeeData.rows,
      attendeeCompanyCol,
      attendeeTitleCol || undefined
    );
    const results = matchAccounts(targets, attendees, threshold);
    const cost = sponsorshipCost ? parseFloat(sponsorshipCost) : undefined;
    const multiplier = parseFloat(costMultiplier) || 2.5;
    const score = scoreResults(results, cost, multiplier);
    setMatchResults(results);
    setScoreBreakdown(score);
    setStep("results");
  }, [
    targetData,
    attendeeData,
    targetCompanyCol,
    attendeeCompanyCol,
    attendeeTitleCol,
    sponsorshipCost,
    costMultiplier,
  ]);

  const handleExport = useCallback(() => {
    if (!matchResults) return;
    const rows = matchResults.matches.map((m) => ({
      "Target account": m.target.originalName,
      "Matched attendee company": m.matchedName,
      "Match confidence":
        m.bestScore === 0 ? "Exact" : m.bestScore < 0.15 ? "High" : "Medium",
      "Attendees from company": String(m.attendees.length),
      Titles: m.attendees
        .map((a) => a.title)
        .filter(Boolean)
        .join("; "),
    }));
    exportToCsv(rows, "event-sponsor-matches.csv");
  }, [matchResults]);

  const handleReset = useCallback(() => {
    setStep("upload");
    setTargetData(null);
    setAttendeeData(null);
    setTargetCompanyCol("");
    setAttendeeCompanyCol("");
    setAttendeeTitleCol("");
    setSponsorshipCost("");
    setCostMultiplier("2.5");
    setMatchResults(null);
    setScoreBreakdown(null);
  }, []);

  // ================= RENDER =================

  // ---- UPLOAD STEP ----
  if (step === "upload") {
    return (
      <div style={s.page}>
        <div style={s.heroContainer}>
          {/* Badge */}
          <div style={s.badgeRow}>
            <span style={s.badge}>Sponsor Score</span>
          </div>

          {/* Heading */}
          <h1 style={s.heroH1}>
            Should I sponsor
            <br />
            this event?
          </h1>

          {/* Subtitle */}
          <p style={s.heroSubtitle}>
            Upload your target account list and the event's attendee list.
            <br />
            Get a score based on account overlap and contact quality.
          </p>

          {/* Upload zones */}
          <div style={s.uploadRow}>
            <FileDropZone
              label="Target accounts"
              hint={`Your prospect list. ${FORMAT_LABEL}`}
              fileData={targetData}
              onFile={(e) => handleFile(e, setTargetData, setTargetCompanyCol)}
            />
            <FileDropZone
              label="Event attendees"
              hint={`Attendee list from the organizer. ${FORMAT_LABEL}`}
              fileData={attendeeData}
              onFile={(e) =>
                handleFile(
                  e,
                  setAttendeeData,
                  setAttendeeCompanyCol,
                  setAttendeeTitleCol
                )
              }
            />
          </div>

          {/* CTA */}
          {targetData && attendeeData && (
            <button style={s.ctaButton} onClick={() => setStep("map")}>
              Score it &rarr;
            </button>
          )}

          <p style={s.privacyNote}>
            All processing happens in your browser. No data leaves your machine.
          </p>
        </div>
      </div>
    );
  }

  // ---- MAP STEP ----
  if (step === "map") {
    return (
      <div style={s.page}>
        <div style={s.container}>
          <div style={s.badgeRow}>
            <span style={s.badge}>Sponsor Score</span>
          </div>
          <h1 style={s.pageH1}>Confirm your columns</h1>
          <p style={s.pageSubtitle}>
            We auto-detected what we could. Adjust if needed.
          </p>

          <div style={s.card}>
            <div style={s.fieldGrid}>
              <div style={s.field}>
                <label style={s.label}>Target list: company name</label>
                <select
                  value={targetCompanyCol}
                  onChange={(e) => setTargetCompanyCol(e.target.value)}
                  style={s.select}
                >
                  <option value="">Select column</option>
                  {targetData?.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div style={s.field}>
                <label style={s.label}>Attendee list: company name</label>
                <select
                  value={attendeeCompanyCol}
                  onChange={(e) => setAttendeeCompanyCol(e.target.value)}
                  style={s.select}
                >
                  <option value="">Select column</option>
                  {attendeeData?.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div style={s.field}>
                <label style={s.label}>Attendee list: job title (optional)</label>
                <select
                  value={attendeeTitleCol}
                  onChange={(e) => setAttendeeTitleCol(e.target.value)}
                  style={s.select}
                >
                  <option value="">None</option>
                  {attendeeData?.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div style={{ ...s.card, marginTop: 12 }}>
            <div style={{ ...s.fieldGrid, gridTemplateColumns: "1fr 1fr" }}>
              <div style={s.field}>
                <label style={s.label}>Sponsorship cost ($)</label>
                <input
                  type="number"
                  value={sponsorshipCost}
                  onChange={(e) => setSponsorshipCost(e.target.value)}
                  placeholder="e.g. 25000"
                  style={s.textInput}
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>Cost multiplier</label>
                <input
                  type="number"
                  value={costMultiplier}
                  onChange={(e) => setCostMultiplier(e.target.value)}
                  step="0.5"
                  min="1"
                  max="5"
                  style={s.textInput}
                />
                <span style={s.fieldHint}>
                  Fully loaded cost = base price x this. Default 2.5x.
                </span>
              </div>
            </div>
          </div>

          <div style={s.buttonRow}>
            <button style={s.secondaryBtn} onClick={() => setStep("upload")}>
              Back
            </button>
            <button
              style={{
                ...s.ctaButton,
                opacity: targetCompanyCol && attendeeCompanyCol ? 1 : 0.5,
              }}
              onClick={handleScore}
              disabled={!targetCompanyCol || !attendeeCompanyCol}
            >
              Score this event &rarr;
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- RESULTS STEP ----
  if (step === "results" && scoreBreakdown && matchResults) {
    const overlapPct = matchResults.overlapRate * 100;

    return (
      <div style={s.page}>
        <div style={s.container}>
          {/* Top bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            <div>
              <span style={s.badge}>Sponsor Score</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={s.secondaryBtn} onClick={handleReset}>
                Score another
              </button>
              <button style={s.secondaryBtn} onClick={handleExport}>
                <span style={{ marginRight: 4 }}>&#8595;</span> Export
              </button>
            </div>
          </div>

          {/* Score card */}
          <div style={s.card}>
            <div style={s.scoreLayout}>
              {/* Left: ring */}
              <div style={s.ringColumn}>
                <ScoreRing score={scoreBreakdown.overallScore} />
                <div
                  style={{
                    marginTop: 12,
                    textAlign: "center",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      padding: "4px 14px",
                      borderRadius: 20,
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#fff",
                      backgroundColor: recColor(scoreBreakdown.recommendation),
                    }}
                  >
                    {recLabel(scoreBreakdown.recommendation)}
                  </span>
                  <p
                    style={{
                      fontSize: 13,
                      color: "#888",
                      marginTop: 6,
                    }}
                  >
                    {matchResults.totalMatchedAccounts} of{" "}
                    {matchResults.totalTargets} target accounts found
                  </p>
                </div>
              </div>

              {/* Right: sub-scores grid */}
              <div style={s.subScoreGrid}>
                {/* Account overlap */}
                <div style={s.subScoreItem}>
                  <div style={s.subScoreRow}>
                    <span style={s.subScoreLabel}>Account overlap</span>
                    <span style={s.subScoreFraction}>
                      {matchResults.totalMatchedAccounts}/
                      {matchResults.totalTargets}
                    </span>
                  </div>
                  <ProgressBar
                    value={matchResults.totalMatchedAccounts}
                    max={matchResults.totalTargets}
                    color={gradeColor(scoreBreakdown.overlapGrade)}
                  />
                </div>

                {/* Contact quality */}
                {scoreBreakdown.contactQualityScore !== null && (
                  <div style={s.subScoreItem}>
                    <div style={s.subScoreRow}>
                      <span style={s.subScoreLabel}>Contact quality</span>
                      <span style={s.subScoreFraction}>
                        {scoreBreakdown.contactQualityScore}/100
                      </span>
                    </div>
                    <ProgressBar
                      value={scoreBreakdown.contactQualityScore}
                      max={100}
                      color={gradeColor(scoreBreakdown.contactQualityGrade!)}
                    />
                  </div>
                )}

                {/* Cost efficiency */}
                {scoreBreakdown.costScore !== null && (
                  <div style={s.subScoreItem}>
                    <div style={s.subScoreRow}>
                      <span style={s.subScoreLabel}>Cost efficiency</span>
                      <span style={s.subScoreFraction}>
                        {scoreBreakdown.costScore}/100
                      </span>
                    </div>
                    <ProgressBar
                      value={scoreBreakdown.costScore}
                      max={100}
                      color={gradeColor(scoreBreakdown.costGrade!)}
                    />
                  </div>
                )}

                {/* Avg attendees */}
                <div style={s.subScoreItem}>
                  <div style={s.subScoreRow}>
                    <span style={s.subScoreLabel}>Avg attendees per account</span>
                    <span style={s.subScoreFraction}>
                      {scoreBreakdown.avgAttendeesPerMatch.toFixed(1)}
                    </span>
                  </div>
                  <ProgressBar
                    value={Math.min(scoreBreakdown.avgAttendeesPerMatch, 5)}
                    max={5}
                    color={
                      scoreBreakdown.avgAttendeesPerMatch >= 3
                        ? "#16a34a"
                        : scoreBreakdown.avgAttendeesPerMatch >= 1.5
                          ? "#eab308"
                          : "#ea580c"
                    }
                  />
                </div>

                {/* Cost per target */}
                {scoreBreakdown.costPerTarget !== null && (
                  <div style={s.subScoreItem}>
                    <div style={s.subScoreRow}>
                      <span style={s.subScoreLabel}>
                        Cost per target account
                      </span>
                      <span style={s.subScoreFraction}>
                        $
                        {scoreBreakdown.costPerTarget.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    </div>
                    <ProgressBar
                      value={Math.max(0, 5000 - scoreBreakdown.costPerTarget)}
                      max={5000}
                      color={
                        scoreBreakdown.costPerTarget <= 1500
                          ? "#16a34a"
                          : scoreBreakdown.costPerTarget <= 2500
                            ? "#eab308"
                            : "#ea580c"
                      }
                    />
                  </div>
                )}

                {/* Overlap % */}
                <div style={s.subScoreItem}>
                  <div style={s.subScoreRow}>
                    <span style={s.subScoreLabel}>Overlap rate</span>
                    <span style={s.subScoreFraction}>
                      {overlapPct.toFixed(1)}%
                    </span>
                  </div>
                  <ProgressBar
                    value={overlapPct}
                    max={100}
                    color={
                      overlapPct >= 25
                        ? "#16a34a"
                        : overlapPct >= 10
                          ? "#eab308"
                          : "#ea580c"
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Match table */}
          <div style={{ ...s.card, marginTop: 12 }}>
            <h2 style={s.sectionTitle}>
              Matched accounts ({matchResults.matches.length})
            </h2>
            <div style={{ overflowX: "auto" }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Target account</th>
                    <th style={s.th}>Matched company</th>
                    <th style={s.th}>Confidence</th>
                    <th style={s.th}>Attendees</th>
                    {attendeeTitleCol && <th style={s.th}>Titles</th>}
                  </tr>
                </thead>
                <tbody>
                  {matchResults.matches
                    .sort((a, b) => a.bestScore - b.bestScore)
                    .map((m: Match, i: number) => (
                      <tr key={i} style={i % 2 === 1 ? { backgroundColor: "#fafafa" } : {}}>
                        <td style={s.td}>{m.target.originalName}</td>
                        <td style={s.td}>{m.matchedName}</td>
                        <td style={s.td}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 10px",
                              borderRadius: 4,
                              fontSize: 12,
                              fontWeight: 600,
                              backgroundColor:
                                m.bestScore === 0
                                  ? "#dcfce7"
                                  : m.bestScore < 0.15
                                    ? "#dbeafe"
                                    : "#fef9c3",
                              color:
                                m.bestScore === 0
                                  ? "#166534"
                                  : m.bestScore < 0.15
                                    ? "#1e40af"
                                    : "#854d0e",
                            }}
                          >
                            {m.bestScore === 0
                              ? "Exact"
                              : m.bestScore < 0.15
                                ? "High"
                                : "Medium"}
                          </span>
                        </td>
                        <td style={s.td}>{m.attendees.length}</td>
                        {attendeeTitleCol && (
                          <td style={s.td}>
                            {m.attendees
                              .map((a) => a.title)
                              .filter(Boolean)
                              .slice(0, 3)
                              .join(", ")}
                            {m.attendees.filter((a) => a.title).length > 3 &&
                              ` +${m.attendees.filter((a) => a.title).length - 3} more`}
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Unmatched */}
          {matchResults.unmatchedTargets.length > 0 && (
            <div style={{ ...s.card, marginTop: 12 }}>
              <h2 style={s.sectionTitle}>
                Unmatched target accounts (
                {matchResults.unmatchedTargets.length})
              </h2>
              <p style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>
                These accounts from your target list were not found in the
                attendee list.
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                {matchResults.unmatchedTargets.map((t, i) => (
                  <span
                    key={i}
                    style={{
                      display: "inline-block",
                      padding: "4px 12px",
                      backgroundColor: "#f5f5f5",
                      borderRadius: 6,
                      fontSize: 13,
                      color: "#555",
                    }}
                  >
                    {t.originalName}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p style={s.footer}>
            All processing happens in your browser. No data leaves your machine.
          </p>
        </div>
      </div>
    );
  }

  return null;
}

// ================= STYLES =================
const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#fff",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    color: "#111",
  },

  // Hero (upload step)
  heroContainer: {
    maxWidth: 640,
    margin: "0 auto",
    padding: "80px 24px 48px",
    textAlign: "center",
  },
  badgeRow: {
    marginBottom: 20,
  },
  badge: {
    display: "inline-block",
    padding: "5px 14px",
    fontSize: 13,
    fontWeight: 500,
    color: "#555",
    backgroundColor: "#f5f5f5",
    borderRadius: 20,
    letterSpacing: "0.01em",
  },
  heroH1: {
    fontSize: 48,
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: "-0.03em",
    marginBottom: 16,
    color: "#111",
  },
  heroSubtitle: {
    fontSize: 16,
    color: "#666",
    lineHeight: 1.6,
    marginBottom: 36,
  },
  uploadRow: {
    display: "flex",
    gap: 12,
    marginBottom: 20,
  },
  ctaButton: {
    display: "inline-block",
    padding: "12px 32px",
    fontSize: 16,
    fontWeight: 600,
    backgroundColor: "#111",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    letterSpacing: "-0.01em",
  },
  privacyNote: {
    fontSize: 12,
    color: "#bbb",
    marginTop: 20,
  },

  // General page (map + results)
  container: {
    maxWidth: 820,
    margin: "0 auto",
    padding: "40px 24px 48px",
  },
  pageH1: {
    fontSize: 32,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 15,
    color: "#666",
    marginBottom: 24,
  },

  // Cards
  card: {
    backgroundColor: "#fff",
    border: "1px solid #e8e8e8",
    borderRadius: 12,
    padding: 24,
  },

  // Form
  fieldGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 16,
  },
  field: {
    display: "flex",
    flexDirection: "column",
  },
  label: {
    fontSize: 13,
    fontWeight: 500,
    color: "#555",
    marginBottom: 6,
  },
  select: {
    padding: "9px 12px",
    fontSize: 14,
    border: "1px solid #ddd",
    borderRadius: 8,
    backgroundColor: "#fff",
    appearance: "auto" as React.CSSProperties["appearance"],
    color: "#111",
  },
  textInput: {
    padding: "9px 12px",
    fontSize: 14,
    border: "1px solid #ddd",
    borderRadius: 8,
    color: "#111",
    boxSizing: "border-box" as const,
  },
  fieldHint: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  buttonRow: {
    display: "flex",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 20,
  },
  secondaryBtn: {
    padding: "9px 20px",
    fontSize: 14,
    fontWeight: 500,
    backgroundColor: "#fff",
    color: "#111",
    border: "1px solid #ddd",
    borderRadius: 8,
    cursor: "pointer",
  },

  // Score layout
  scoreLayout: {
    display: "flex",
    gap: 40,
    alignItems: "flex-start",
  },
  ringColumn: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    minWidth: 180,
  },
  subScoreGrid: {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px 32px",
  },
  subScoreItem: {},
  subScoreRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  subScoreLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: "#111",
  },
  subScoreFraction: {
    fontSize: 14,
    fontWeight: 500,
    color: "#888",
  },

  // Section titles
  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    marginTop: 0,
    marginBottom: 12,
  },

  // Table
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 14,
  },
  th: {
    textAlign: "left" as const,
    padding: "8px 12px",
    borderBottom: "2px solid #eee",
    fontWeight: 600,
    fontSize: 12,
    color: "#888",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  },
  td: {
    padding: "10px 12px",
    borderBottom: "1px solid #f3f3f3",
    color: "#333",
  },

  footer: {
    fontSize: 12,
    color: "#bbb",
    textAlign: "center" as const,
    marginTop: 32,
  },
};
