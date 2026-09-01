// LOC STIMULUS CORPUS — externally sourced, code-selected randomisation input.
//
// Why this exists: asking a language model for "a random object" samples from
// whatever is currently activated in its context. Given an opportunity
// sentence about a heritage performance marque, the model reliably "randomly"
// picks a falcon. The stimulus must therefore be selected in code, before the
// model sees anything, from a corpus that was written without reference to any
// brand.
//
// Two corpora:
//   OBJECT_STIMULI — concrete things with mechanics (ENGINE 06 RANDOM CONNECTION)
//   WORLD_STIMULI  — specific worlds/industries to inhabit (ENGINE 03 WRONG ROOM)
//
// Both are drawn domain-first (uniform over domains, then item within domain)
// so no single domain dominates platform-wide, and both pass the same
// semantic-distance filter against the brand context before being assigned.
//
// Corpus version is stamped into engine output so draws remain auditable and
// so corpus expansion is visible in the record.
export const STIMULUS_CORPUS_VERSION = 1;

export type ObjectStimulus = {
  id: string;
  name: string;
  domain: string;
  properties: string[];
};

export type WorldStimulus = {
  id: string;
  name: string;
  domain: string;
  /** How this world defines success — the logic an engine must inhabit. */
  logic: string[];
};

// Compact authoring format: [name, ...properties]
type Row = [string, ...string[]];

function build(domain: string, rows: Row[]): ObjectStimulus[] {
  return rows.map((row, i) => ({
    id: `${domain}-${String(i + 1).padStart(2, "0")}`,
    name: row[0],
    domain,
    properties: row.slice(1),
  }));
}

function buildWorlds(domain: string, rows: Row[]): WorldStimulus[] {
  return rows.map((row, i) => ({
    id: `w-${domain}-${String(i + 1).padStart(2, "0")}`,
    name: row[0],
    domain,
    logic: row.slice(1),
  }));
}

export const OBJECT_STIMULI: ObjectStimulus[] = [
  ...build("materials", [
    ["a cold-forged bicycle spoke", "tensioned in one axis only", "fails suddenly, never gradually", "worthless alone, load-bearing in a set"],
    ["annealed copper pipe", "gets softer the more it is worked then heated", "carries what it is shaped around", "oxidises into a surface people prefer to the original"],
    ["end-grain butcher block", "absorbs the blade instead of resisting it", "heals its own cuts", "built from offcuts standing upright"],
    ["laminated safety glass", "breaks completely but holds together", "failure is visible and contained", "two weak layers bonded by something invisible"],
    ["a graphite pencil lead", "leaves itself behind to do its job", "hardness is a scale, not a virtue", "consumed by use, never worn out"],
    ["oiled canvas", "waterproof because it is saturated, not sealed", "needs reproofing on a schedule", "gets better looking as it fails"],
    ["cast iron that has been seasoned", "improves only through repeated use", "ruined by the wrong kind of cleaning", "the coating is burnt-on damage"],
    ["shape-memory nitinol wire", "returns to a form it was taught", "deformation is temporary by design", "remembers heat, not force"],
    ["kiln-dried oak", "moves for years after it looks finished", "cracks along the grain it was cut against", "stability is a function of patience"],
    ["a sacrificial zinc anode", "protects by corroding first", "must be replaced to keep working", "its destruction is the evidence it worked"],
    ["rammed earth wall", "strength from compression, not binding", "made of the site it stands on", "thermally slow — lags the day by hours"],
    ["a fresnel lens", "throws the same light further by removing glass", "concentric, discontinuous, ugly up close", "subtraction is the mechanism"],
    ["vulcanised rubber", "useless until cross-linked by heat and sulphur", "elastic within a range, brittle outside it", "invented by accident, kept on purpose"],
    ["a tuning fork", "one frequency, no harmonics, no argument", "rings longer when nothing touches it", "used as a reference, never as music"],
    ["hand-laid gold leaf", "thinner than the surface it covers", "destroyed by breath", "value entirely in the application"],
  ]),
  ...build("biology", [
    ["a hermit crab shell exchange", "growth requires abandoning armour", "queues form, largest first", "vacancy chains — one move frees many"],
    ["mycorrhizal fungal networks", "trade sugar for minerals underground", "connect competitors to each other", "the visible organism is not the organism"],
    ["a cuttlefish chromatophore", "colour by muscular contraction, not pigment change", "signal and camouflage in the same organ", "faster than the eye that reads it"],
    ["deciduous abscission", "the tree fires the leaf, the leaf does not fall", "withdrawal precedes release", "loss is scheduled and metabolic"],
    ["a cicada's prime-number emergence", "17 years underground for six weeks above it", "synchrony defeats predators by glut", "timing is the entire defence"],
    ["bone remodelling under load", "deposits where stressed, dissolves where idle", "shape is a record of behaviour", "rest weakens it"],
    ["a slime mould solving a maze", "no brain, no centre, optimal route", "retreats from failed paths, thickens the good one", "intelligence as flow allocation"],
    ["antibody affinity maturation", "improves by iterating on near-misses", "high failure rate is the mechanism", "a library, not a design"],
    ["eusocial mole-rat colonies", "one breeder, everyone else infrastructure", "cold-blooded mammal, underground climate", "the individual is not the unit"],
    ["a barnacle's cement", "cures underwater, permanent on first contact", "chooses location once, forever", "settling is the last decision it makes"],
    ["seed dormancy requiring fire", "germination triggered by destruction", "waits decades in the soil", "the disaster is the invitation"],
    ["a whale fall ecosystem", "one death feeds a habitat for fifty years", "sequential communities, each undoing the last", "abundance from a single failure"],
  ]),
  ...build("bureaucracy", [
    ["a chain of custody form", "value is in the unbroken signature sequence", "one gap voids everything upstream", "the paper outranks the object"],
    ["double-entry bookkeeping", "every entry appears twice, in opposite senses", "errors surface as imbalance, not as wrongness", "500 years unchanged"],
    ["a building code variance hearing", "the rule is fixed, the exception is negotiated in public", "precedent is created by the exception", "objectors have standing"],
    ["diplomatic pouch immunity", "the container is inviolable, the contents unknown", "trust conferred on a bag, not a person", "abuse is assumed and tolerated"],
    ["a recall notice", "the manufacturer indicts itself in writing", "speed of admission mitigates the damage", "silence is the only worse option"],
    ["airline overbooking algorithms", "sells more than exists on a probability", "compensation is priced in advance", "the failure has a published price"],
    ["a standards committee comment period", "anyone may object, all objections must be answered", "consensus by exhaustion", "slowness is the legitimacy"],
    ["escrow", "a third party holds what neither will release first", "distrust made structural and cheap", "closes by instruction, not by trust"],
    ["a coroner's open verdict", "officially declining to conclude", "the record states the limit of knowledge", "ambiguity preserved on purpose"],
    ["carbon offset registries", "an absence sold as an asset", "additionality is the whole argument", "double-counting is the failure mode"],
  ]),
  ...build("sport", [
    ["the pole vault plant", "converting horizontal run into vertical lift", "the pole must bend to give anything back", "the athlete lets go at the top"],
    ["a rowing eight's catch", "eight people, one stroke, zero tolerance for individuality", "the cox faces the wrong way and decides", "speed comes from simultaneity, not power"],
    ["sumo's tachi-ai", "the entire bout decided in the first collision", "both must agree, unspoken, on when to start", "ritual weight before instant violence"],
    ["a cricket declaration", "voluntarily stopping while ahead", "giving up guaranteed runs to buy time to win", "the risk is losing what you already had"],
    ["free solo route reading", "rehearsal is the whole discipline", "no second attempt exists", "the decision was made weeks earlier"],
    ["a marathon pacer", "paid to run well and not to win", "leaves the race before the finish", "success is measured in someone else's time"],
    ["curling's sweeping", "changing the surface, never the stone", "influence after commitment", "shouting is part of the technique"],
    ["boxing's southpaw problem", "the same skills mirrored are harder to read", "unfamiliarity beats superiority", "the difficulty is entirely relational"],
    ["a peloton's rotation", "the leader is the one doing the losing work", "shelter is 30% of the effort", "cooperation among competitors, briefly"],
    ["the high jump Fosbury flop", "one person reversed the direction everyone faced", "made possible by a foam landing mat", "the technique waited on the infrastructure"],
  ]),
  ...build("ritual", [
    ["a Japanese tea ceremony's single flower", "one stem chosen so the garden's others are ignored", "restraint as the display", "the host cuts the rest that morning"],
    ["kintsugi", "repair in gold — the break becomes the value", "history made deliberately visible", "unbroken is worth less"],
    ["a wake held with an open door", "grief made available to strangers", "food as the medium of presence", "nobody is invited, everybody comes"],
    ["shoe removal at a threshold", "the boundary is enforced by a small inconvenience", "the outside is declared unclean", "compliance is instant and unspoken"],
    ["a sourdough starter passed between households", "kept alive by being given away", "each house changes its character", "neglect kills it in a week"],
    ["the last call bell", "an arbitrary time made emotionally significant", "urgency manufactured by a rule", "everyone obeys a bell they resent"],
    ["a hazing survived and never described", "belonging purchased with silence", "the cost is what makes the membership legible", "the rule protects the institution, not the initiate"],
    ["blowing out candles", "a wish tied to breath and extinguishing", "the light is put out to celebrate", "witnesses are required"],
  ]),
  ...build("logistics", [
    ["a cross-dock terminal", "nothing is stored, everything is turned", "inventory as motion, not as stock", "an hour of stillness is a failure"],
    ["the intermodal container", "the box standardised, the contents irrelevant", "reduced ports to cranes and time", "value in the interface, not the object"],
    ["a cold chain break", "one hour undoes six weeks", "the failure is invisible at the destination", "temperature loggers are the only witness"],
    ["last-mile delivery density", "the final kilometre costs more than the ocean", "efficiency collapses at the end", "the customer's door is the expensive part"],
    ["just-in-time buffer removal", "resilience deliberately traded for cost", "works perfectly until it does not at all", "the saving is visible, the risk is not"],
    ["a pilot boat", "a local who boards the ship to bring it in", "the captain surrenders control near home", "expertise is geographic, not hierarchical"],
    ["pallet pooling", "the asset is shared and never owned", "loss is priced as a rental", "standardisation makes the pool possible"],
    ["a queue with a single serpentine line", "slower for the individual, fairer for everyone", "perceived injustice removed at a throughput cost", "people prefer the slower fair one"],
  ]),
  ...build("weather", [
    ["a katabatic wind", "cold air falling under its own weight", "no storm, no front — just gravity", "predictable to the hour, brutal for minutes"],
    ["hoar frost", "forms on the coldest available edge", "a record of overnight air made visible", "gone by the first sun"],
    ["the eye of a hurricane", "calm produced by the most violent structure", "the second half arrives from the other direction", "stillness as a warning"],
    ["fog burn-off", "disappearance without movement", "the thing does not leave, it stops being", "hard to forecast, obvious in hindsight"],
    ["a rain shadow", "abundance and desert produced by one ridge", "the same weather, two outcomes", "position decides everything"],
    ["thundersnow", "two systems that shouldn't co-occur, briefly doing so", "muffled — the snow eats the sound", "rare enough to be doubted"],
    ["black ice", "danger defined by being unreadable", "the surface looks like the safe surface", "detection only through consequence"],
  ]),
  ...build("music", [
    ["a drop-D tuning", "one string retuned changes the whole instrument's reach", "trades range for a single low note", "the cost is elsewhere on the neck"],
    ["the tritone", "the interval banned for centuries", "unresolved by construction", "now the sound of tension in every score"],
    ["a fermata", "the composer handing time to the conductor", "notated instruction to stop counting", "duration becomes interpretation"],
    ["dub's remix as subtraction", "the mix made by removing parts live", "the engineer becomes the performer", "space is the instrument"],
    ["a rest at the end of a phrase", "silence written and paid for", "the audience holds it, not the player", "the loudest bar is empty"],
    ["call and response", "the leader is incomplete without the room", "authority requires an answer", "no performance without participation"],
    ["gamelan's paired tuning", "two instruments deliberately detuned against each other", "the shimmer is the mistake, kept", "perfect unison is considered dead"],
    ["a bass frequency felt not heard", "below the range that registers as sound", "the body reports what the ear misses", "presence without recognition"],
  ]),
  ...build("crime", [
    ["a decoy safe", "the theft succeeds and takes nothing", "the deception costs less than the defence", "the thief's confidence is the vulnerability"],
    ["the honest-signal of a sealed evidence bag", "tamper-evidence, not tamper-proofing", "the goal is to prove interference, not prevent it", "detection over prevention"],
    ["a confidence trick's small first favour", "trust built by an unnecessary honesty", "the mark recruits themselves", "the setup is longer than the take"],
    ["counterfeit detection by weight", "the fake fails on a property nobody looks at", "the visible copy is perfect", "verification moves to an unglamorous axis"],
    ["witness protection identity construction", "a life built backwards from a date", "the gaps are the risk", "authenticity is an infrastructure problem"],
    ["a getaway driver waiting", "the whole plan depends on someone doing nothing well", "the least visible role is the load-bearing one", "patience as a professional skill"],
  ]),
  ...build("medicine", [
    ["triage tagging", "sorting by who cannot wait, not who suffers most", "the untreatable are set aside deliberately", "an explicit, defensible cruelty"],
    ["a placebo arm", "deception required to establish truth", "the comparison is the knowledge", "belief measurably does work"],
    ["phantom limb pain", "the map outlasts the territory", "treated with a mirror, not a drug", "the brain must be shown, not told"],
    ["controlled hypothermia", "slowing everything to prevent damage", "the treatment resembles the injury", "rewarming is the dangerous part"],
    ["antibiotic course completion", "stopping when you feel better causes the harm", "the individual's relief is the population's risk", "compliance is the whole mechanism"],
    ["a defibrillator stopping the heart", "the fix is a complete interruption", "restarting from nothing is safer than correcting", "chaos treated with a full stop"],
    ["prosthesis socket fitting", "the failure is always at the interface", "the limb is easy, the join is not", "comfort determines whether it is used at all"],
  ]),
  ...build("childhood", [
    ["a den built from furniture", "value from the fact adults must stoop", "materials borrowed, never bought", "dismantled the same day by decree"],
    ["playground turn-taking", "law enforced with no authority present", "fairness policed loudly and immediately", "the rules are re-negotiated each session"],
    ["a game of hot and cold", "guidance without information", "the searcher does the work, the guide only reacts", "proximity is the entire vocabulary"],
    ["invisible ink on a note", "the message is legible only to whoever knows the trick", "secrecy through method, not encryption", "the paper looks blank to authority"],
    ["the school report euphemism", "criticism encoded for two audiences at once", "the parent decodes, the child does not", "politeness as a carrier signal"],
    ["a passed note", "distribution by trust chain", "every intermediary could read it and mostly does not", "risk is social, not technical"],
  ]),
  ...build("machinery", [
    ["a shear pin", "designed to break so the machine does not", "the cheapest part protects the most expensive", "failure is scheduled into a single component"],
    ["the escapement in a clock", "controlled release of stored energy", "accuracy from repeated interruption", "the ticking is the mechanism, not a side effect"],
    ["a governor on a steam engine", "faster spin closes its own throttle", "the machine regulating itself with its own motion", "the first feedback loop"],
    ["a Whitworth thread standard", "interchangeability as an invention", "the value is in everyone agreeing", "the part became worthless as a secret"],
    ["hydraulic pressure multiplication", "small force over distance becomes large force over none", "the fluid does not compress, so it obeys", "leverage without levers"],
    ["a dead man's switch", "safety by requiring continuous presence", "letting go stops everything", "vigilance made structural"],
    ["a differential gear", "two wheels at different speeds from one input", "cornering solved mechanically", "the compromise is invisible in use"],
    ["a heat sink's fins", "performance from surface area, not mass", "does nothing but be near something hot", "silence is the design goal"],
  ]),
  ...build("finance", [
    ["a Dutch auction", "the price falls until someone stops it", "speed of decision replaces bidding", "the winner pays for impatience"],
    ["a covenant in a loan document", "the money is conditional on behaviour", "breach can be technical and fatal", "the lender governs without owning"],
    ["insurance underwriting of a rare event", "pricing something that will probably never happen", "the premium buys the counterparty's survival", "solvency matters more than the policy"],
    ["a bank run", "the belief causes the fact", "solvent institutions fail on timing", "the queue is the mechanism"],
    ["a stock buyback", "the company purchasing its own scarcity", "value engineered by supply, not demand", "signals confidence and admits no better use"],
    ["a bond's duration risk", "the safe asset that loses on a rate change", "risk relocated, not removed", "held to maturity, the loss is invisible"],
  ]),
  ...build("infrastructure", [
    ["an expansion joint on a bridge", "the structure must be allowed to move to survive", "rigidity is the failure mode", "the gap is the engineering"],
    ["a desire path", "the route people actually take, worn into the grass", "planning corrected by feet", "authorities eventually pave it"],
    ["a redundant fibre ring", "the cable cut is assumed, not prevented", "traffic reverses direction in milliseconds", "resilience through a second wrong way"],
    ["a spillway", "a controlled failure point above the dam", "designed to be used only in disaster", "using it looks like catastrophe and is safety"],
    ["street lighting spacing", "safety from overlap, not brightness", "the dark patch between lamps is the design variable", "more light in the wrong place makes it worse"],
    ["a level crossing's warning time", "the delay is calibrated to human impatience", "too long and people drive around the barrier", "the safety system must model disobedience"],
    ["load shedding", "the grid protecting itself by choosing who goes dark", "planned unfairness beats unplanned collapse", "the schedule is the politics"],
  ]),
  ...build("archive", [
    ["a palimpsest", "the earlier text visible under the later one", "erasure was expensive so it was partial", "the accident preserved the original"],
    ["cold storage of film negatives", "the master is never shown", "access is always through a copy", "the original exists to make copies possible"],
    ["a card catalogue's cross-reference", "the same object findable by three logics", "the index is the intelligence", "removing a card removes the object"],
    ["magnetic tape print-through", "the signal bleeds to the adjacent wrap", "storage itself degrades the content", "the ghost precedes the sound"],
    ["a redacted document", "the shape of what is hidden is published", "the black bar is information", "length of the block gives it away"],
    ["deaccessioning", "the institution deliberately losing part of itself", "keeping everything destroys the collection", "the decision is never reversible"],
  ]),
  ...build("navigation", [
    ["dead reckoning", "position from speed, heading and time alone", "error compounds silently with distance", "confidence is highest just before it fails"],
    ["a lighthouse's characteristic flash", "identity encoded as a rhythm", "the light says which light it is", "useless without the almanac"],
    ["a portolan chart's rhumb lines", "usable directions on an unusable projection", "accurate locally, wrong globally", "practitioners knew and did not care"],
    ["a sextant's artificial horizon", "measuring against a reference you carry", "usable when the real horizon is gone", "the instrument supplies what the world withheld"],
    ["a cairn on a ridge", "a message left by someone who cannot be asked", "meaning depends on direction of travel", "maintained by strangers"],
  ]),
];

export const WORLD_STIMULI: WorldStimulus[] = [
  ...buildWorlds("discipline", [
    ["competitive powerlifting", "one attempt counts, the other two are data", "bodyweight class is the whole competitive frame", "the judge's light, not the crowd, decides"],
    ["a monastic scriptorium", "the copy must not improve the original", "labour measured in decades", "authorship is a vanity to be suppressed"],
    ["long-distance sailing single-handed", "sleep in twenty-minute increments", "every failure must be repairable alone", "weather is negotiated with, never beaten"],
    ["classical ballet training", "correction is constant and impersonal", "the body is retrained against instinct", "visible effort is the only true failure"],
    ["Japanese knife sharpening apprenticeship", "years before touching the good steel", "the water stone teaches, the master says nothing", "the edge is judged by sound"],
  ]),
  ...buildWorlds("institution", [
    ["submarine warfare", "silence is the only defence", "the crew never sees the adversary", "everything is rehearsed because nothing can be improvised"],
    ["air traffic control", "success is the total absence of event", "language is stripped to prevent ambiguity", "handover is the dangerous moment"],
    ["a coroner's court", "the question is how, never who is to blame", "the family is present for a technical proceeding", "an open verdict is an acceptable answer"],
    ["a nuclear decommissioning programme", "the project outlives everyone on it", "documentation for readers not yet born", "success measured in centuries of nothing"],
    ["the standards body that defines the metre", "authority through everyone agreeing to be measured", "the reference must never be used", "revision is a global event"],
    ["a central bank's open market desk", "influence exercised by tiny, constant actions", "speaking moves more than acting", "credibility is the only real instrument"],
  ]),
  ...buildWorlds("frontier", [
    ["deep-sea salvage", "the wreck is a legal object before it is a physical one", "the window is weather, not money", "everything is found in the dark by touch"],
    ["Antarctic overwintering", "no rescue for six months, planned for", "the crew is selected for tolerance, not brilliance", "boredom is the operational risk"],
    ["a wildfire hotshot crew", "the strategy is deciding what to let burn", "the line is cut ahead of the danger", "the retreat route is planned before the work"],
    ["orbital debris tracking", "the threat is invisible, catalogued and increasing", "avoidance is a scheduling problem", "one collision creates the next thousand"],
    ["cave rescue", "the medicine is easy, the geometry is not", "the patient waits for days", "the rescuers are also the map-makers"],
  ]),
  ...buildWorlds("craft", [
    ["pipe organ building", "the instrument is built into a specific room", "voiced on site, unusable anywhere else", "tuning is a relationship with the building"],
    ["bespoke shoemaking on a last", "the mould is the customer's foot, kept for life", "fit before appearance, always", "repair is assumed at the point of sale"],
    ["stained glass restoration", "the repair must be identifiable to a specialist and invisible to a visitor", "lead is the structure, glass is the surface", "the original maker's error is preserved"],
    ["Japanese joinery without fasteners", "the joint gets tighter under load", "hidden complexity, plain surface", "disassembly is designed in"],
    ["falconry-free hedge laying", "the barrier is grown, not built", "cut almost through so it lives sideways", "the work is judged in ten years"],
  ]),
  ...buildWorlds("performance", [
    ["stand-up comedy at an open mic", "the audience answers in real time and cannot be argued with", "material is developed in public failure", "five minutes is the whole discipline"],
    ["a repertory theatre in a small town", "the same faces in every role all season", "the audience knows the actor, not the character", "budget forces invention"],
    ["professional wrestling booking", "the outcome is agreed, the risk is real", "the crowd's disbelief is the product", "a heel is a service to the room"],
    ["auctioneering", "the pace is the persuasion", "silence is a competitive weapon", "the hammer creates a legal fact"],
    ["a wedding band's set list", "reading a room that changes hourly", "success is the floor, not the applause", "no artistic credit is available"],
  ]),
  ...buildWorlds("service", [
    ["mountain hut wardening", "hospitality with finite supplies", "everyone eats the same thing at the same time", "turning people away is a safety act"],
    ["overnight freight rail crewing", "the world is asleep while the work happens", "handovers by radio to voices never met", "punctuality against nothing visible"],
    ["a night-shift bakery", "the product must be ready before demand exists", "everything is made in the dark for the morning", "yesterday's failure is today's discount"],
    ["a rural ambulance volunteer service", "response time set by geography, not effort", "the crew knows the patient personally", "resources are always the wrong ones"],
    ["a dementia care home's daily rhythm", "the same conversation held sincerely each time", "orientation matters more than information", "success is a calm afternoon"],
  ]),
  ...buildWorlds("commerce", [
    ["a Dutch flower auction", "prices fall until someone commits", "perishability sets the entire clock", "the whole market clears before breakfast"],
    ["a pawn shop", "every transaction assumes return and plans for abandonment", "valuation under time pressure and shame", "the loan is the product, the object is collateral"],
    ["duty-free retail in transit", "customers who will never return", "the category exists because of a border", "dwell time is the only variable"],
    ["a farmers' co-operative", "competitors sharing a price floor", "membership means accepting the pool's decision", "the individual's best year subsidises another's worst"],
    ["a scrapyard", "value in the material, never the object", "everything arriving is a failure of something else", "sorting is the entire margin"],
  ]),
  ...buildWorlds("systems", [
    ["open-source maintainership", "authority earned only by continuing to show up", "users have no contract and full expectations", "forking is always available and rarely used"],
    ["penetration testing", "paid to demonstrate the failure, not to fix it", "the report is the deliverable", "the client's relief is defeat"],
    ["a wildlife reintroduction programme", "success is the animals ignoring you", "the intervention must become unnecessary", "measured over generations"],
    ["a language revitalisation programme", "fluency in the young is the only metric", "the last speakers are the curriculum", "loss is invisible until irreversible"],
    ["postal sorting in a country with no addresses", "delivery by description and local knowledge", "the network is people, not the grid", "reliability without formal structure"],
  ]),
];

export const OBJECT_DOMAINS = Array.from(new Set(OBJECT_STIMULI.map((s) => s.domain)));
export const WORLD_DOMAINS = Array.from(new Set(WORLD_STIMULI.map((s) => s.domain)));

/** Text used for embedding and for lexical comparison. */
export function stimulusText(s: ObjectStimulus | WorldStimulus): string {
  const detail = "properties" in s ? s.properties : s.logic;
  return `${s.name}. ${detail.join(". ")}.`;
}
