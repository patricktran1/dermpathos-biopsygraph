import type { PathologyCase } from "./types";

export type ParsedFields = Partial<
  Pick<
    PathologyCase,
    | "patientName"
    | "age"
    | "dob"
    | "reportDate"
    | "biopsyDate"
    | "bodySite"
    | "biopsyType"
    | "pathologyResult"
    | "diagnosis"
    | "margins"
    | "physician"
    | "clinicalDescription"
    | "clinicalConcern"
    | "clinicNoteExcerpt"
  >
>;


const firstMatch = (text: string, patterns: RegExp[]): string | null => {
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return null;
};

const cleanLine = (s: string) =>
  s
    .replace(/[\r\n].*$/s, "")
    .replace(/\s{2,}/g, " ")
    .trim();

function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    let [, mo, d, y] = m;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

const DX_PRIORITY: { key: RegExp; label: string; rank: number }[] = [
  { key: /\bmelanoma\b(?!\s+in\s+situ)/i, label: "Melanoma", rank: 100 },
  { key: /\bmelanoma\s+in\s+situ\b/i, label: "Melanoma in situ", rank: 90 },
  { key: /\b(squamous cell carcinoma|scc)\b/i, label: "Squamous cell carcinoma", rank: 80 },
  { key: /\b(basal cell carcinoma|bcc)\b/i, label: "Basal cell carcinoma", rank: 70 },
  { key: /\bdysplastic nevus\b/i, label: "Dysplastic nevus", rank: 60 },
  { key: /\bactinic keratosis\b/i, label: "Actinic keratosis", rank: 50 },
  { key: /\bcompound nevus\b/i, label: "Compound nevus", rank: 30 },
  { key: /\bintradermal nevus\b/i, label: "Intradermal nevus", rank: 30 },
  { key: /\bseborrheic keratosis\b/i, label: "Seborrheic keratosis", rank: 20 },
  { key: /\bbenign nevus\b/i, label: "Benign nevus", rank: 10 },
];

export function parsePathologyReport(text: string): ParsedFields {
  const out: ParsedFields = {};
  if (!text || !text.trim()) return out;

  const t = text.replace(/\r\n/g, "\n");

  // Patient
  const patient = firstMatch(t, [
    /^\s*(?:Patient(?:\s*Name)?|Name|Pt)\s*[:\-]\s*(.+)$/im,
  ]);
  if (patient) out.patientName = cleanLine(patient);

  // Age (explicit Age: only, ignore DOB)
  const ageStr = firstMatch(t, [/^\s*Age\s*[:\-]\s*(\d{1,3})/im]);
  if (ageStr) {
    const n = Number(ageStr);
    if (n > 0 && n < 130) out.age = n;
  }

  // DOB / Date of Birth / Birthdate / Patient DOB
  const dobRaw = firstMatch(t, [
    /^\s*(?:Patient\s*DOB|Date\s*of\s*Birth|Birth\s*date|Birthdate|DOB)\s*[:\-]\s*(.+)$/im,
  ]);
  if (dobRaw) {
    const norm = normalizeDate(cleanLine(dobRaw));
    if (norm) out.dob = norm;
  }

  // Biopsy / procedure / collection / service date
  const biopsyRaw = firstMatch(t, [
    /^\s*(?:Biopsy\s*Date|Date\s*of\s*Biopsy|Collection\s*Date|Collected|Specimen\s*Date|Procedure\s*Date|Date\s*of\s*Service|DOS)\s*[:\-]\s*(.+)$/im,
  ]);
  if (biopsyRaw) {
    const norm = normalizeDate(cleanLine(biopsyRaw));
    if (norm) out.biopsyDate = norm;
  }

  // Report / signed-out date (separate)
  const reportRaw = firstMatch(t, [
    /^\s*(?:Report\s*Date|Date\s*Reported|Reported|Signed(?:\s*Out)?|Sign(?:ed)?\s*Out\s*Date)\s*[:\-]\s*(.+)$/im,
  ]);
  if (reportRaw) {
    const norm = normalizeDate(cleanLine(reportRaw));
    if (norm) out.reportDate = norm;
  }


  // Body site
  const site = firstMatch(t, [
    /^\s*(?:Anatomic\s*Site|Specimen\s*Site|Body\s*Site|Location|Specimen|Site)\s*[:\-]\s*(.+)$/im,
  ]);
  if (site) out.bodySite = cleanLine(site);

  // Biopsy type
  const biopsyTypes = [
    { re: /\bshave biopsy\b/i, label: "Shave biopsy" },
    { re: /\bpunch biopsy\b/i, label: "Punch biopsy" },
    { re: /\bexcisional biopsy\b/i, label: "Excisional biopsy" },
    { re: /\bincisional biopsy\b/i, label: "Incisional biopsy" },
  ];
  for (const b of biopsyTypes) {
    if (b.re.test(t)) {
      out.biopsyType = b.label;
      break;
    }
  }

  // Diagnosis: prefer labeled, then infer highest priority
  const dxLabeled = firstMatch(t, [
    /^\s*(?:Final\s*Diagnosis|Pathologic\s*Diagnosis|Microscopic\s*Diagnosis|Diagnosis|Assessment)\s*[:\-]\s*(.+)$/im,
  ]);
  let bestDx: { label: string; rank: number } | null = null;
  const searchScope = dxLabeled ?? t;
  for (const d of DX_PRIORITY) {
    if (d.key.test(searchScope)) {
      if (!bestDx || d.rank > bestDx.rank) bestDx = { label: d.label, rank: d.rank };
    }
  }
  if (bestDx) {
    out.diagnosis = dxLabeled ? cleanLine(dxLabeled) : bestDx.label;
    // If labeled but doesn't match a known dx keyword, still keep labeled text
    if (dxLabeled && !bestDx) out.diagnosis = cleanLine(dxLabeled);
  } else if (dxLabeled) {
    out.diagnosis = cleanLine(dxLabeled);
  }

  // Margins
  const marginLabeled = firstMatch(t, [
    /^\s*(?:Margin\s*Status|Margins|Peripheral\s*margin|Deep\s*margin|Base|Edges)\s*[:\-]\s*(.+)$/im,
  ]);
  const marginScope = marginLabeled ?? t;
  const involved = /\b(transected|extends to base|extends to peripheral margin|present at margin|positive|involved)\b/i.test(
    marginScope,
  );
  const clear = /\b(completely excised|completely removed|narrowly clear|clear|negative)\b/i.test(
    marginScope,
  );
  if (involved) out.margins = "Involved / transected";
  else if (clear) out.margins = "Clear";
  else if (marginLabeled) out.margins = cleanLine(marginLabeled);

  // Physician
  const phys = firstMatch(t, [
    /^\s*(?:Responsible\s*Physician|Ordering\s*Physician|Physician|Provider|Doctor)\s*[:\-]\s*(.+)$/im,
  ]);
  if (phys) out.physician = cleanLine(phys);

  // Clinical context (optional)
  const clinDesc = firstMatch(t, [
    /^\s*(?:Clinical\s*Description|Clinical\s*Findings|Clinical\s*History|Clinical\s*Presentation|History)\s*[:\-]\s*(.+)$/im,
  ]);
  if (clinDesc) out.clinicalDescription = cleanLine(clinDesc);

  const concern = firstMatch(t, [
    /^\s*(?:Clinical\s*Concern|Rule\s*Out|Rule[-\s]*Out|Impression|Differential|Suspected)\s*[:\-]\s*(.+)$/im,
  ]);
  if (concern) out.clinicalConcern = cleanLine(concern);

  const noteExcerpt = firstMatch(t, [
    /^\s*(?:Clinic\s*Note|Clinic\s*Note\s*Excerpt|Note\s*Excerpt|Provider\s*Note)\s*[:\-]\s*(.+)$/im,
  ]);
  if (noteExcerpt) out.clinicNoteExcerpt = cleanLine(noteExcerpt);

  // Full text into pathologyResult
  out.pathologyResult = text.trim();

  return out;
}

export const FIELD_LABELS: Record<keyof ParsedFields, string> = {
  patientName: "Patient",
  age: "Age",
  dob: "DOB",
  reportDate: "Report date",
  biopsyDate: "Biopsy date",

  bodySite: "Site",
  biopsyType: "Biopsy type",
  pathologyResult: "Pathology result",
  diagnosis: "Diagnosis",
  margins: "Margins",
  physician: "Physician",
  clinicalDescription: "Clinical description",
  clinicalConcern: "Clinical concern / rule-out",
  clinicNoteExcerpt: "Clinic note excerpt",
};
