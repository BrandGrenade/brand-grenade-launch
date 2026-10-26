export const JLR_ORCHESTRATION_ID = "06a8debc-cbf4-40de-a81c-992efc382b2d";
export const RECOVERY_ATTEMPTS = 3; // Initial generation plus two retries.
export const JLR_CHANNEL_INSTRUCTIONS: Record<string, string> = {
  "Large-format Roadside and Commuter Outdoor": 'The before job first, the famous name last. Make a series of outdoor executions: the first-job object/work and plain biographical fact dominate; the recognised face and name are revealed last in reading order. Then the new Jaguars. Both mandated closing lines appear verbatim.',
  "Retail Floor, Standing-room Occasions and Handover": 'Each car stands beside one before object tied to a named person’s true first job. Its card tells the before story first and reveals the famous face and name last. Staff open with the story, not the celebrity or product pitch. Then the new Jaguars and both closing lines verbatim.',
  "Earned Media and Independent Long-term Motoring Review": 'Build a press programme on the true first-job stories of the named people, offered to editors as a story alongside unsupervised loan cars. The supplied story material starts with the before job and reveals the famous person last, then the new Jaguars and both closing lines verbatim. Editorial independence is absolute: no compulsory coverage, verdict, favourable findings or scripted review. Fact-check and clear rights before publication; do not invent additional biography.',
  "Instagram and YouTube Creator-led Short Form and Examination": 'Creators drive the cars and tell their own true before story; their independence is kept. The commissioned campaign framework also carries a named famous person’s true first-job reveal as the central device, job first, recognised face and name last, followed by the new Jaguars and both verbatim closing lines. Do not make creators impersonate the named people or require a favourable review. Morgan Freeman voices campaign audio; creator testimony stays in the creator’s own voice.',
};

export function recoveryReady(checks: { verdict: string }[], cohesion: string): boolean {
  return checks.length === 9 && checks.every((c) => c.verdict === "present") && cohesion === "pass";
}