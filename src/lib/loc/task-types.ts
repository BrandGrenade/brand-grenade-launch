// LOC task types + engine-specific question set.
// Task type is the classifier's output; each engine receives ONLY its
// per-task-type question, not the task-type label alone.

export const LOC_TASK_TYPES = [
  "total_revitalisation",
  "relevance_extension",
  "challenger_disruption",
  "category_relocation",
  "permission_expansion",
  "crisis_repositioning",
  "cultural_moment_capitalisation",
] as const;

export type LocTaskType = (typeof LOC_TASK_TYPES)[number];

export const LOC_TASK_TYPE_LABEL: Record<LocTaskType, string> = {
  total_revitalisation: "Total Revitalisation",
  relevance_extension: "Relevance Extension",
  challenger_disruption: "Challenger Disruption",
  category_relocation: "Category Relocation",
  permission_expansion: "Permission Expansion",
  crisis_repositioning: "Crisis Repositioning",
  cultural_moment_capitalisation: "Cultural Moment Capitalisation",
};

export const LOC_TASK_TYPE_DEFINITION: Record<LocTaskType, string> = {
  total_revitalisation:
    "Brand is culturally dead or dying to a target audience; needs complete personality reinvention while retaining equity.",
  relevance_extension:
    "Brand is healthy in its core but invisible to an adjacent audience it needs to reach.",
  challenger_disruption:
    "Brand is smaller than the market leader and needs to take share by naming what the leader cannot say.",
  category_relocation:
    "Brand is correctly positioned within its category but the category itself is the problem.",
  permission_expansion:
    "Brand has strong equity in one domain and needs to legitimately extend into an adjacent one.",
  crisis_repositioning:
    "Brand's existing positioning has been compromised by a reputational event, market shift, or category scandal.",
  cultural_moment_capitalisation:
    "Brand needs to move quickly to own a cultural shift before competitors see it.",
};

export type EngineName = "breach" | "synect" | "displace" | "naive";

// Engine-specific questions per task type — verbatim from spec.
export const LOC_ENGINE_QUESTIONS: Record<LocTaskType, Record<EngineName, string>> = {
  total_revitalisation: {
    breach:
      "What has this brand always assumed to be true about itself that might be wrong — and what territory opens if that assumption is refused entirely?",
    synect:
      "What two-word paradox captures the tension between what this brand is and what its audience now needs — and who does that audience want to become?",
    displace:
      "What does this random stimulus reveal about this brand's human problem that a direct question never would?",
    naive:
      "If you had never heard of this category and encountered only this product and this person's fundamental need, what would you promise them?",
  },
  relevance_extension: {
    breach:
      "What does this brand assume about who its audience is — and what opens when that assumption is refused?",
    synect:
      "What paradox captures the tension between the brand's current meaning and the adjacent audience's actual life — and what identity aspiration lives inside that paradox?",
    displace:
      "What unexpected connection between this stimulus and the adjacent audience's private world reveals territory the brand could claim?",
    naive:
      "If the adjacent audience encountered this product with no preconceptions, what would they want it to mean for them?",
  },
  challenger_disruption: {
    breach:
      "What does the market leader depend on being true — and what territory opens for this brand when that dependence is named and refused?",
    synect:
      "What compressed conflict names the gap between what the market leader promises and what it structurally cannot deliver?",
    displace:
      "What unexpected connection between this stimulus and the category's dominant convention reveals the claim only this brand can make?",
    naive:
      "If you knew nothing about this category and only knew what this brand can actually do, what would you say that no established player could say?",
  },
  category_relocation: {
    breach:
      "What would this brand need to stop being a member of in order to become something larger — and what human territory exists outside this category that is bigger, more alive, and available?",
    synect:
      "What paradox describes the gap between the category's promise and the human condition it actually exists inside — and what brand could own that human condition rather than the category?",
    displace:
      "What connection between this stimulus and the human condition surrounding the category reveals territory that no category player has named?",
    naive:
      "If this category didn't exist, what would this product be — and what would it promise?",
  },
  permission_expansion: {
    breach:
      "What underlying human truth does this brand already own that is broader than the category it currently occupies — and what happens when the brand claims that truth rather than the category?",
    synect:
      "What paradox names the tension between the brand's current scope and the full territory its core truth could occupy?",
    displace:
      "What unexpected connection reveals a domain adjacent to the brand's current territory that the brand's core truth could credibly claim?",
    naive:
      "If this brand could be about one thing that wasn't its current category, what would that one thing be — and why would it matter?",
  },
  crisis_repositioning: {
    breach:
      "What is furthest from the damaged ground while remaining credible to this brand's actual product truth?",
    synect:
      "What paradox captures the gap between who this brand was and who it needs to become — and what identity aspiration lives in that gap?",
    displace:
      "What unexpected connection reveals territory that is genuinely new rather than merely distant from the damage?",
    naive:
      "If this brand's history were invisible, what would its product truth alone allow it to promise?",
  },
  cultural_moment_capitalisation: {
    breach:
      "What assumption about what this brand is for must be refused in order for it to move with genuine standing into this cultural moment?",
    synect:
      "What paradox captures the tension between this brand's current meaning and the cultural moment's human truth?",
    displace:
      "What unexpected connection between this stimulus and the cultural moment reveals the claim only this brand can make with genuine standing?",
    naive:
      "If you only knew this cultural moment and this product's fundamental capability, what promise would feel genuinely necessary right now?",
  },
};

// Constraint inversion per task type — verbatim from spec.
export const LOC_TASK_CONSTRAINT: Record<LocTaskType, string> = {
  total_revitalisation:
    "You cannot reference the brand's existing equity, current audience, current positioning, or current category in your first move. Generate from the human condition alone, then ask whether this brand could earn the right to own what you find.",
  relevance_extension:
    "You cannot reference the brand's core audience or its existing communications. Generate from the adjacent audience's private world alone, then ask whether the brand's product truth gives it structural permission to enter that world.",
  challenger_disruption:
    "You cannot describe what this brand offers. Describe only what the market leader cannot say — then ask whether this brand can say it with genuine standing.",
  category_relocation:
    "You cannot reference the category this brand currently occupies. Generate from the human condition surrounding the category, then ask whether this brand's product truth gives it standing to own that condition.",
  permission_expansion:
    "You cannot reference the brand's current category or current equity. Generate from the brand's most fundamental product capability alone, then ask what human territory that capability could occupy if the category frame were removed.",
  crisis_repositioning:
    "You cannot reference the damaged territory or defend against the damage. Generate from what is furthest from the damage while remaining grounded in product truth.",
  cultural_moment_capitalisation:
    "You cannot reference the brand's existing communications or current positioning. Generate from the cultural moment's human truth alone, then ask whether the brand's existing values stance gives it genuine standing to enter that truth.",
};
