import { LOC_TASK_TYPES, LOC_TASK_TYPE_LABEL, LOC_TASK_TYPE_DEFINITION, type LocTaskType } from "./task-types";
import type { LocInputs } from "./brief-extract";
import { renderLocInputsBlock } from "./brief-extract";

export const LOC_CLASSIFIER_SYSTEM_PROMPT = `You are the Left-of-Centre task classifier. You read the Briefing Room diagnosis and inputs for a brand and assign ONE of seven strategic task types. The task type governs which questions the four LOC engines are asked and which constraint they are given.

The seven task types are:
${LOC_TASK_TYPES.map((t) => `- ${LOC_TASK_TYPE_LABEL[t]} (id: ${t}) — ${LOC_TASK_TYPE_DEFINITION[t]}`).join("\n")}

Rules:
1. Pick exactly ONE primary task type. Do not blend.
2. Identify ONE runner-up task type and give a one-line reason it was not chosen.
3. Base the classification on the anchored tension, the raw human truths, the Briefing Room diagnosis, and the product facts as stated — nothing else.
4. Do not hedge. If the material is genuinely ambiguous between two types, pick the one that names the bigger structural task.

Output format — return exactly this JSON, no prose before or after:

{
  "task_type": "<one of: ${LOC_TASK_TYPES.join(" | ")}>",
  "task_type_label": "<the human label for that id>",
  "rationale": "<one paragraph, 3-5 sentences, explaining why this task type is the correct read of this brief>",
  "runner_up": "<one of: ${LOC_TASK_TYPES.join(" | ")}>",
  "runner_up_label": "<the human label>",
  "runner_up_rationale": "<one line explaining why the runner-up was not chosen>"
}`;

export function buildLocClassifierUserMessage(inputs: LocInputs): string {
  return `${renderLocInputsBlock(inputs)}\n\nClassify this brief into one of the seven LOC task types. Return the JSON specified in your system prompt.`;
}

export type LocClassifierResult = {
  task_type: LocTaskType;
  task_type_label: string;
  rationale: string;
  runner_up: LocTaskType;
  runner_up_label: string;
  runner_up_rationale: string;
};

export function parseClassifierOutput(raw: string): LocClassifierResult {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error(`Classifier did not return JSON. Raw output: ${trimmed.slice(0, 200)}`);
  }
  const jsonStr = trimmed.slice(jsonStart, jsonEnd + 1);
  const parsed = JSON.parse(jsonStr) as Partial<LocClassifierResult>;
  if (!parsed.task_type || !LOC_TASK_TYPES.includes(parsed.task_type as LocTaskType)) {
    throw new Error(`Classifier returned invalid task_type: ${parsed.task_type}`);
  }
  if (!parsed.runner_up || !LOC_TASK_TYPES.includes(parsed.runner_up as LocTaskType)) {
    throw new Error(`Classifier returned invalid runner_up: ${parsed.runner_up}`);
  }
  return {
    task_type: parsed.task_type as LocTaskType,
    task_type_label: parsed.task_type_label ?? LOC_TASK_TYPE_LABEL[parsed.task_type as LocTaskType],
    rationale: parsed.rationale ?? "",
    runner_up: parsed.runner_up as LocTaskType,
    runner_up_label: parsed.runner_up_label ?? LOC_TASK_TYPE_LABEL[parsed.runner_up as LocTaskType],
    runner_up_rationale: parsed.runner_up_rationale ?? "",
  };
}
