/** Permanent provider/account failures stop the durable job; validation failures use its bounded budget. */
export function terminalExplorationError(message: string): boolean {
  return /Claude API (?:400|401|402|403|404)\b|credit|balance|billing|unauthorized|invalid.*key|refus(?:al|ed)|denied|not.available.in.region|retention.consent|vendor.not.enabled/i.test(message);
}
export async function explorationRetryCooldown(): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, 5000));
}