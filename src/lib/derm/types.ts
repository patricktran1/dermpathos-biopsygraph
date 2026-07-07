export type Priority = "Urgent" | "High" | "Moderate" | "Routine";

export type YesNo = "Yes" | "No" | "Not required";

export interface PathologyCase {
  id: string;
  patientName: string;
  age: number;
  dob?: string;
  reportDate?: string;
  biopsyDate: string;
  bodySite: string;
  biopsyType: string;
  pathologyResult: string;
  diagnosis: string;
  margins: string;
  patientNotified: YesNo;
  treatmentScheduled: YesNo;
  physician: string;
  clinicalDescription?: string;
  clinicalConcern?: string;
  clinicNoteExcerpt?: string;
  clinicalPhotoDataUrl?: string;
  pathologyImageDataUrl?: string;
  clinicalPhotoLabel?: string;
  pathologyImageLabel?: string;
  createdAt: number;
}


export interface CaseAssessment {
  priority: Priority;
  requiredAction: string;
  taskTitle: string;
  taskReason: string;
  dueTiming: string;
  flags: string[];
  graphPath: string[];
  isMalignant: boolean;
}

export interface FollowUpTask {
  caseId: string;
  title: string;
  priority: Priority;
  physician: string;
  dueTiming: string;
  reason: string;
  status: "Open" | "Complete";
}
