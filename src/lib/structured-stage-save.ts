import { validateStructured, type StructuredStage, type ValidationOutcome } from "./structured-output";
import { recoverSavedStage } from "./saved-stage-records";
import { confirmWrite } from "./confirm-write";

/** Retry local extraction without making another model call or altering stage prose. */
export function resolveStructuredRecord(stage: StructuredStage, block: string | null, text: string,
  context: Parameters<typeof validateStructured>[2] = {}): ValidationOutcome {
  let result = validateStructured(stage, block, context);
  if (result.structured) return result;
  result = validateStructured(stage, block, context);
  const recovered = stage === "9" ? null : recoverSavedStage(stage, text);
  return recovered ? { structured: recovered, error: null } : {
    structured: null, error: `Platform structured-data error after retry: ${result.error}`,
  };
}

/** Preserve the original atomic payload on retry, then durably record a platform error. */
export async function saveStructuredStage(
  write: () => PromiseLike<{ error: { message: string } | null }>,
  recordError: (message: string) => PromiseLike<{ error: { message: string } | null }>,
  label: string,
): Promise<{ error: { message: string } | null }> {
  const result = await confirmWrite(write, label);
  if (result.ok) return { error: null };
  const message = `Platform structured-data save error after retry: ${result.error}`;
  const recorded = await confirmWrite(() => recordError(message), `${label} error record`);
  if (!recorded.ok) console.error(`${label}: platform error could not be persisted`);
  return { error: { message } };
}