import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { FollowUpTask, PathologyCase } from "./types";
import { assessCase } from "./logic";
import { submitCaseAndTask } from "./integrations";
import { buildCaseKey } from "./butterbase";

export type CaseSyncMode = "butterbase_and_graph" | "local_demo";

export interface CaseSyncStatus {
  mode: CaseSyncMode;
  caseKey: string;
  taskKey?: string;
  butterbaseCaseSaved: boolean;
  butterbaseTaskSaved: boolean;
  graphSynced: boolean;
  graphVerified: boolean;
  partialSuccess?: boolean;
  graphError?: string;
  rocketrideStatus?: "complete" | "completed" | "triggered" | "failed" | "pending_configuration" | "missing_configuration" | "timeout_nonblocking";
  rocketrideMessage?: string;
  rocketrideResponse?: unknown;
  lastResponse?: unknown;
}

export const DEMO_CASES: PathologyCase[] = [
  {
    id: "case-sarah-miller",
    patientName: "Sarah Miller",
    age: 42,
    dob: "1984-05-12",
    biopsyDate: "2026-07-01",
    bodySite: "Left upper back",
    biopsyType: "Shave biopsy",
    pathologyResult: "Melanoma in situ, margins involved.",
    diagnosis: "Melanoma in situ",
    margins: "Involved",
    patientNotified: "No",
    treatmentScheduled: "No",
    physician: "Dr. Tran",
    createdAt: 1,
  },
  {
    id: "case-james-carter",
    patientName: "James Carter",
    age: 67,
    dob: "1959-03-14",
    biopsyDate: "2026-07-02",
    bodySite: "Right nasal ala",
    biopsyType: "Shave biopsy",
    pathologyResult: "Basal cell carcinoma, nodular type, extending to base.",
    diagnosis: "Basal cell carcinoma",
    margins: "Involved",
    patientNotified: "Yes",
    treatmentScheduled: "No",
    physician: "Dr. Tran",
    createdAt: 2,
  },
  {
    id: "case-emily-nguyen",
    patientName: "Emily Nguyen",
    age: 35,
    dob: "1991-09-22",
    biopsyDate: "2026-07-03",
    bodySite: "Left forearm",
    biopsyType: "Punch biopsy",
    pathologyResult: "Benign compound nevus, completely removed.",
    diagnosis: "Benign nevus",
    margins: "Clear",
    patientNotified: "No",
    treatmentScheduled: "Not required",
    physician: "Dr. Tran",
    createdAt: 3,
  },
  {
    id: "case-robert-lee",
    patientName: "Robert Lee",
    age: 74,
    dob: "1952-11-08",
    biopsyDate: "2026-07-01",
    bodySite: "Vertex scalp",
    biopsyType: "Shave biopsy",
    pathologyResult:
      "Squamous cell carcinoma, moderately differentiated, transected at base.",
    diagnosis: "Squamous cell carcinoma",
    margins: "Involved",
    patientNotified: "No",
    treatmentScheduled: "No",
    physician: "Dr. Tran",
    createdAt: 4,
  },
];

export interface AddCaseResult {
  case: PathologyCase;
  butterbaseAttempted: boolean;
  caseOk: boolean;
  taskOk: boolean;
  graphSynced: boolean;
  graphVerified: boolean;
  errors: string[];
  sync: CaseSyncStatus;
}

interface StoreValue {
  cases: PathologyCase[];
  tasks: Record<string, FollowUpTask>;
  syncStatus: Record<string, CaseSyncStatus>;
  addCase: (
    c: Omit<PathologyCase, "id" | "createdAt">,
  ) => Promise<AddCaseResult>;
  recordSubmittedCase: (
    pathologyCase: PathologyCase,
    task: FollowUpTask,
    sync: CaseSyncStatus,
  ) => void;
  loadDemoCases: () => void;
  completeTask: (caseId: string) => void;
  getCase: (id: string) => PathologyCase | undefined;
  getSyncStatus: (caseId: string) => CaseSyncStatus | undefined;
}

const StoreCtx = createContext<StoreValue | null>(null);

export function DermStoreProvider({ children }: { children: ReactNode }) {
  const [cases, setCases] = useState<PathologyCase[]>([]);
  const [tasks, setTasks] = useState<Record<string, FollowUpTask>>({});
  const [syncStatus, setSyncStatus] = useState<Record<string, CaseSyncStatus>>({});

  const value = useMemo<StoreValue>(() => {
    const addCase: StoreValue["addCase"] = async (c) => {
      const caseKey = buildCaseKey(c.patientName);
      const full: PathologyCase = {
        ...c,
        id: caseKey,
        createdAt: Date.now(),
      };
      setCases((prev) => [full, ...prev.filter((p) => p.id !== full.id)]);
      const assessment = assessCase(full);
      const errors: string[] = [];
      const combined = await submitCaseAndTask(full, assessment);
      const {
        caseRes,
        taskRes,
        task,
        graphSynced,
        graphVerified,
        graphError,
        taskKey,
        raw,
      } = combined;
      if (!caseRes.ok && caseRes.error) errors.push(caseRes.error);
      if (!taskRes.ok && taskRes.error) errors.push(taskRes.error);
      setTasks((prev) => ({ ...prev, [full.id]: task }));
      const sync: CaseSyncStatus = {
        mode: "butterbase_and_graph",
        caseKey: combined.caseKey,
        taskKey,
        butterbaseCaseSaved: caseRes.ok,
        butterbaseTaskSaved: taskRes.ok,
        graphSynced,
        graphVerified,
        partialSuccess: caseRes.ok && taskRes.ok && (!graphSynced || !graphVerified),
        graphError,
        lastResponse: raw,
      };
      setSyncStatus((prev) => ({ ...prev, [full.id]: sync }));
      return {
        case: full,
        butterbaseAttempted:
          caseRes.source === "butterbase" || taskRes.source === "butterbase",
        caseOk: caseRes.ok,
        taskOk: taskRes.ok,
        graphSynced,
        graphVerified,
        errors,
        sync,
      };
    };

    const recordSubmittedCase: StoreValue["recordSubmittedCase"] = (
      pathologyCase,
      task,
      sync,
    ) => {
      setCases((prev) => [
        pathologyCase,
        ...prev.filter((p) => p.id !== pathologyCase.id),
      ]);
      setTasks((prev) => ({ ...prev, [pathologyCase.id]: task }));
      setSyncStatus((prev) => ({ ...prev, [pathologyCase.id]: sync }));
    };


    return {
      cases,
      tasks,
      syncStatus,
      addCase,
      recordSubmittedCase,
      loadDemoCases: () => {
        setCases(DEMO_CASES);
        const initialTasks: Record<string, FollowUpTask> = {};
        const initialSync: Record<string, CaseSyncStatus> = {};
        for (const c of DEMO_CASES) {
          const a = assessCase(c);
          initialTasks[c.id] = {
            caseId: c.id,
            title: a.taskTitle,
            priority: a.priority,
            physician: c.physician,
            dueTiming: a.dueTiming,
            reason: a.taskReason,
            status: "Open",
          };
          initialSync[c.id] = {
            mode: "local_demo",
            caseKey: c.id,
            butterbaseCaseSaved: false,
            butterbaseTaskSaved: false,
            graphSynced: false,
            graphVerified: false,
          };
        }
        setTasks(initialTasks);
        setSyncStatus((prev) => ({ ...prev, ...initialSync }));
      },
      completeTask: (caseId) =>
        setTasks((prev) =>
          prev[caseId]
            ? { ...prev, [caseId]: { ...prev[caseId], status: "Complete" } }
            : prev,
        ),
      getCase: (id) =>
        cases.find((c) => c.id === id) ?? DEMO_CASES.find((c) => c.id === id),
      getSyncStatus: (id) => syncStatus[id],
    };
  }, [cases, tasks, syncStatus]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useDermStore() {
  const v = useContext(StoreCtx);
  if (!v) throw new Error("useDermStore must be used inside DermStoreProvider");
  return v;
}
