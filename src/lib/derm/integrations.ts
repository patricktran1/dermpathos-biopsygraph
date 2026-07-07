import type { CaseAssessment, FollowUpTask, PathologyCase } from "./types";
import { buildCaseKey, submitCaseCombined } from "./butterbase";

/**
 * DermPathOS — Integration layer.
 * All Butterbase + Neo4j traffic goes through /api/cases/submit.
 * The browser never sees any Butterbase or Neo4j secret.
 */

export type SubmitResult = {
  ok: boolean;
  id: string;
  source: "butterbase" | "mock";
  status?: number;
  error?: string;
};

export type CreateTaskResult = {
  ok: boolean;
  task: FollowUpTask;
  source: "butterbase" | "mock";
  status?: number;
  error?: string;
};

export interface CombinedSubmit {
  caseRes: SubmitResult;
  taskRes: CreateTaskResult;
  task: FollowUpTask;
  caseKey: string;
  taskKey?: string;
  graphSynced: boolean;
  graphVerified: boolean;
  graphError?: string;
  raw: unknown;
}

/**
 * submitCaseAndTask — posts case + task to /api/cases/submit which handles
 * both Butterbase writes and the Neo4j graph MERGE server-side. Returns
 * per-step status so the UI can surface partial success.
 */
export async function submitCaseAndTask(
  pathologyCase: PathologyCase,
  assessment: CaseAssessment,
): Promise<CombinedSubmit> {
  const caseKey =
    pathologyCase.id && pathologyCase.id.trim() !== ""
      ? pathologyCase.id
      : buildCaseKey(pathologyCase.patientName);
  const task: FollowUpTask = {
    caseId: caseKey,
    title: assessment.taskTitle,
    priority: assessment.priority,
    physician: pathologyCase.physician,
    dueTiming: assessment.dueTiming,
    reason: assessment.taskReason,
    status: "Open",
  };
  const res = await submitCaseCombined({
    caseKey,
    patient_name: pathologyCase.patientName,
    age: String(pathologyCase.age ?? ""),
    biopsy_date: pathologyCase.biopsyDate,
    body_site: pathologyCase.bodySite,
    biopsy_type: pathologyCase.biopsyType,
    pathology_result_text: pathologyCase.pathologyResult,
    diagnosis: pathologyCase.diagnosis,
    margins: pathologyCase.margins,
    responsible_physician: pathologyCase.physician,
    priority: assessment.priority,
    required_action: assessment.requiredAction,
  });

  const biopsyOk = res.butterbase?.biopsy_case_saved === true;
  const taskOk = res.butterbase?.follow_up_task_saved === true;
  const failedTask = res.failed_step === "follow_up_tasks";
  const failedCase = res.failed_step === "biopsy_cases";

  return {
    caseRes: {
      ok: biopsyOk || failedTask || res.success,
      id: caseKey,
      source: "butterbase",
      status: res.status,
      error: failedCase ? res.message : undefined,
    },
    taskRes: {
      ok: taskOk || res.success,
      task,
      source: "butterbase",
      status: res.status,
      error: failedTask ? res.message : undefined,
    },
    task,
    caseKey: res.caseKey ?? caseKey,
    taskKey: res.taskKey,
    graphSynced: res.neo4j?.graph_synced === true,
    graphVerified: res.neo4j?.verified === true,
    graphError: res.neo4j?.error,
    raw: res,
  };
}

// Placeholder retained for architecture card.
export async function submitToButterbase(
  pathologyCase: PathologyCase,
  assessment?: CaseAssessment,
): Promise<SubmitResult> {
  const a =
    assessment ?? {
      priority: "Routine" as const,
      requiredAction: "",
      taskTitle: "",
      taskReason: "",
      dueTiming: "",
      flags: [],
      graphPath: [],
      isMalignant: false,
    };
  const { caseRes } = await submitCaseAndTask(pathologyCase, a);
  return caseRes;
}

export async function createFollowUpTask(
  pathologyCase: PathologyCase,
  assessment: CaseAssessment,
  _caseId?: string,
): Promise<CreateTaskResult> {
  const { taskRes } = await submitCaseAndTask(pathologyCase, assessment);
  return taskRes;
}

// TODO(neo4j)
export async function queryBiopsyGraphNeo4j(
  caseId: string,
): Promise<{ caseId: string; missingSteps: string[] }> {
  return { caseId, missingSteps: [] };
}

// TODO(rocketride)
export async function callRocketRidePipeline(
  pathologyCase: PathologyCase,
): Promise<{ ok: true; caseId: string }> {
  return { ok: true, caseId: pathologyCase.id };
}

export async function generateSummaryViaButterbaseGateway(
  pathologyCase: PathologyCase,
): Promise<string> {
  return `${pathologyCase.diagnosis} on ${pathologyCase.bodySite} — pending operational follow-up.`;
}
