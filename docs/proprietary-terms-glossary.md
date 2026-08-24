# Brand Grenade — Proprietary & Internal Terminology Register

Extraction only. No build, design or placement decisions taken. Excludes the 50+ named
methodologies library (held separately).

Each entry: **Term** — plain-English definition — *Application* (where it appears, what job it does).

---

## 1. PLATFORM-LEVEL / MARKETING SITE

- **Brand Grenade** — the product and company name. *Used everywhere; master brand on the homepage and every document cover.*
- **The Five Rooms ("One Connected System")** — the marketing framing of the platform as five sequential modules rather than one tool. *Homepage section structure; also the mental model behind the Launch Strip nav.*
- **Room 00 · Research Synthesiser** — optional first room; ingests raw research (scan data, sales, qual/quant, desktop, industry reports) and turns it into a structured, attributed evidence base. *Homepage; feeds Room 01.*
- **Room 01 · Intelligence Lab** — finds and ranks strategic territory opportunities before a brief is written. *Homepage; produces Document 00A.*
- **Room 02 · Briefing Room** — interrogates a client brief through a six-step diagnostic until it names a real tension. *Homepage; produces the Strategic Anchor.*
- **Room 03 · Strategy Pipeline** — explores many strategic routes in parallel, then validates the survivor. *Homepage; Stages 1–16.*
- **Room 04 · Creative Stimulus Engine** — generates 37 divergent creative directions, scores and orchestrates the strongest into one campaign. *Homepage; Stages 17–22 plus the Stimulus Engine.*
- **The Bottleneck** — the named problem the platform claims to solve: strategy capacity, not strategy quality. *Homepage section.*
- **The Rhythm (Generates → Judge → Validates → Approve → Orchestrate → Sign off)** — the coined human/machine cadence showing where human judgement stays. *Homepage "What doesn't change" section.*
- **"Human judgement stays in the room. The heavy lifting doesn't."** — primary platform tagline. *Homepage hero.*
- **"From possibility to decision."** — closing tagline. *Homepage footer section.*
- **"Not a claim — a walkthrough"** — the eyebrow framing redacted real-session proof panels. *Homepage proof section.*
- **Live Session Excerpt** — label on each room's proof panel showing a real redacted output. *Homepage.*
- **The Method / The Outcome** — the two named stat blocks (50+ methodologies, 20+ propositions, 37 lenses vs 2–4hrs, 14 scoring dimensions, 23 structured outputs). *Homepage hero stats.*

---

## 2. PRODUCT UI / GLOBAL CHROME

- **Launch Strip** — the persistent horizontal nav sequencing the five rooms inside the authenticated app. *Below the top nav on internal surfaces.*
- **Brand Register** — the dashboard's real name: one row per brand, rolling up every Intelligence Lab analysis, Briefing Room session, pipeline run and Phase 2 detonation. *`/dashboard`.*
- **Repository** — a password-gated document hub issued to a specific client or partner (e.g. the EY and KPMG repositories, plus the general "deck"). *Client-facing routes.*
- **Platform Overview (the "deck")** — the canonical full pitch/demo repository. *`/deck`.*
- **Demo Mode** — admin toggle switching the platform into client-walkthrough presentation state. *Top nav.*
- **Walkthrough** — a linear, read-only replay of one real session end-to-end, Room 00 → Room 04, used for demos. *`/walkthrough`.*
- **Kicker** — the small room/phase label above each walkthrough step (e.g. "Room 03 · Strategy"). *Walkthrough UI.*
- **Mobile Gate ("Designed for desktop")** — full-screen block preventing internal product use below 560px. *All internal routes.*
- **Deliverables** — the page compiling every document a session produced. *`/complete`.*
- **Phase 1 / Phase 2** — the two macro-phases of a session: strategy development (Stages 1–16) and Brand Detonation / creative (Stages 17–22). *Used throughout the UI and preflight.*
- **Stage N (with lettered variants 1B, 4B, 13B, 14B/C, 17B, 20B)** — the numbered internal pipeline steps. *Top nav progress, deliverables list, preflight.*

### Reliability & system-health vocabulary

- **Preflight** — the automated self-test system run before/around real sessions to confirm the pipeline is healthy. *Dashboard banner.*
- **Tier One (fast check)** — five lightweight checks under three minutes; drives "Platform Systems Live" / "System Issue Detected". *Dashboard banner.*
- **Tier Two (Full Integrity Check / "Run System Check")** — deep ~15-check end-to-end simulation of Stages 1–22 including checkpoints, the LOC track, SMP carriage and the Synthesiser skip path. *Admin panel; used to certify before client-facing use.*
- **Escalation Protocol** — the named response when a Tier Two check fails at blocker severity: "do not present live." *Preflight panel.*
- **Remediation Registry** — central store of fix instructions and ETA per failed preflight check. *Preflight panel.*
- **Supervision / Supervision Status** — the automatic retry layer for stalled jobs; stays silent while retries remain, surfaces "this needs a human" only once exhausted. *Intelligence Lab and job surfaces.*
- **Stall detected — recovering automatically** — the benign in-progress supervision state. *Status banner.*

### Human decision gates

- **Checkpoint A** — "Strategy Review — Brief": confirms the strategic reframe/tension before intelligence work begins. *Before Stage 2.*
- **Checkpoint B** — "Strategy Review — Propositions": confirms the propositions represent genuinely different worldviews before scoring. *Before Stage 9.*
- **Checkpoint C** — "Strategy Review — Selection": the human's final proposition pick, whose rationale carries through every later stage. *Before Stage 13.*
- **Checkpoint D** — the selected Detonation Territory sign-off. *Before Stage 18.*
- **Confirm and Proceed / Return for Revision / Escalate to Human Review** — the coined three-way action set on every checkpoint. *All checkpoint UI.*
- **Gate One / Gate Two** — the two creative-side human confirmation gates (individual directions; then the orchestrated cross-channel set). *Creative Stimulus Engine.*

---

## 3. ROOM 00 — RESEARCH SYNTHESISER

- **Research Synthesiser** — the optional research-ingestion room turning raw documents into structured, attributed field text for the Intelligence Lab.
- **The Six Synthesiser Categories** — the fixed taxonomy every ingested claim is bucketed into: Primary Consumer Research, Brand Health Tracking Data, Competitive Communications Audit, Cultural Trend Analysis, Audience Segmentation Research, Brand Grenade Intelligence Pack.
- **Synthesised Claim** — the atomic unit: one claim plus its category tags, source type, source document and verification status.
- **Source Type: externally_verifiable vs client_proprietary** — whether a claim can be checked publicly or must be trusted as client-supplied.
- **Verification Status: verified / unverified / contradicted / client_supplied / not_checked** — the five-state fact-check outcome per claim.
- **Handoff** — the payload passing brand, category and field text from Room 00 into Room 01.
- **Synthesiser Run** — a logged Room 00 activity record (in_progress / applied) kept for audit.
- **Research Provenance** — the UI card tracking where each piece of evidence originated.

---

## 4. ROOM 01 — INTELLIGENCE LAB (and Document 00A)

- **Strategic Territory Intelligence Engine** — the engine's self-identified persona in its own system prompt.
- **Document 00A / Strategic Territory Intelligence Report** — the Lab's canonical output document.
- **Territory** — a candidate strategic space the brand could occupy; the atomic unit of the report.
- **The Ten Analytical Layers** — the sequential processing pipeline: Research Input Assessment → Territory Classification → White Space Mapping → Permission & Vulnerability → First-Mover → Historical Validation → Cultural Adaptation → Audience & Commercial Assessment → Measurement Framework → Output.
- **Content-Coverage Model** — the principle that completeness is rated by actual content substance across six analytical dimensions, not by which form fields were filled in.

### The five territory types

- **Category Ownership** — claim an unclaimed core category promise.
- **Differentiated Positioning** — claim the edge the category leader cannot claim without contradicting itself.
- **Category Creation** — name and own a category frame that does not yet exist.
- **Hermit Crab (Opportunity)** — occupy territory or equity vacated by another brand, moving into the "shell" it left behind. *Sub-fields: shell value, vacancy timeline, return risk, shape compatibility, vacancy type.*
- **Moment-Activated Opportunity** — territory opened by a cultural, legislative or competitive event.

### Territory assessment vocabulary

- **White Space Mapping** — assessment of unclaimed space across four dimensions: perceptual, emotional, cultural, motivational (each with assessment, evidence and rational/emotional typing).
- **Brand Permission** — the brand's scored (1–10) right to occupy a territory, with permission sources and permission gaps.
- **First-Mover (Window)** — scored advantage of claiming first, with adoption-curve stage, competitive-response scenario, window duration and investment threshold.
- **Cultural Adaptation** — resonance rating (high / moderate / low / counterproductive) by context, adaptation requirement, cultural risk flags.
- **CALD Mapping** — Culturally and Linguistically Diverse community-level resonance and adaptation assessment.
- **Historical Validation** — risk class (low / medium / high / very high) supported by commercial and government precedents with their structural conditions.
- **Audience Readiness** — how ready the audience is for the territory: high / moderate / low / resistant.
- **Negative Space (flags)** — associations flagged as actively damaging if claimed.
- **Gateway Territory** — a territory that must be claimed first to unlock later ones.
- **Longevity & Saturation** — compounding potential, saturation timeline, evolution requirement and exit signal for a territory over time.
- **Measurement Framework** — brand associations to track, competitive-response signals, and behaviour-change metrics at three horizons (Immediate 0–4 weeks, Short-term 3–6 months, Medium-term 12–24 months), plus early-warning signals.
- **Strategic Recommendation (verdict)** — Claim / Do Not Claim / Claim With Conditions.
- **Completeness Assessment** — the Lab's self-report on inputs present, inputs absent, confidence level and gap impact.
- **Government Addendum** — extra block for government briefs: institutional trust assessment, backlash risk, accountability documentation, audience resistance mapping, CALD strategy.
- **Commercial Addendum** — the commercial-brief counterpart block.
- **Prebrief for the Briefing Room** — structured handoff (strategic anchor, tension, audience, cultural context, creative territory direction, must-include, must-avoid) passed into Room 02.

---

## 5. ROOM 02 — BRIEFING ROOM

- **Briefing Room** — the diagnostic engine that interrogates a brief; explicitly "aggregator and thinker, never a creator."
- **Strategic Anchor** — the fenced block capturing the Briefing Room's conclusion (anchored tension, anchored frame, open gaps) that all downstream stages must honour.
- **Real Problem / Real Opportunity** — the deliberate sibling pair: the same underlying truth run through a defensive frame and a generative frame simultaneously.
- **Thorpe Candidate** — an unexpected truth capable of reshaping a strategy. Three modes: **Shape** (contributes raw material to an unformed strategy), **Flip** (inverts a perceived weakness into strength), **Align** (connects the brand to an existing cultural platform it can earn rather than invent).
- **Motivator vs Discriminator** — the role tag on every extracted truth: a Motivator drives category purchase generally (table stakes); a Discriminator is what makes this brand specifically chosen. Guards against "motivators masquerading as strategy."
- **The Collide (Step 4)** — the pass that collides relevant truths against the diagnosed real problem to surface candidate tensions, deliberately without picking a winner.
- **Candidate Tensions** — the output of the Collide step.
- **Source Pills** — clickable provenance tags ("brief", "evidence:<label>") that jump back to the originating intake block.

---

## 6. ROOM 03 — STRATEGY PIPELINE (Stages 1–16)

### Stage 1 — Brief Sanitisation

- **Poison Words** — the hard-banned marketing vocabulary list (transformation, journey, authentic, empower, seamless, ecosystem, synergy, holistic, purpose-driven, storytelling, disrupt, community, passion, best-in-class, etc.). *Forces behavioural language from the first stage.*
- **Abstract Value Words** — the softer second list (fun, easy, simple, better, premium, powerful, meaningful, relevant) that must be behaviourally translated or cut.
- **The Eleven Structured Fields** — the brief-intake schema replacing free text: Strategic Objective, Commercial Outcome, Primary Barrier, What Has Already Been Tried, Current Belief, Desired Belief, Competitive Provocation, Audience, Reason to Believe, Mandatories, Never-Says.
- **Brief Depth (Level 1/2/3)** — never-stated internal classification of brief richness, used to calibrate compression.

### Stage 1B — Brief Quality Escalation

- **Brief Quality Escalation** — advisory gate that may only ask about five permitted strategic gaps (human truth, category tension, audience definition, competitive landscape, brand truth) and is forbidden from asking about budgets, timelines or proof. Human-overridable.
- **Brief Enhancement** — the user-facing name for the same trigger when Checkpoint A's tension score is below threshold.

### Stage 2 — Category Intelligence (the CMM)

- **CMM (Category Memory Map)** — Stage 2's whole output object, referenced as "the CMM" by Stages 3–13. Translated to "competitive intelligence" for client documents.
- **Core Category Promise Map** — every fundamental human-need promise the category makes, scored on occupancy, ownership strength, availability and proof gap.
- **Word Ownership (L1) / Claimed with Proof (L2) / Claimed without Proof (L3)** — the three-tier scale of how strongly a competitor owns a promise.
- **Owned / Weakly Occupied / Available** — the availability states per promise.
- **Proof Gap** — the specific evidence that would make an available promise defensible; named as "the strategic opening."
- **Category Competitive Territory Map** — the map of dimensions the category actually fights on (price, service, network).
- **Over-Contested / Committed / Under-Committed / Vacant** — occupancy intensity per dimension.
- **Dominant Basis of Competition** — the single default dimension everyone in the category reflexively competes on; the thing a disruptive brand must refuse. *Feeds BREACH.*
- **Most Ownable Under-Committed Dimension** — the thinly-held dimension a challenger could seize. *Feeds FLASHPOINT.*
- **Category Silence Map** — everything the category has structurally agreed never to say, ranked by strategic value. *Feeds proposition generation and Forbidden Zone checks.*

### Stages 3–4B — Frameworks, Universes, Asset Mining

- **Strategic Framework** — one of 3–6 distinct high-level approaches, each defining the rules of a different strategic universe.
- **Strategic Universe** — a coherent strategic "world" built from a single human/cultural contradiction; one per framework.
- **SIS (Strategic Interpretation Set)** — the collective name for the Stage 4 output. Translated to "strategic directions evaluated" for clients.
- **Real Fact vs Perceived Fact** — independently verifiable vs audience-accepted-as-true product facts.
- **Liability Reinterpretation Question** — the technique of asking whether an apparent weakness, viewed from another angle, becomes the most powerful truth (Guinness's 119.5-second pour).
- **Distinctive Asset Mining** — the three-question interrogation applied to every brand asset: what does it make possible, what proposition could only come from it, what creative idea becomes inevitable if it is centred.
- **Strategic Potential Summary** — the single most potent fact + asset combination, passed forward as mandatory input.

### Stages 5–7 — Insight and Territory

- **Six Territory Insight Generation Model** — the mandatory six-lane insight framework preventing grievance-default: **Tension, Abundance, Identity, Cultural Moment, Product Truth, Whitespace** (Tension capped at 2 per universe).
- **Unexpected Behaviour Filter** — the single validation test: would a smart, self-aware audience member say "I never thought of it that way"?
- **Category Observation vs Human Truth** — the fail/pass labels from that filter. An observation produces recognition; a truth produces revelation.
- **Strategic Territory** — the synthesised organising tension per universe.
- **Strategic Foundation** — the single blockquoted sentence inside each territory that is the direct input to proposition writing. (Client-facing translation of "Constraint Statement".)

### Stage 8 — Proposition Generation

- **SMP (Single-Minded Proposition)** — canonical expansion; "Strategic Master Proposition" is retired. The 4–12 word core strategic line; the spine of the entire platform. Translated to "strategic proposition" for clients.
- **CRAB** — the writing standard every proposition must pass: **C**lear, **R**elevant (fails the swap-the-brand-name test if not), **A**ppealing, **B**elievable.
- **Active Promise** — the required proposition form: a directive the brand can act on, as opposed to a passive atmospheric observation, which auto-fails.
- **Anchor / Anchor Gate** — the universal rule that no proposition may be output without naming one real, verifiable capability that defends it. Structurally enforced before an LLM gate.
- **Real Capability Register** — the fixed list of genuinely real mechanisms an anchor may cite.
- **Buyer Gain** — the mandatory "what the buyer gains" line carried verbatim from Stage 8 through Stage 14.
- **Nine Analytical Approaches** — the classification scheme propositions must be traceable to, compressed until only one approach could have produced them.

### Stage 8/9 — The three disruption engines

- **BREACH** — refuses the category's Dominant Basis of Competition and relocates the proposition to an unused human truth. A challenger's weapon.
- **FUSE** — climbs from what the product literally is to the real job it is hired for, using the product as proof.
- **FLASHPOINT** — plants a flag on the Most Ownable Under-Committed Dimension and commits totally (Avis "We Try Harder").
- **Truth-Anchor** — the per-engine check that the claimed relocation, climb or dimension is genuinely real and ownable.
- **Brand Position Read (Leader vs Challenger)** — mandatory classification gating whether BREACH is advisable; leaders receive a **Leader Caution** flag.
- **Owns the Word** — optional single-word compression an engine may output if a natural one-word claim exists.

### Stage 9 — Distinctiveness & Ownership Review

- **Strategic-Impossibility Analysis** — proving, per named competitor, why they could not adopt the line without self-implication (contradicting their positioning, model, operational truth, or looking derivative).
- **Self-Executing vs Platform** — whether a proposition is already consumer-facing sharp, or strategically precise but needs a Phase 2 creative idea to come alive.
- **The Five Stress Tests** — Tension Test, Exclusion Test, Standalone Test, Spoken Language Test, Category Convention Test.
- **Anti-Convergence Rule** — no two propositions in the final set may share the same root tension, register or frame.
- **EDT Guard** — Emotional Direction Test guard: the universal banned-word enforcement block in Stage 9 (apology / guilt / permission language banned outright). *Stage 9 prompt and preflight checks.*
- **List A (Universal Banned)** — zero-exception banned words: apology, guilt, transformation, journey, authentic, unleash, elevate, redefine.
- **List B (Conditionally Banned)** — allowed unless a named competitor owns them or the brief excludes them: reward, earn, deserve, permission.
- **Candidate Disposition Ledger** — the closing table accounting for every candidate as SURVIVED / REBUILT INTO / REJECTED, so nothing is silently dropped.

### Stage 10 / 12 — Scoring

- **The Six-Dimension Validation Framework** — the shared rubric applied to core and LOC propositions alike: **Fame (30%), Truth Strength (20%), Competitive Impossibility (15%), Brand Permission (10%), Clean Air (10%), Commercial Precedent (5%)**.
- **Clean Air** — the dimension measuring whether a territory is currently occupied by a named competitor claim (not generic word usage).
- **Hard Floors** — automatic elimination thresholds computed in code, not by the model: Truth Strength < 5 or Competitive Impossibility < 6.
- **Weighted Composite** — the code-computed /100 total.
- **CODE COMPOSITE / CODE VERDICT** — the authoritative machine-computed score and PASS/FAIL/ELIMINATED verdict, overriding model prose.
- **Frozen Stage 10 Scores** — the locked score block Stage 12 must copy verbatim rather than recompute.
- **Structural Neutrality** — the rule that every proposition card is presented at identical depth and format with no ranking language.
- **Selection Rationale Stub** — the placeholder filled only after the human makes their Checkpoint C selection.

### Stage 11 — Pressure Test

- **The Five Pressure Tests** — Competitive Counter-Proposition, Time-Decay (3-year horizon), Credibility Under Scrutiny, CMM Forbidden Zone Pressure, Iconic Tier Sustainability.
- **HOLDS / WOBBLES / CRACKS** — the three-state verdict vocabulary across all five tests.
- **Forbidden Zone** — the CMM-derived category convention a proposition must not drift into under interpretive pressure. Translated to "overcrowded territory" for clients.
- **Iconic Tier** — a flag claiming an SMP simultaneously activates all three truth types; can be confirmed, downgraded or eliminated under pressure.
- **Strategic Constraint Statement** — the underlying contradiction logic a rewrite must preserve.

### Stage 13 / 13B — Brand Fit and Precedent

- **Forcing Proposition vs Genuine Mismatch** — when a proposition promises more than the brand delivers today: a Forcing Proposition has a credible buildable path to close the gap (Avis); a Genuine Mismatch is structurally unfixable.
- **Most Vulnerable Credibility Dimension** — the lowest-scoring of six brand-fit dimensions (Product Truth Alignment, Audience Permission, Tonal Compatibility, Behavioural Capacity, Cultural Authority, Historical Consistency), used to drive guardrails.
- **STRL (Strategic Territory Reference Layer)** — the historical-precedent module: finds real campaigns from the same strategic territory (not category, not execution) as evidence the territory is viable — never as creative inspiration. Translated to "historical precedent" for clients.
- **Territory Type Classification (STRL)** — Identity Contradiction, Social Mirror, Cultural Shift, Anti-Category Truth, Product Truth Reframe, Behavioural Naming, Disruption Route, Challenger Brand Mode, Other.
- **Differentiation Safety Check** — the closing instruction telling creative teams what not to do so they don't replicate the historical references' surface.

### Stages 14 / 14B / 14C — Creative Territory

- **Creative Territory Mapping** — the seven dimensions describing the creative landscape a territory opens without generating executions: Emotional Landscape, Behavioural Moments, Tonal Register, Channel Dimensions, Cultural Conversations, Territory Boundaries, Creative Potential Assessment.
- **Territory Interior / Territory Exterior** — the explicit inside/outside boundary statements.
- **Creative Expression Mapping (14B)** — translates territory into observable cross-channel behaviours; governed by "how does this SMP behave", not "what could we create".
- **Channel Hierarchy (14B)** — Film/Long-Form (primary articulation), Social/Short-Form (fragmented proof), Influencer/Creator (personalised interpretation), Activation/Experiential (physical manifestation), Partnership/Sponsorship (cultural validation).
- **Anti-Drift Check** — the internal test that no new strategic idea, campaign language, or territory-exterior content has crept into a channel expression.
- **Strategic Universe Definition (14C)** — builds a self-contained creative universe the brand inhabits; coherence over creativity.
- **World Lens** — the five selectable lenses for building the universe: Behavioural, Cultural, Contradiction (default), Category, Product.
- **Rules of the World** — the 5–7 mandatory behavioural rules a universe must define (reward, punishment, normalisation, contradiction, category-distinction).
- **Human Roles / Archetypes** — behaviour-only archetypes (no demographics or psychographics).
- **Strategic Continuity Statement** — the closing north-star paragraph tying the universe back to the SMP.

### Stage 15 — Strategic Consistency Audit

- **The Nine Audit Checks** — Derivation Chain Integrity, Constraint Integrity, SMP Overlap, Category Convention Contamination, Brand Fit Consistency, STRL Differentiation, Language Compliance, Voice Consistency, Specificity.
- **Harmful Drift / Productive Evolution / Uncertain Alignment** — the three-way classification of any inconsistency: Harmful Drift always flagged, Productive Evolution documented not flagged, Uncertain Alignment capped at two instances.
- **Brand Name Removal Test** — strip the brand name from a paragraph; if it still reads as generic strategy, it is flagged.
- **Pipeline Clearance Declaration** — the final verdict: CLEARED / CLEARED WITH ACCEPTED EXCEPTIONS / CLEARED WITH UNCERTAIN ALIGNMENT ADVISORIES / PENDING RESOLUTION.

### Stage 16 — Output Packaging

- **Internal Pipeline Terminology Translation** — the mandated jargon-stripping map for client documents: CMM → competitive intelligence; SIS → strategic directions evaluated; SMP → strategic proposition; STRL → historical precedent; Constraint Statement → strategic foundation; Forbidden Zone → overcrowded territory; Whitespace Zone → available territory; Human Contradiction Statement → the human insight.
- **Alternatives Loop Rule** — the selected proposition may never appear in the "alternatives considered and rejected" section.
- **The Proposition Reveal** — the structural device of withholding the winning SMP until Part Seven so it lands as an earned conclusion.

---

## 7. THE LEFT-OF-CENTRE (LOC) ENGINE TRACK

- **Left-of-Centre (LOC)** — a parallel track of 13 independent generative engines that do not reason from the brief; they "observe, collide, invert, displace and recognise" to reach propositions the core pipeline structurally cannot. Orthogonal to, not better than, the main pipeline. *Runs alongside Stages 8–12; results merge into Stage 12 with source badges.*
- **The Governing Principle** — the meta-rule above all engines: you are not generating, you are recognising a line that already exists somewhere in the world.
- **Process Field** — the mandatory 3–5 sentence field showing the engine's move executed step by step, so the move is auditable and unfakeable.
- **Brief-Isolated Engines** — the subset structurally denied brand/category/brief context so they cannot be seeded or flattered by the client's own framing.
- **Case Library** — cross-category real campaigns tagged with a structural principle each engine must state and then explicitly set aside rather than copy.

### The thirteen engines

- **Inversion** — name the category's one sacred assumption and build its total structural opposite (VW "Think Small").
- **Constraint** — impose one impossible communication constraint (no visuals, no product) and write only from what survives.
- **Wrong Room** — build the brand entirely inside an unrelated industry's logic (a Western, a space programme, a wildlife documentary) and translate back with no visible trace of the source.
- **Delete the Customer** — remove the commercial relationship entirely, find the brand's conviction as if nobody bought anything, then reintroduce the customer last as whoever recognises themselves in it.
- **Worst Case** — take the biggest liability and turn it outward as the spine of the proposition, not ironically.
- **Random Connection** — force a genuinely random stimulus into collision with the brand and write the line from what the collision reveals.
- **Time Displacement** — go back fifty years, find something true the category abandoned for fashion rather than truth reasons, and bring it forward.
- **Enemy First** — name a belief or convention (never a competitor) the brand exists to destroy, specific enough that people on the wrong side feel accused.
- **Subtract** — strip name, product, category and claimed values until something resists removal; the remainder is the brand.
- **The Unsayable** — find the category's polite fiction — the thing everyone knows and nobody says because it would indict them — and say it plainly.
- **The Moment** — find a universal undefined human occasion and the specific preparatory moment where the brand intercepts it.
- **One Word Ownership** — commit to owning a single category word through expression that never states the word itself.
- **Invented Authority** — invent or borrow a figure or moral standard so completely realised that association implies quality without claiming it.

- **Per-engine intermediate fields** — the mandatory pre-proposition fields forcing the move to actually happen: sacred_assumption, wrong_room_chosen, lines_from_inside, ideology, stimulus, abandoned_truth, enemy_named, polite_fiction, word_owned, expression_line, authority_figure.
- **LOC Task Types** — a legacy engagement classification retained for case-library compatibility: Total Revitalisation, Relevance Extension, Challenger Disruption, Category Relocation, Permission Expansion, Crisis Repositioning, Cultural Moment Capitalisation.

---

## 8. PHASE 2 — BRAND DETONATION (Stages 17–22)

- **Brand Detonation** — the product name for Phase 2: turning validated strategy into a Master Detonation Brief.
- **Three Truth Canvas** — the intake step confirming Product, Consumer and Cultural truths plus Brand Intelligence before Phase 2 runs.
- **Product / Consumer / Cultural Truth ("The Three Truths")** — the three confirmable truth types underpinning every territory and detonation.
- **Global Creative Direction** — the persistent free-text steer applied to all cards on retry across multi-card Phase 2 stages.

### Stage 17 — Detonation Territory

- **Detonation Territory** — the creative world a strategy can live in, sitting between the SMP and The Detonation. Exactly three are generated.
- **SMP Alignment Check** — the six-step test and mandatory output line proving a territory makes the SMP alive rather than generic.
- **Territory Status: ONE TRUTH / TWO TRUTHS / BRAND DNA TERRITORY** — how many of the Three Truths a territory connects to.
- **Influence Architecture** — the 2–3 psychological mechanisms a territory operates through.
- **Semiotic Opportunity** — the ownable visual, verbal and tonal space a territory opens.
- **Creative Share of Voice** — the coined metric for disproportionate attention-earning capacity, scored via Emotional Weight, Fame Potential and Distinctive Asset Leverage. *Recurs in Stages 17B, 18 and 20.*
- **Brand Intelligence Alignment** — what a territory builds on, challenges, and requires the brand to develop.

### Stage 17B — Detonation Intelligence

- **Detonation Ambition Benchmark** — the single named historical campaign set as the quality bar Stage 18 must aspire to.
- **Creative Share of Voice Mechanism** — analysis of how a historical campaign achieved fame, emotional potency and asset consistency.
- **Detonation System Principles** — the numbered requirements a Detonation must satisfy to become an enduring system, not a burst. *Re-checked in Stage 18, restated in the Stage 20 brief.*
- **Endurance Factor** — what made a reference campaign more powerful over time.
- **Failure Mode** — the point at which a reference campaign lost energy, used to define the protection the new territory needs.
- **Differentiation Guidance** — the explicit do-not instructions preventing surface-level copying of the historical references.

### Stage 18 — The Detonation

- **The Detonation** — the core coinage: the single thought that makes the SMP explosive in the world. Explicitly not a tagline, campaign concept or conventional ad idea.
- **The Detonation Line** — the short 3–7 word campaign-line form.
- **The Detonation Statement** — the one-sentence full strategic articulation beneath the Line; "the most important sentence in Phase 2."
- **The Detonation Description** — the three-paragraph elaboration.
- **The Eight Dimension Stress Test** — the mandatory internal test (≥72/90) every candidate must pass: **Ubiquity of Expression, Temporal Durability, Executional Infinity, Competitive Immunity, Cultural Participation, Semiotic Distinctiveness, Psychological Potency, Share of Voice Efficiency**.
- **The Courage Requirement** — the check for whether a Detonation creates strategic discomfort on presentation. Scored STRATEGIC DISCOMFORT PRESENT/ABSENT, with COURAGE REVIEW RECOMMENDED as the flag when absent.
- **The Compounding Assessment** — binary classification as **CAMPAIGN** (burst lifecycle) or **PLATFORM** (compounds over time). Drives Stage 19's media logic.
- **Detonation Status: ONE TRUTH / TWO TRUTHS / BRAND DNA DETONATION** — mirrors Territory Status at idea level.
- **Creative Springboard** — the Stage 18 step turning a validated Detonation into craft inspiration. *The named mechanic set it draws on (Headline Craft Library) now lives in `docs/methodology-inventory.md` (P26).*

### Stage 19 — Activation Architecture

- **Activation Architecture** — the name for Stage 19's whole output: not a media plan but a translation system for how the SMP behaves per channel.
- **Audience Mindstate** — the precise psychological state of the audience at the moment of exposure; the central unit of analysis per channel.
- **SMP Translation** — the rule that the fixed SMP is translated per channel, never diluted.
- **Channel Balance** — mandatory presence of at least one Awareness, one Deepening and one Conversion channel.
- **The Channel Hierarchy** — Primary / Amplification / Conversion / Sustaining.
- **Emotional to Rational Calibration** — the required stated split (e.g. 65/35) governing channel choice.
- **Channel Ecosystem View** — the narrative of how channels form one journey.
- **Creative Consistency Brief** — the 5–7 non-negotiables holding the campaign together across channels.
- **Compounding Media Strategy** — how the CAMPAIGN/PLATFORM determination becomes burst-vs-always-on media logic.

### Stage 20 — Master Detonation Brief

- **Master Detonation Brief** — the one-page brief handing The Detonation to creative teams; the flagship Phase 2 deliverable.
- **Brief Quality Score** — mandatory pre-output gate (composite ≥40/50) across five dimensions: **Emotional Clarity, Fame Invitation, Distinctive Asset Integration, Psychological Leverage, Creative Share of Voice Ambition**. Independently re-scored in code.
- **The Single Most Important Response** — the one-sentence desired feeling or action.
- **The Cultural Context** — the "why now" section.
- **The Compounding Mechanism** — how the work gets more valuable with each execution.
- **What the Work Must Never Do** — the maximum-three strategic boundary items.

### Stage 20B — Channel Strategy

- **Long and Short — The Investment Architecture** — classification of every channel as brand-building "Long" or activation "Short".
- **Low Attention Processing** — classification of channels by attention mode (high vs low attention).
- **Mental and Physical Availability** — applied as a channel-plan requirement.
- **Jobs to Be Done at Every Touchpoint** — each channel must name the job the audience is hiring it to do.
- **Distinctive Asset Architecture** — which brand assets appear unchanged vs adapted per channel.
- **The seven fixed sections** — Audience Behavioural Portrait, Media Journey Map, Channel Role Assignment, Mindstate Map, Behavioural Economics Activation Plan, Distinctive Asset Deployment Plan, Orchestration Logic. *Used verbatim as parsing anchors by Stage 21.*

### Stage 21 — Channel Detonation Briefs

- **Channel Detonation Briefs / Channel Briefing Engine** — per-channel creative briefs generated from the master brief.
- **The Locked Campaign Line / Carriage Check** — the mandatory verbatim reproduction of the locked line in every channel brief.
- **Line Contamination** — internal QA term for the Detonation Line leaking or mutating across stages; guarded by the carriage check.
- **Framework Activation Instruction** — the section naming the psychological mechanism at a touchpoint and translating it into a creative instruction.
- **Orchestration Summary** — closing synthesis naming memory-building vs conversion channels and the compounding mechanism.

### Stage 22 — Brand Architecture

- **Brand Architecture (the six-part output)** — **Domain, Heritage, Values, Assets, Personality, Reflection**.
- **Reflection** — the single belief statement, described in the prompt as "the most important output in the entire Brand Grenade system."

---

## 9. ROOM 04 — CREATIVE ENGINE / CREATIVE STIMULUS ENGINE

- **Creative Stimulus Engine** — the canonical name for the whole Room 04 ideation subsystem, client-facing and internal alike.
- **The 37 Lenses / 37-Lens Sweep** — the fixed library of named creative angles of attack, each generating a divergent big-idea direction. Includes: The Silent Proof, The Naked Truth, The Famous Face, The Impossible World, The Brand Anthem, The Living Series, The Undeniable Test, The Absent World, The Environment Is The Idea, The Living Character, The Iconic Property, The Child's Version, The Brand Story, The Enormous Problem, The Unsung Human, The Other Dimension, The Origin, The Cultural Signal, The Human Motivation, The Worthy Opponent, The Fear Inside, The Undeniable Fact, The Unexpected Endorsement, The Time Machine, The Rare Thing, The Bookmark Moment, The Human Object, The Broken Rule, The Solution First, The Sensory World, The Ignition Point, The Better World, The Misdirection, The Shock of the New, The Relief, The Hidden World, The Open Question.
- **37-Lens Sweep** — the one-per-session pass where every lens answers the verbatim SMP.
- **Root Tension** — the one-line, device-stripped statement of an idea's underlying human contradiction; the unit compared across the sweep.
- **Idea Collision Check** — the per-idea test comparing its Root Tension against every prior idea, distinguishing shared underlying territory from merely similar subject matter.
- **Idea Convergence Ledger** — the full-set second-pass audit re-running the collision check across all ideas at once, catching clusters the sequential check misses.
- **CRAB** — reused here as one of the eight Gate One rating dimensions.
- **Candidate Master Line** — the 3–7 word standalone line each lens produces as a candidate master line.
- **Expression Under Master** — how a lens's idea locks up under an already-locked master line.
- **Creative Guidance / Compliance Ledger** — the operator-supplied creative steer applied across a sweep, with a live arithmetic ledger of how many lenses are ALIGNED against target.
- **Keep / Keep In Play / Kill** — the three-way triage verdict on each lens output.
- **Tissue Check** — the human triage pass immediately after the sweep, where raw stimulus (explicitly "not finished work") is manually screened before rating.
- **Initial Instinct Brief** — the human triage note captured at Tissue Check and carried forward as binding instruction into production prompts.

### Gate One — the eight rating dimensions (never averaged into one number)

- **Strategic Compliance** — does the idea dramatise the SMP's tension; must name a Journey Placement.
- **Journey Placement** — the real, concrete moment in the audience's life the idea occupies.
- **Brand Glue** — does it build reusable brand equity or is it a one-off; must name a reusable asset.
- **CRAB** — Clear, Relevant (requires a stated human truth), Appealing, Believable.
- **Fame** — genuine cultural cut-through potential.
- **Creative Uniqueness** — live web-search-verified check against real prior or competing campaigns.
- **Creative Ambition** — judgement of how far the idea reaches.
- **Producibility** — feasibility flag, explicitly not a quality score.
- **Brand Integrity Check** — flags risk to the brand, can carry a flag note.
- **Seasoned Creative Director Pass (tiebreaker)** — a qualitative non-numeric second opinion when ratings are too close to call.

### Orchestration and Gate Two

- **Orchestration Engine** — the pass across every Gate One-confirmed channel prompt building the Signature Registry, cross-references, craft pass and CD judgement.
- **Campaign Signature Registry** — the ledger of signature-worthy sonic, visual, verbal and structural devices extracted from approved prompts, used to check and propagate cross-channel consistency.
- **Signature Propagation Pass** — suggests (never mandates) echoing one channel's signature in another.
- **Perfect Imperfection Standard** — the standing craft rule that every production prompt must name one deliberate flaw (a blown highlight, an off-mic line) rather than an optimised default.
- **Writer and Art Director Pass** — the craft QA judging language quality, medium fit and Perfect Imperfection.
- **Creative Director Pass / Cohesion** — the whole-set review judging whether the prompts read as one campaign; produces the **Cohesion verdict** and an attached **CD note**.
- **Creative Director Mandate (Gate Two Mandate)** — the binding one-element instruction the CD can force across every channel prompt, expressed natively per channel.
- **Mandate Compliance Check** — the present/weak/absent audit verifying the mandated element is genuinely there. If ABSENT anywhere, Gate Two cannot be confirmed by any human.
- **Adaptation Fidelity** — the score measuring how faithfully a generated channel execution still matches the locked big idea and line.
- **Line Check** — the check of a generated line against the locked master line.
- **Staleness** — the state where a stimulus run's snapshot of the Stage 21 brief is invalidated because the locked big idea or campaign line has since changed.
- **Big Idea (locked) / Locked Campaign Line / Room 04 Lock** — the authoritative locked creative record that supersedes all earlier drafts and is rendered verbatim in documents.
- **Orchestration Prompt Set** — the deliverable of tool-specific, paste-ready production prompts plus the Gate Two decision record, Signature Registry and cross-references.
- **Raw Idea Export** — export of an individual generated direction in raw form.

---

## 10. THE DOCUMENT SYSTEM

### Document types

- **Board Strategy Recommendation** — the client-facing board deliverable.
- **Consulting Delivery** — the working delivery document for the agency/consulting team; adds a "what this means for delivery" callout.
- **Master Detonation Brief (document)** — the creative-brief deliverable.
- **Strategic Territory Intelligence Report (Document 00A)** — the Intelligence Lab deliverable.
- **Brand Strategy and Creative Intelligence Summary (Strategy Executive Summary)** — the synthesised whole-session summary, assembled from stored data with no new AI run.
- **Full Pipeline Run** — the complete stage-by-stage reproduction document, driven by the **Stage Manifest**.
- **Full Creative Showcase** — the presentable document rendering one locked campaign in full. Structured as **Movement 01 — The Foundation, Movement 02 — The Expressions, Movement 03 — Proof of Coherence**, plus a **Campaign Signature Registry & Consistency Trace** appendix.
- **Vision / Agency / Consulting / Workshop formats** — the four alternate output styles for the Phase 1 platform document.

### Canonical structure

- **The Minto Pyramid / Canonical Minto Template** — the mandatory ordered section set every primary deliverable must contain: recommendation first, then reasoning, evidence and action.
- **Document Spec** — the per-document-type contract (front matter + appendix) the runtime gate and audit script check against.
- **Front Matter vs Appendix** — the canonical Minto argument (01–10) vs the numbered evidence cards (01–N).
- **Section Kicker** — the fixed label above each section ("The recommendation", "Business issue", "Current state versus recommended change", "Decisive recommendation — next step").
- **Fallback Text** — the canned sentence rendered when a builder has no content for a slot, so a section is never silently dropped.
- **Stat Band** — the auto-columned headline numeric callouts beneath the recommendation.
- **Pipeline Appendix** — the 15 named evidence cards: Brief & Context, Category Intelligence, Strategic Frameworks, Strategic Universes, Insight Generation, Insight Validation, Territory Synthesis, Proposition Generation, Distinctiveness Check, Proposition Scoring, Integrity Testing, Proposition Selection, Brand Fit Validation, Territory Mapping, Coherence Audit.
- **Detonation Appendix** — the 6 creative-phase cards: Detonation Territory, Detonation Intelligence, The Detonation, Activation Architecture, Master Brief Detail, Brand Architecture.
- **Condense Stage** — the shared summarisation pass keeping headings and strongest lines for condensed appendix mode.

### Current State vs Recommended Change (shared section)

- **Current State versus Recommended Change** — the section comparing what the brand already does against what the recommendation asks, so a recommendation never reads as made in a vacuum.
- **Already in Market** — existing activity, quoted and cited from the corpus.
- **Currently Implicit or Fragmented** — asks the corpus already partly evidences, which the recommendation makes explicit.
- **Genuinely New** — asks with zero corpus support.
- **No Baseline** — the honest state when the corpus contained no statement of current activity at all.
- **Verification wording** — "independently confirmed", "not independently verified", "as supplied by the client, unconfirmed".
- **Verification Fragment** — a sentence that only certifies another claim; folded onto its parent rather than left standing alone.

### Integrity, safeguards and gates

- **Document Gate** — the hard structural checkpoint every builder's output passes; throws rather than shipping an incomplete or leaking document.
- **Boundary Sealing** — repair cutting off content that has bled into the next canonical section.
- **Selection-UI Stripping** — removal of internal pipeline chooser markup ("CANDIDATE SET — select one", "A · BASE/BREACH/FUSE/FLASHPOINT") that must never reach a client.
- **S1 — Token Humanisation Safeguard** — no raw internal enum or field value may render in client prose.
- **S2 — Verdict-as-Rationale Safeguard** — a rejected option's own verdict word may never stand in as its explanation.
- **U1 / U2 — Universal Structure Rules** — every document must have a Background and Context section, and must end with a decisive recommendation / next step.
- **System Token Map** — the central dictionary mapping internal enums (hermit_crab, white_space, first_mover) to reader-facing phrases.
- **Authority Precedence** — the rule that the most recently locked source wins, triggering real-time document rebuilds on re-lock.
- **The Certification Criteria** — the named integrity checks every document must pass before publishing:
  - **COMPLETE** — no empty section, bare heading or mid-sentence cutoff.
  - **CLEAN** — no run IDs, timestamps, brief metadata labels, raw markdown or word-count annotations.
  - **VOICE** — no first-person system commentary escaping into the document.
  - **CONSISTENT** — a stated count of a noun matches every other mention of it.
  - **PROMISED** — a section promising N items renders N items.
  - **PLACED** — a heading sits in the section it topically belongs to.
  - **DUPLICATE** — nothing is printed twice.
  - **SCHEMA** — fixed-field sections carry every required field with a real value.
  - **DISPOSITION** — anything named as eliminated or rejected is accounted for in the disposition section.
  - **CHECKPOINT** — a document may not read as fully cleared while checkpoints remain unsigned.
- **Close Incomplete Tail** — drops a sentence cut mid-thought in a stored stage output rather than inventing an ending.
- **Remove System Voice** — strips first-person process narration while preserving quoted speech.
- **Scaffold Prose / Bookkeeping Line** — internal process text ("SMPS RECEIVED FROM STAGE 10: 5") that must never be promoted into a document section.
- **Not Independently Scored** — the honest callout when a finalised proposition post-dates the Stage 10 scoring pass.
- **"How the recommendation relates to this set"** — the callout explaining the winning proposition may not literally be a row in the scored table because it was resolved at selection.

---

## 11. OPEN ITEMS / FLAGS FOR REVIEW

- **EDT Guard** — resolved: EDT expands to Emotional Direction Test; the expansion is now written into the Stage 9 prompt heading and the preflight check labels.
- **Headline Craft Library (Stage 18)** and **Channel Framework Library (Stage 21)** — resolved: both relocated to `docs/methodology-inventory.md` (P26, P27) as structured technique libraries, not vocabulary.
- **"Jaguar pool"** does not exist as a platform concept in the code; "Jaguar" appears only as an example/test brand name. Likely a recollection from a session, not a term.
- **Room numbering** — resolved: one convention, "Room NN · Name", defined in `src/lib/rooms.ts` and applied across the marketing site, the dashboard register and the walkthrough.
- **Terms with two names** — resolved. Canonical names now applied platform-wide: SMP = Single-Minded Proposition; Room 03 = Strategy Pipeline; Room 04 = Creative Stimulus Engine (the simpler client-facing "Creative Engine" has been merged into it); the sweep = 37-Lens Sweep; the Phase 2 output = Brand Detonation ("Phase 2" survives only as internal stage-sequencing shorthand, never as a product name).
