import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { AuditEvent, FollowUpTask, PathologyCase } from "./types";
import { assessCase } from "./logic";

const audit = (
  id: string,
  actor: AuditEvent["actor"],
  action: string,
  detail: string,
  at: string,
): AuditEvent => ({ id, actor, action, detail, at });

export const DEMO_CASES: PathologyCase[] = [
  {
    id: "case-sarah-miller",
    patientName: "Sarah Miller",
    age: 42,
    dob: "1984-05-12",
    reportDate: "2026-07-10",
    biopsyDate: "2026-07-01",
    bodySite: "Left upper back",
    biopsyType: "Shave biopsy",
    pathologyResult: "Melanoma in situ, extending to the peripheral margin.",
    diagnosis: "Melanoma in situ",
    margins: "Involved",
    patientNotified: "No",
    treatmentScheduled: "No",
    appointmentStatus: "Not scheduled",
    treatmentCompleted: "No",
    closureVerified: false,
    physician: "Dr. Tran",
    demoScenario: "lost-melanoma",
    auditTrail: [
      audit(
        "sarah-1",
        "System",
        "Pathology result received",
        "Final report posted to the pathology inbox.",
        "Jul 10 · 8:42 AM",
      ),
      audit(
        "sarah-2",
        "Agent",
        "Unresolved obligation detected",
        "No patient communication, referral, or treatment order found after four days.",
        "Jul 14 · 9:02 AM",
      ),
      audit(
        "sarah-3",
        "Agent",
        "Urgent escalation proposed",
        "Drafted outreach and an excision-planning task for clinician approval.",
        "Jul 14 · 9:03 AM",
      ),
    ],
    createdAt: 1,
  },
  {
    id: "case-robert-lee",
    patientName: "Robert Lee",
    age: 74,
    dob: "1952-11-08",
    reportDate: "2026-07-12",
    biopsyDate: "2026-07-08",
    bodySite: "Left cheek",
    scheduledBodySite: "Right cheek",
    biopsyType: "Shave biopsy",
    pathologyResult:
      "Squamous cell carcinoma, moderately differentiated, involving the deep margin.",
    diagnosis: "Squamous cell carcinoma",
    margins: "Involved",
    patientNotified: "Yes",
    lastPatientContactDate: "2026-07-13",
    treatmentScheduled: "Yes",
    appointmentStatus: "Scheduled",
    treatmentCompleted: "No",
    closureVerified: false,
    physician: "Dr. Tran",
    demoScenario: "wrong-site",
    auditTrail: [
      audit(
        "robert-1",
        "Clinic",
        "Patient notified",
        "SCC result and need for surgery documented by phone.",
        "Jul 13 · 11:16 AM",
      ),
      audit(
        "robert-2",
        "System",
        "Mohs request created",
        "Scheduling request entered for the right cheek.",
        "Jul 13 · 11:31 AM",
      ),
      audit(
        "robert-3",
        "Agent",
        "Unsafe automation blocked",
        "Pathology and scheduling laterality do not match.",
        "Jul 14 · 9:04 AM",
      ),
    ],
    createdAt: 2,
  },
  {
    id: "case-james-carter",
    patientName: "James Carter",
    age: 67,
    dob: "1959-03-14",
    reportDate: "2026-06-25",
    biopsyDate: "2026-06-20",
    bodySite: "Right nasal ala",
    scheduledBodySite: "Right nasal ala",
    biopsyType: "Shave biopsy",
    pathologyResult: "Basal cell carcinoma, nodular type, extending to the base.",
    diagnosis: "Basal cell carcinoma",
    margins: "Involved",
    patientNotified: "Yes",
    lastPatientContactDate: "2026-06-26",
    treatmentScheduled: "Yes",
    appointmentStatus: "Canceled",
    treatmentCompleted: "No",
    closureVerified: false,
    physician: "Dr. Tran",
    demoScenario: "false-closure",
    auditTrail: [
      audit(
        "james-1",
        "Clinic",
        "Patient notified",
        "BCC result reviewed and Mohs surgery recommended.",
        "Jun 26 · 2:18 PM",
      ),
      audit(
        "james-2",
        "System",
        "Treatment scheduled",
        "Mohs appointment created for July 9.",
        "Jun 26 · 2:34 PM",
      ),
      audit(
        "james-3",
        "System",
        "Appointment canceled",
        "Patient canceled through the portal. No replacement appointment found.",
        "Jul 8 · 6:47 PM",
      ),
      audit(
        "james-4",
        "Agent",
        "False closure detected",
        "Communication and scheduling occurred, but definitive treatment did not.",
        "Jul 14 · 9:05 AM",
      ),
    ],
    createdAt: 3,
  },
  {
    id: "case-emily-nguyen",
    patientName: "Emily Nguyen",
    age: 35,
    dob: "1991-09-22",
    reportDate: "2026-07-13",
    biopsyDate: "2026-07-09",
    bodySite: "Left forearm",
    biopsyType: "Punch biopsy",
    pathologyResult: "Benign compound nevus, completely removed.",
    diagnosis: "Benign nevus",
    margins: "Clear",
    patientNotified: "No",
    treatmentScheduled: "Not required",
    appointmentStatus: "Not required",
    treatmentCompleted: "Not required",
    closureVerified: false,
    physician: "Dr. Tran",
    demoScenario: "routine",
    auditTrail: [
      audit(
        "emily-1",
        "System",
        "Pathology result received",
        "Benign diagnosis routed to the routine communication queue.",
        "Jul 13 · 4:12 PM",
      ),
    ],
    createdAt: 4,
  },
];

interface StoreValue {
  cases: PathologyCase[];
  tasks: Record<string, FollowUpTask>;
  addCase: (input: Omit<PathologyCase, "id" | "createdAt">) => PathologyCase;
  loadDemoCases: () => void;
  resetDemo: () => void;
  applyAgentAction: (caseId: string, actionId: string) => void;
  completeTask: (caseId: string) => void;
  getCase: (id: string) => PathologyCase | undefined;
}

const StoreCtx = createContext<StoreValue | null>(null);

const cloneDemoCases = () =>
  DEMO_CASES.map((item) => ({
    ...item,
    auditTrail: item.auditTrail?.map((event) => ({ ...event })),
  }));

const createTask = (pathologyCase: PathologyCase): FollowUpTask => {
  const assessment = assessCase(pathologyCase);
  return {
    caseId: pathologyCase.id,
    title: assessment.taskTitle,
    priority: assessment.priority,
    physician: pathologyCase.physician,
    dueTiming: assessment.dueTiming,
    reason: assessment.taskReason,
    status: pathologyCase.closureVerified ? "Complete" : "Open",
  };
};

const slug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function DermStoreProvider({ children }: { children: ReactNode }) {
  const [cases, setCases] = useState<PathologyCase[]>([]);
  const [tasks, setTasks] = useState<Record<string, FollowUpTask>>({});

  const value = useMemo<StoreValue>(() => {
    const seedDemo = () => {
      const nextCases = cloneDemoCases();
      setCases(nextCases);
      setTasks(
        Object.fromEntries(nextCases.map((item) => [item.id, createTask(item)])),
      );
    };

    const addCase: StoreValue["addCase"] = (input) => {
      const caseId = `case-${slug(input.patientName || "patient")}-${Date.now()}`;
      const pathologyCase: PathologyCase = {
        ...input,
        id: caseId,
        appointmentStatus:
          input.appointmentStatus ??
          (input.treatmentScheduled === "Yes"
            ? "Scheduled"
            : input.treatmentScheduled === "Not required"
              ? "Not required"
              : "Not scheduled"),
        treatmentCompleted: input.treatmentCompleted ?? "No",
        closureVerified: input.closureVerified ?? false,
        auditTrail:
          input.auditTrail ??
          [
            audit(
              `${caseId}-created`,
              "Agent",
              "Clinical obligation created",
              "The pathology result was added to the local obligation queue and evaluated against closure rules.",
              new Date().toLocaleString(),
            ),
          ],
        createdAt: Date.now(),
      };
      setCases((previous) => [
        pathologyCase,
        ...previous.filter((item) => item.id !== pathologyCase.id),
      ]);
      setTasks((previous) => ({
        ...previous,
        [pathologyCase.id]: createTask(pathologyCase),
      }));
      return pathologyCase;
    };

    const applyAgentAction: StoreValue["applyAgentAction"] = (caseId, actionId) => {
      let updated: PathologyCase | undefined;
      setCases((previous) =>
        previous.map((pathologyCase) => {
          if (pathologyCase.id !== caseId) return pathologyCase;
          const now = new Date().toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          });
          let patch: Partial<PathologyCase> = {};
          let action = "Agent action completed";
          let detail = "The workflow was updated and re-evaluated.";

          switch (actionId) {
            case "notify-patient":
              patch = {
                patientNotified: "Yes",
                lastPatientContactDate: new Date().toISOString().slice(0, 10),
              };
              action = "Urgent outreach approved";
              detail =
                "Patient notification was documented. Definitive treatment planning remains open.";
              break;
            case "send-benign-message":
              patch = {
                patientNotified: "Yes",
                lastPatientContactDate: new Date().toISOString().slice(0, 10),
              };
              action = "Benign result message approved";
              detail = "Patient notification was documented using the clinic template.";
              break;
            case "resolve-site-conflict":
              patch = {
                scheduledBodySite: pathologyCase.bodySite,
                treatmentScheduled: "Yes",
                appointmentStatus: "Scheduled",
              };
              action = "Site conflict resolved";
              detail = `Clinician verified ${pathologyCase.bodySite} as the intended treatment site.`;
              break;
            case "reopen-canceled-care":
              patch = {
                treatmentScheduled: "No",
                appointmentStatus: "Not scheduled",
                closureVerified: false,
              };
              action = "Clinical obligation reopened";
              detail =
                "The canceled appointment was removed as closure evidence and returned to scheduling.";
              break;
            case "schedule-treatment":
              patch = {
                scheduledBodySite: pathologyCase.bodySite,
                treatmentScheduled: "Yes",
                appointmentStatus: "Scheduled",
              };
              action = "Treatment scheduling approved";
              detail = `A definitive treatment request was prepared for ${pathologyCase.bodySite}.`;
              break;
            case "verify-treatment":
              patch = {
                treatmentScheduled: "Yes",
                appointmentStatus: "Completed",
                treatmentCompleted: "Yes",
                treatmentDate: new Date().toISOString().slice(0, 10),
              };
              action = "Definitive treatment found";
              detail =
                "A completed procedure record was added to the evidence chain. Closure still requires verification.";
              break;
            case "verify-closure":
              patch = { closureVerified: true };
              action = "Clinical obligation closed";
              detail =
                "Notification, site consistency, and required treatment completion were verified.";
              break;
          }

          updated = {
            ...pathologyCase,
            ...patch,
            auditTrail: [
              ...(pathologyCase.auditTrail ?? []),
              audit(`${pathologyCase.id}-${Date.now()}`, "Clinic", action, detail, now),
            ],
          };
          return updated;
        }),
      );

      if (updated) {
        setTasks((previous) => ({
          ...previous,
          [caseId]: createTask(updated as PathologyCase),
        }));
      }
    };

    return {
      cases,
      tasks,
      addCase,
      loadDemoCases: seedDemo,
      resetDemo: seedDemo,
      applyAgentAction,
      completeTask: (caseId) =>
        setTasks((previous) =>
          previous[caseId]
            ? {
                ...previous,
                [caseId]: { ...previous[caseId], status: "Complete" },
              }
            : previous,
        ),
      getCase: (id) =>
        cases.find((item) => item.id === id) ??
        DEMO_CASES.find((item) => item.id === id),
    };
  }, [cases, tasks]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useDermStore() {
  const value = useContext(StoreCtx);
  if (!value) throw new Error("useDermStore must be used inside DermStoreProvider");
  return value;
}
