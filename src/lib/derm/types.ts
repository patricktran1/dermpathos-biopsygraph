export type Priority = "Urgent" | "High" | "Moderate" | "Routine";

export type YesNo = "Yes" | "No" | "Not required";

export type AppointmentStatus =
  | "Not scheduled"
  | "Scheduled"
  | "Canceled"
  | "Completed"
  | "Not required";

export type ObligationState =
  | "Critical gap"
  | "Blocked"
  | "In progress"
  | "Ready to close"
  | "Closed";

export type WorkflowStepStatus =
  | "complete"
  | "active"
  | "missing"
  | "blocked";

export interface AuditEvent {
  id: string;
  at: string;
  actor: "Agent" | "Clinic" | "System";
  action: string;
  detail: string;
}

export interface PathologyCase {
  id: string;
  patientName: string;
  age: number;
  dob?: string;
  reportDate?: string;
  biopsyDate: string;
  bodySite: string;
  scheduledBodySite?: string;
  biopsyType: string;
  pathologyResult: string;
  diagnosis: string;
  margins: string;
  patientNotified: YesNo;
  treatmentScheduled: YesNo;
  appointmentStatus?: AppointmentStatus;
  treatmentCompleted?: YesNo;
  closureVerified?: boolean;
  lastPatientContactDate?: string;
  treatmentDate?: string;
  physician: string;
  clinicalDescription?: string;
  clinicalConcern?: string;
  clinicNoteExcerpt?: string;
  clinicalPhotoDataUrl?: string;
  pathologyImageDataUrl?: string;
  clinicalPhotoLabel?: string;
  pathologyImageLabel?: string;
  demoScenario?: "lost-melanoma" | "wrong-site" | "false-closure" | "routine";
  auditTrail?: AuditEvent[];
  createdAt: number;
}

export interface EvidenceItem {
  label: string;
  value: string;
  source: string;
  tone?: "neutral" | "good" | "warning" | "danger";
}

export interface WorkflowStep {
  id: string;
  label: string;
  detail: string;
  status: WorkflowStepStatus;
}

export interface AgentAction {
  id: string;
  label: string;
  description: string;
  requiresApproval: boolean;
  kind: "draft" | "task" | "escalation" | "block" | "verify";
}

export interface CaseAssessment {
  priority: Priority;
  obligationState: ObligationState;
  headline: string;
  summary: string;
  requiredAction: string;
  taskTitle: string;
  taskReason: string;
  dueTiming: string;
  flags: string[];
  blockers: string[];
  graphPath: string[];
  evidence: EvidenceItem[];
  workflow: WorkflowStep[];
  actions: AgentAction[];
  isMalignant: boolean;
  requiresHumanReview: boolean;
  canClose: boolean;
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
