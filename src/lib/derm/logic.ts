import type {
  AgentAction,
  CaseAssessment,
  EvidenceItem,
  PathologyCase,
  Priority,
  WorkflowStep,
} from "./types";

const has = (s: string, ...needles: string[]) => {
  const l = s.toLowerCase();
  return needles.some((n) => l.includes(n.toLowerCase()));
};

const normalizeSite = (site: string | undefined) =>
  (site ?? "")
    .toLowerCase()
    .replace(/\bright\b/g, "r")
    .replace(/\bleft\b/g, "l")
    .replace(/[^a-z0-9]/g, "");

export function assessCase(c: PathologyCase): CaseAssessment {
  const dx = c.diagnosis;
  let priority: Priority = "Routine";
  let requiredAction = "Notify patient and document closure";
  let taskTitle = "Close pathology communication loop";
  let taskReason = "Every pathology result requires documented review and disposition.";
  let dueTiming = "Within 7 days";
  let isMalignant = false;

  if (has(dx, "melanoma")) {
    priority = "Urgent";
    requiredAction = "Urgent physician review, patient notification, and excision planning";
    taskTitle = "Urgent melanoma follow-up";
    taskReason =
      "Melanoma-related pathology requires rapid communication and verified definitive treatment.";
    dueTiming = "Within 24 hours";
    isMalignant = true;
  } else if (has(dx, "squamous", "scc")) {
    priority = "High";
    requiredAction = "Physician review and definitive surgical scheduling";
    taskTitle = "Close SCC treatment loop";
    taskReason =
      "SCC pathology requires timely treatment coordination and verified completion.";
    dueTiming = "Within 72 hours";
    isMalignant = true;
  } else if (has(dx, "basal", "bcc")) {
    priority = "Moderate";
    requiredAction = "Schedule and verify definitive treatment";
    taskTitle = "Close BCC treatment loop";
    taskReason =
      "BCC requires a documented treatment plan and confirmation that treatment occurred.";
    dueTiming = "Within 2 weeks";
    isMalignant = true;
  }

  const appointmentStatus =
    c.appointmentStatus ??
    (c.treatmentScheduled === "Yes"
      ? "Scheduled"
      : c.treatmentScheduled === "Not required"
        ? "Not required"
        : "Not scheduled");
  const treatmentComplete =
    c.treatmentCompleted === "Yes" || appointmentStatus === "Completed";
  const notificationComplete =
    c.patientNotified === "Yes" || c.patientNotified === "Not required";
  const scheduledSite = c.scheduledBodySite?.trim();
  const siteConflict = Boolean(
    scheduledSite && normalizeSite(scheduledSite) !== normalizeSite(c.bodySite),
  );
  const treatmentRequired = isMalignant;
  const canClose =
    notificationComplete &&
    !siteConflict &&
    (!treatmentRequired || treatmentComplete);
  const closureVerified = Boolean(c.closureVerified && canClose);

  const blockers: string[] = [];
  if (siteConflict) {
    blockers.push(
      `Laterality or site conflict: pathology says ${c.bodySite}; scheduling says ${scheduledSite}.`,
    );
  }
  if (appointmentStatus === "Canceled" && treatmentRequired) {
    blockers.push("The treatment appointment was canceled and no replacement is scheduled.");
  }

  const flags: string[] = [];
  if (!notificationComplete) flags.push("Patient notification missing");
  if (treatmentRequired && c.treatmentScheduled !== "Yes")
    flags.push("Definitive treatment not scheduled");
  if (treatmentRequired && !treatmentComplete)
    flags.push("Definitive treatment not verified");
  if (siteConflict) flags.push("Wrong-site risk");
  if (appointmentStatus === "Canceled") flags.push("False closure risk");

  let obligationState: CaseAssessment["obligationState"] = "In progress";
  if (closureVerified) obligationState = "Closed";
  else if (siteConflict) obligationState = "Blocked";
  else if (canClose) obligationState = "Ready to close";
  else if (
    isMalignant &&
    (!notificationComplete || appointmentStatus === "Canceled")
  )
    obligationState = "Critical gap";

  let headline = "Open clinical obligation";
  let summary = "The case remains open until communication and required care are verified.";

  if (c.demoScenario === "lost-melanoma") {
    headline = "Malignant result with no documented patient contact";
    summary =
      "The pathology result is clinically significant, but there is no evidence of notification, referral, or definitive treatment planning.";
  } else if (c.demoScenario === "wrong-site" || siteConflict) {
    headline = "Laterality conflict blocks automated scheduling";
    summary =
      "The agent found conflicting body sites and stopped the workflow before an unsafe order could move forward.";
  } else if (c.demoScenario === "false-closure" || appointmentStatus === "Canceled") {
    headline = "Scheduled is not the same as treated";
    summary =
      "The patient was contacted and an appointment was created, but the appointment was canceled. The clinical obligation must be reopened.";
  } else if (closureVerified) {
    headline = "Clinical obligation verified closed";
    summary =
      "The patient was notified and all required care is documented as completed.";
  } else if (!isMalignant) {
    headline = "Benign result awaiting documented communication";
    summary =
      "No treatment is required, but the result should not disappear without documented patient notification.";
  }

  const evidence: EvidenceItem[] = [
    {
      label: "Diagnosis",
      value: c.diagnosis || "Not specified",
      source: "Pathology report · Final diagnosis",
      tone: isMalignant ? "danger" : "good",
    },
    {
      label: "Biopsy site",
      value: c.bodySite,
      source: "Procedure note + specimen label",
      tone: siteConflict ? "danger" : "neutral",
    },
    ...(scheduledSite
      ? [
          {
            label: "Scheduled site",
            value: scheduledSite,
            source: "Scheduling order",
            tone: siteConflict ? ("danger" as const) : ("good" as const),
          },
        ]
      : []),
    {
      label: "Patient notification",
      value: c.patientNotified,
      source: "Communications log",
      tone: notificationComplete ? "good" : "danger",
    },
    {
      label: "Appointment",
      value: appointmentStatus,
      source: "Scheduling record",
      tone:
        appointmentStatus === "Canceled"
          ? "danger"
          : appointmentStatus === "Completed"
            ? "good"
            : "warning",
    },
    {
      label: "Definitive treatment",
      value: treatmentRequired
        ? treatmentComplete
          ? "Completed"
          : "Not verified"
        : "Not required",
      source: "Procedure records",
      tone: treatmentRequired && !treatmentComplete ? "warning" : "good",
    },
  ];

  const workflow: WorkflowStep[] = [
    {
      id: "result",
      label: "Result received",
      detail: c.reportDate
        ? `Pathology posted ${c.reportDate}`
        : "Pathology report available",
      status: "complete",
    },
    {
      id: "review",
      label: "Clinical review",
      detail: `${c.diagnosis || "Diagnosis"} routed to ${c.physician}`,
      status: "complete",
    },
    {
      id: "notify",
      label: "Patient notified",
      detail: notificationComplete
        ? c.lastPatientContactDate
          ? `Documented ${c.lastPatientContactDate}`
          : "Communication documented"
        : "No qualifying communication found",
      status: notificationComplete ? "complete" : "missing",
    },
    {
      id: "schedule",
      label: treatmentRequired ? "Treatment scheduled" : "Disposition recorded",
      detail: treatmentRequired
        ? appointmentStatus
        : "No further treatment required",
      status: siteConflict
        ? "blocked"
        : treatmentRequired
          ? c.treatmentScheduled === "Yes" && appointmentStatus !== "Canceled"
            ? "complete"
            : appointmentStatus === "Canceled"
              ? "missing"
              : "active"
          : "complete",
    },
    {
      id: "treatment",
      label: "Definitive care completed",
      detail: treatmentRequired
        ? treatmentComplete
          ? c.treatmentDate
            ? `Completed ${c.treatmentDate}`
            : "Procedure documented"
          : "No completed procedure found"
        : "Not required",
      status: siteConflict
        ? "blocked"
        : treatmentRequired
          ? treatmentComplete
            ? "complete"
            : "missing"
          : "complete",
    },
    {
      id: "closure",
      label: "Closure verified",
      detail: closureVerified
        ? "All required evidence is present"
        : canClose
          ? "Ready for human verification"
          : "Waiting on required evidence",
      status: closureVerified ? "complete" : canClose ? "active" : "missing",
    },
  ];

  const actions: AgentAction[] = [];
  if (siteConflict) {
    actions.push({
      id: "resolve-site-conflict",
      label: "Resolve site conflict",
      description:
        "Require a clinician to verify the intended site before the scheduling workflow resumes.",
      requiresApproval: true,
      kind: "block",
    });
  } else {
    if (!notificationComplete) {
      actions.push({
        id: isMalignant ? "notify-patient" : "send-benign-message",
        label: isMalignant ? "Approve urgent outreach" : "Approve result message",
        description: isMalignant
          ? "Create a high-priority staff task and a clinician-reviewed patient outreach draft."
          : "Send the clinic-approved benign result template and document delivery.",
        requiresApproval: true,
        kind: isMalignant ? "escalation" : "draft",
      });
    }
    if (appointmentStatus === "Canceled") {
      actions.push({
        id: "reopen-canceled-care",
        label: "Reopen obligation",
        description:
          "Remove the false closed state and return the case to the treatment scheduling queue.",
        requiresApproval: false,
        kind: "task",
      });
    }
    if (
      treatmentRequired &&
      (c.treatmentScheduled !== "Yes" || appointmentStatus === "Canceled")
    ) {
      actions.push({
        id: "schedule-treatment",
        label: "Approve treatment scheduling",
        description:
          "Create the correct appointment request using the verified diagnosis and biopsy site.",
        requiresApproval: true,
        kind: "task",
      });
    }
    if (
      treatmentRequired &&
      c.treatmentScheduled === "Yes" &&
      appointmentStatus !== "Canceled" &&
      !treatmentComplete
    ) {
      actions.push({
        id: "verify-treatment",
        label: "Simulate completed treatment",
        description:
          "Record definitive treatment, then re-evaluate whether the obligation can close.",
        requiresApproval: false,
        kind: "verify",
      });
    }
    if (canClose && !closureVerified) {
      actions.push({
        id: "verify-closure",
        label: "Verify closure",
        description:
          "Confirm the evidence chain and close the clinical obligation with an audit event.",
        requiresApproval: true,
        kind: "verify",
      });
    }
  }

  const graphPath = [
    "Patient",
    "Biopsy",
    "Pathology Result",
    c.diagnosis || "Diagnosis",
    notificationComplete ? "Patient Notified" : "Notification Missing",
    ...(siteConflict
      ? ["Site Conflict", "Automation Blocked"]
      : treatmentRequired
        ? [
            c.treatmentScheduled === "Yes" && appointmentStatus !== "Canceled"
              ? "Treatment Scheduled"
              : "Scheduling Gap",
            treatmentComplete ? "Treatment Completed" : "Treatment Unverified",
          ]
        : ["No Treatment Required"]),
    closureVerified ? "Verified Closure" : "Open Clinical Obligation",
  ];

  return {
    priority,
    obligationState,
    headline,
    summary,
    requiredAction,
    taskTitle,
    taskReason,
    dueTiming,
    flags,
    blockers,
    graphPath,
    evidence,
    workflow,
    actions,
    isMalignant,
    requiresHumanReview: siteConflict || actions.some((a) => a.requiresApproval),
    canClose,
  };
}

export const priorityRank: Record<Priority, number> = {
  Urgent: 0,
  High: 1,
  Moderate: 2,
  Routine: 3,
};
