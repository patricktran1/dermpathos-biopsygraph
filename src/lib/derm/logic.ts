import type { CaseAssessment, PathologyCase, Priority } from "./types";

const has = (s: string, ...needles: string[]) => {
  const l = s.toLowerCase();
  return needles.some((n) => l.includes(n.toLowerCase()));
};

export function assessCase(c: PathologyCase): CaseAssessment {
  const dx = c.diagnosis;
  let priority: Priority = "Routine";
  let requiredAction = "Notify patient of benign result";
  let taskTitle = "Create benign notification task";
  let taskReason = "Benign results still require closed-loop documentation.";
  let dueTiming = "Within 7 days";
  let graphPath: string[] = [];
  let isMalignant = false;

  if (has(dx, "melanoma")) {
    priority = "Urgent";
    requiredAction = "Physician review and excision scheduling";
    taskTitle = "Urgent physician review — melanoma pathology";
    taskReason =
      "Melanoma-related pathology requires documented follow-up and definitive treatment planning.";
    dueTiming = "Within 24 hours";
    isMalignant = true;
    graphPath = [
      "Patient",
      "Lesion",
      "Biopsy",
      "Pathology Result",
      "Melanoma in Situ",
      "Required Excision",
      "Patient Not Notified",
      "No Treatment Scheduled",
      "Urgent Physician Review Task",
    ];
  } else if (has(dx, "squamous", "scc")) {
    priority = "High";
    requiredAction = "Physician review and surgical scheduling";
    taskTitle = "Surgical scheduling — SCC";
    taskReason =
      "SCC pathology requires timely treatment coordination and patient notification.";
    dueTiming = "Within 72 hours";
    isMalignant = true;
    graphPath = [
      "Patient",
      "Lesion",
      "Biopsy",
      "Pathology Result",
      "Squamous Cell Carcinoma",
      "Treatment Required",
      "Patient Not Notified",
      "Surgical Scheduling Task",
    ];
  } else if (has(dx, "basal", "bcc")) {
    priority = "Moderate";
    requiredAction = "Mohs or excision scheduling depending on site";
    taskTitle = "Treatment scheduling — BCC";
    taskReason =
      "BCC requires treatment planning, especially on cosmetically sensitive or high-risk sites.";
    dueTiming = "Within 2 weeks";
    isMalignant = true;
    graphPath = [
      "Patient",
      "Lesion",
      "Biopsy",
      "Pathology Result",
      "Basal Cell Carcinoma",
      "Treatment Required",
      "Mohs / Excision Scheduling",
      "Open Task",
    ];
  } else if (has(dx, "benign", "nevus")) {
    priority = "Routine";
    requiredAction = "Notify patient of benign result";
    taskTitle = "Benign result notification";
    taskReason = "Benign results still require closed-loop documentation.";
    dueTiming = "Within 7 days";
    graphPath = [
      "Patient",
      "Lesion",
      "Biopsy",
      "Pathology Result",
      "Benign Nevus",
      "No Treatment Required",
      "Patient Notification Task",
    ];
  } else {
    graphPath = [
      "Patient",
      "Lesion",
      "Biopsy",
      "Pathology Result",
      c.diagnosis || "Diagnosis",
      "Follow-Up Task",
    ];
  }

  const flags: string[] = [];
  if (c.patientNotified === "No") flags.push("Patient notification pending");
  if (c.treatmentScheduled === "No" && isMalignant)
    flags.push("Treatment scheduling gap");

  return {
    priority,
    requiredAction,
    taskTitle,
    taskReason,
    dueTiming,
    flags,
    graphPath,
    isMalignant,
  };
}

export const priorityRank: Record<Priority, number> = {
  Urgent: 0,
  High: 1,
  Moderate: 2,
  Routine: 3,
};
