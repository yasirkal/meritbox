/**
 * Reference data.
 *
 * TGA_SAMPLE is a small, offline subset of the national register (training.gov.au) used for seeding
 * and demos. Load the full register with `npm run tga:import -- <file>` (see scripts/tga-import.ts) using
 * the official training.gov.au data export; check code currency on training.gov.au before issuing.
 */
export const TGA_SAMPLE: { code: string; title: string; kind: "Qualification" | "Unit" | "SkillSet" }[] = [
  { code: "BSB50420", title: "Diploma of Leadership and Management", kind: "Qualification" },
  { code: "ICT50220", title: "Diploma of Information Technology", kind: "Qualification" },
  { code: "CHC33021", title: "Certificate III in Individual Support", kind: "Qualification" },
  { code: "HLTAID011", title: "Provide First Aid", kind: "Unit" },
  { code: "HLTAID009", title: "Provide cardiopulmonary resuscitation", kind: "Unit" },
  { code: "CPCWHS1001", title: "Prepare to work safely in the construction industry", kind: "Unit" },
  { code: "SITXFSA005", title: "Use hygienic practices for food safety", kind: "Unit" },
  { code: "BSBCRT511", title: "Develop critical thinking in others", kind: "Unit" },
];

/** Australian Skills Classification (Jobs and Skills Australia) — core competencies. */
export const ASC_CORE_COMPETENCIES = [
  "Digital engagement",
  "Initiative and innovation",
  "Learning",
  "Numeracy",
  "Oral communication",
  "Planning and organising",
  "Problem solving",
  "Reading",
  "Teamwork",
  "Writing",
];

/** Subset of the Open Badges 3.0 AchievementType vocabulary most relevant to AU providers. */
export const ACHIEVEMENT_TYPES = [
  "MicroCredential",
  "Badge",
  "Certificate",
  "CertificateOfCompletion",
  "Competency",
  "Course",
  "Module",
  "Award",
  "Certification",
  "Diploma",
  "LearningProgram",
  "Assessment",
  "CoCurricular",
  "Fieldwork",
  "Membership",
] as const;

export const AQF_LEVELS: Record<number, string> = {
  1: "Certificate I",
  2: "Certificate II",
  3: "Certificate III",
  4: "Certificate IV",
  5: "Diploma",
  6: "Advanced Diploma / Associate Degree",
  7: "Bachelor Degree",
  8: "Bachelor Honours / Graduate Certificate / Graduate Diploma",
  9: "Masters Degree",
  10: "Doctoral Degree",
};

export const ASSESSMENT_TYPES = ["None", "Participation", "Formative", "Summative — knowledge", "Summative — practical", "Competency-based (VET)", "Portfolio"];
export const DELIVERY_MODES = ["Online", "Face to face", "Blended", "Workplace"];
