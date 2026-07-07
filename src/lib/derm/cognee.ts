import type { PathologyCase, FollowUpTask } from "./types";
import type { CaseSyncStatus } from "./store";
import { assessCase } from "./logic";

export interface CogneeMemoryPayload {
  memory_type: "dermatology_pathology_follow_up_case";
  source: "DermPathOS";
  patient_name: string;
  dob: string;
  biopsy_date: string;
  case_id: string;
  site: string;
  diagnosis: string;
  margins: string;
  priority: string;
  required_action: string;
  task_status: string;
  butterbase: {
    biopsy_case_saved: boolean;
    follow_up_task_saved: boolean;
  };
  biopsygraph: {
    graph_synced: boolean;
    verified: boolean;
  };
  rocketride: {
    status: string;
  };
  clinical_context: {
    clinical_description: string;
    clinical_concern: string;
    clinic_note_excerpt: string;
  };
  visual_evidence: {
    clinical_photo_present: boolean;
    pathology_image_present: boolean;
    clinical_photo_label: string;
    pathology_image_label: string;
  };
  memory_summary: string;
}

function summarize(
  c: PathologyCase,
  priority: string,
  requiredAction: string,
): string {
  const dx = c.diagnosis || "Unclassified pathology";
  if (priority === "Urgent") {
    return `High-risk dermatology pathology follow-up case (${dx}) requiring urgent physician review and documented treatment planning.`;
  }
  if (priority === "High") {
    return `High-priority dermatology pathology follow-up case (${dx}) requiring timely treatment coordination: ${requiredAction}.`;
  }
  if (priority === "Moderate") {
    return `Moderate-priority dermatology pathology follow-up case (${dx}) tracked for treatment scheduling: ${requiredAction}.`;
  }
  return `Routine dermatology pathology follow-up case (${dx}) tracked for closed-loop patient notification.`;
}

export function buildCogneeMemory(
  c: PathologyCase,
  sync: CaseSyncStatus | undefined,
  task: FollowUpTask | undefined,
): CogneeMemoryPayload {
  const a = assessCase(c);
  return {
    memory_type: "dermatology_pathology_follow_up_case",
    source: "DermPathOS",
    patient_name: c.patientName,
    dob: c.dob ?? "",
    biopsy_date: c.biopsyDate,
    case_id: sync?.caseKey ?? c.id,
    site: c.bodySite,
    diagnosis: c.diagnosis,
    margins: c.margins,
    priority: a.priority,
    required_action: a.requiredAction,
    task_status: task?.status ?? "Open",
    butterbase: {
      biopsy_case_saved: sync?.butterbaseCaseSaved ?? false,
      follow_up_task_saved: sync?.butterbaseTaskSaved ?? false,
    },
    biopsygraph: {
      graph_synced: sync?.graphSynced ?? false,
      verified: sync?.graphVerified ?? false,
    },
    rocketride: {
      status: sync?.rocketrideStatus ?? "pending_configuration",
    },
    clinical_context: {
      clinical_description: c.clinicalDescription ?? "",
      clinical_concern: c.clinicalConcern ?? "",
      clinic_note_excerpt: c.clinicNoteExcerpt ?? "",
    },
    visual_evidence: {
      clinical_photo_present: Boolean(c.clinicalPhotoDataUrl),
      pathology_image_present: Boolean(c.pathologyImageDataUrl),
      clinical_photo_label: c.clinicalPhotoLabel ?? "",
      pathology_image_label: c.pathologyImageLabel ?? "",
    },
    memory_summary: summarize(c, a.priority, a.requiredAction),
  };
}
