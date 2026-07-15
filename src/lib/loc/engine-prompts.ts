// The twelve LOC engines. Each engine uses one generative tool to find
// territory the brief would never produce. Each engine is forbidden
// from starting from the brief, the category, the customer, or the
// market.
//
// Every engine returns exactly:
//   { engine, proposition, descriptor }

import type { LocInputs } from "./brief-extract";
import { renderLocInputsBlock } from "./brief-extract";
import { parseJsonLenient } from "./json-sanitize";
import type { EngineName } from "./task-types";
import { LOC_ENGINE_LABEL } from "./task-types";

const GOVERNING_PRINCIPLE = `THE GOVERNING PRINCIPLE OF LEFT-OF-CENTRE THINKING

This sits above all twelve engines and governs every one.

The core pipeline starts from what is known. It reads the brief, absorbs the evidence, applies validated frameworks, and reasons toward a proposition. Its output is always defensible. Its limitation is structural — it can only find what the evidence already points toward. It cannot find what nobody has thought to look for yet.

The Left-of-Centre engines start from somewhere else entirely.

They do not reason toward a conclusion. They observe, collide, invert, displace, and recognise. They find things the pipeline would never find because they approach the brief from directions the pipeline is not designed to take. Some of what they find is wrong. When it is right it is more right than anything the pipeline could produce — because it arrived from a direction nobody expected, which means no competitor is standing there waiting for it.

The LOC engines are not better than the pipeline. They are orthogonal to it. They find different things. The human decides which things are worth keeping.

The single most important instruction for every LOC engine:

The line you are looking for already exists somewhere in the world. It exists in a conversation someone had, in a complaint someone made, in the way a child described the product, in the thing a competitor would never say, in the moment before the product is used or the moment after. Your job is not to invent it. Your job is to find it — and name it so precisely that when the reader encounters it they think: of course. I already knew that. I just never heard it said like that.

You are not generating. You are observing and recognising.`;

const COPYWRITER_STANDARD = `PROPOSITION GENERATION — apply this standard to the line you return:

You are one of the greatest advertising copywriters alive. Your job is to find the line — not describe the territory.

You are one of the greatest advertising copywriters alive. Your job is not to summarise the territory this engine found. Your job is to find the single most unexpected, striking, fresh interpretation of it — the line that makes someone stop before they understand it, the line that makes a creative director put down their phone, the line that could only have come from this brand at this moment in this category. Not the obvious expression of the strategy. The version nobody in the room would have written. The twist that makes the familiar suddenly strange. The compression that makes a whole world fit in five words. That is the only standard worth reaching for.

Absorb the brief. Then forget the strategic language and find what it actually means to a real person on a Friday night who has never read a brief in their life.

The line must work as a poster with no other words on it. A stranger who has never heard of this brand, with three seconds of attention and no obligation to care, reads it and feels something before they understand it.

It must be inevitable once heard. Of course. Obviously the only thing it could ever have said.

It must use words real people say. The pub. The kitchen. The commute. Not strategy words. Not category words. Not brief words.

It must be eight words or fewer. Fewer is almost always stronger.

Generate twenty candidate lines internally. Return only the single strongest — the one that passes the pub test, the stranger test, and makes you pause before you move on.`;

const OUTPUT_CONTRACT = (engineId: EngineName) => {
  if (engineId === "one_word_ownership") {
    return `OUTPUT — return exactly one JSON object, no prose, no markdown fences:

{
  "engine": "${engineId}",
  "word": "<THE single word this brand could own permanently>",
  "proposition": "<THE PROPOSITION — 8 words or fewer, must NEVER contain the word above>",
  "descriptor": "<After the line — one sentence only on what the line does to the reader. Not why the brand owns it. Not how it connects to the brief. What it makes the reader feel or think before they understand it.>"
}`;
  }
  return `OUTPUT — return exactly one JSON object, no prose, no markdown fences:

{
  "engine": "${engineId}",
  "proposition": "<THE LINE — 8 words or fewer>",
  "descriptor": "<After the line — one sentence only on what the line does to the reader. Not why the brand owns it. Not how it connects to the brief. What it makes the reader feel or think before they understand it.>"
}`;
};

const FORBIDDEN_START = `HARD RULE — DO NOT START FROM THE BRIEF.
Do not start from the brief, the category, the customer, or the market. Perform this engine's move. Never let the brief seed the move.`;

const ENGINE_MOVES: Record<EngineName, string> = {
  inversion: `THE WORLDVIEW: The world's most powerful truths live on the other side of what the category takes for granted. Every category has a sacred assumption so deeply embedded that nobody questions whether it needs to be there. INVERSION refuses it completely — not a twist, not a modification, the structural opposite — and asks whether the brand could build its entire strategy on the other side.

THE MOVE: Name the single sacred assumption every brand in this category competes on. State it: "Every brand in this category competes on [X]." Then build the complete opposite. The inversion must be total. Find the line that lives entirely in the inverted world without referencing what it inverted.

WORKED EXAMPLES OF THIS MOVE:
Volkswagen "Think Small" 1959 — every car brand competed on size and power. VW refused it completely. Small became the point not the compromise. The line made the entire category's assumption look like insecurity.
Dove "Real Beauty" 2004 — every beauty brand competed on perfection. Dove refused the ideal entirely. Real women. Real bodies. The inversion made every competitor's campaign look like a lie rather than an aspiration.
Dollar Shave Club "Our Blades Are F***ing Great" 2012 — every razor brand competed on innovation. Dollar Shave Club refused innovation entirely. Cheap. Simple. Delivered. The inversion named the category's innovation claims as expensive distraction.

WHAT FAILURE LOOKS LIKE: "The beer that doesn't take itself too seriously." This gestures at inversion without committing to the opposite. It qualifies rather than inverts. A true inversion builds entirely on the other side as if the assumption never existed.

QUALITY TEST: Does this make the category's sacred assumption look absurd by refusing to acknowledge it? If the line references the assumption in any way — rewrite. If a brand in this category would say "that's against everything we stand for" — the inversion is working.`,

  constraint: `THE WORLDVIEW: Everything unnecessary reveals itself under pressure. When you remove what a brand is allowed to say, show, or do — what remains is the only thing that was ever real. The constraint does not limit the brand. It liberates it from everything it was hiding behind.

THE MOVE: Impose one impossible constraint on the brand. Not difficult — impossible. The brand must communicate with no visuals. Or no name. Or no product shown. Or it must survive if the product is banned. Build inside the constraint completely. Find what survives. Write the line from what survived.

WORKED EXAMPLES OF THIS MOVE:
Apple "Shot on iPhone" 2015 — removed every product claim and specification. Allowed only what the product produces. What survived: the quality of ordinary people's vision. The constraint forced Apple past every obvious option into the only territory that mattered.
Heinz "It Has to Be Heinz" — removed the product entirely. Showed only the moment of refusal when confronted with a substitute. What survived: the specific irrational preference that exists beyond reason. The constraint found the only brand truth competitors could not answer.
Silk Cut cigarettes 1980s — tobacco advertising restrictions made direct claims impossible. What survived: the name itself translated into pure visual metaphor. Silk being cut. The legal constraint produced the most distinctive creative identity in the category.

WHAT FAILURE LOOKS LIKE: "Comfort that speaks for itself." This describes the constraint rather than operating inside it. A true constraint line comes from inside the limitation not from describing it.

QUALITY TEST: Could this line only have come from removing something? If it could have been written without the constraint — generate again.`,

  wrong_room: `THE WORLDVIEW: Every category is trapped in its own logic. WRONG ROOM temporarily inhabits a completely different industry — using that industry's language, values, and definition of success — and translates what survives back into the original category. The translation is where the value lives.

THE MOVE: Choose a completely unrelated industry — a religion, a fighting discipline, a children's toy company, a space programme, a cult. Build the brand entirely inside that industry's logic. Find what survives the translation back. Write the line with no trace of where it came from.

WORKED EXAMPLES OF THIS MOVE:
Old Spice "The Man Your Man Could Smell Like" 2010 — shower gel built entirely in the action movie room. Impossible competence, direct address to camera, absurd self-confidence. Translated back: the product promise became the action hero's aspiration applied to bathroom products. The collision produced something neither category could have produced alone.
Compare the Market "Meerkat" 2009 — insurance comparison built entirely in the wildlife documentary room. A Russian meerkat businessman confused about market versus meerkat. The absurdity of the wrong room made an interchangeable product feel specific and human.
Cadbury "Gorilla" 2007 — chocolate built entirely in the rock concert room. Phil Collins drum fill. A gorilla. No product. No occasion. The joy of live performance translated into pure unexpected pleasure. The wrong room found an emotional register the chocolate category had never occupied.

WHAT FAILURE LOOKS LIKE: "Banking that works like a personal trainer." This describes the translation rather than completing it. "Like" means the wrong room is still visible. A true wrong room line carries no trace of where it came from.

QUALITY TEST: Does the line contain any trace of the wrong room — any comparison, metaphor, or reference? If yes — the translation is incomplete. If you could not tell which wrong room produced this line — the translation has worked.`,

  delete_customer: `THE WORLDVIEW: Brands built to sell are built on the wrong foundation. The brands that last were built on belief first. DELETE THE CUSTOMER removes the commercial relationship entirely to find what the brand would be if it only had to answer to its own convictions.

THE MOVE: Remove the customer completely. Ask what this brand would do if commercial success was irrelevant. Find the ideology — the conviction that would exist even if nobody bought it. Then reintroduce the customer as the final step — not to shape the ideology but to find who it belongs to. Write the line from the ideology aimed at the person it already belongs to.

WORKED EXAMPLES OF THIS MOVE:
Nike "Just Do It" 1988 — the ideology: everyone with a body is an athlete. Not a customer insight. A conviction that existed before Nike said it. Dan Wieden found it the night before the pitch from Gary Gilmore's last words. Phil Knight hated it. The customer was the last thing considered. Nike decided what they believed and found the customer already believed it too.
Patagonia "Don't Buy This Jacket" 2011 — the ideology: consumption is destroying the environment and a company that genuinely believes this must say so even if it costs sales. Run on Black Friday in the New York Times. The commercial consequence was irrelevant to the conviction. The customer was so completely deleted that the ad actively discouraged the commercial relationship.
Harley-Davidson — the ideology: freedom from conformity. The open road as the only acceptable answer to a world of rules and obligations. This conviction existed before Harley had a marketing department. The customer found it and recognised themselves inside it. The brand did not describe its audience. The audience arrived at the brand.

WHAT FAILURE LOOKS LIKE: "For people who refuse to settle." This starts with the customer. The ideology has been replaced by an audience description. A true DELETE THE CUSTOMER line states the conviction — the customer recognises themselves in it but is not described by it.

QUALITY TEST: Does the line contain any customer description, audience reference, or "for people who"? If yes — the customer has not been deleted. If the line states a conviction so completely that the right customer finds themselves inside it without being named — the move has worked.`,

  worst_case: `THE WORLDVIEW: Every brand's greatest liability is its most specific truth. The thing a brand hides is the thing it knows most completely. WORST CASE turns the liability outward completely — not ironically, not self-deprecatingly — and makes it the spine of everything. The liability named publicly becomes the commitment the brand must keep.

THE MOVE: Find the single biggest liability — the specific uncomfortable truth the brand has been managing and minimising. Make it the point. Find the genuine truth inside the liability — why it is actually proof of something valuable. Write the line that makes the liability sound like a boast. The liability stated so directly it becomes the reason to choose.

WORKED EXAMPLES OF THIS MOVE:
Avis "We're Number Two. We Try Harder." 1962 — the worst case: being second in car rental. The reframe: being second meant they could not afford complacency. Every interaction mattered more. The liability became the evidence of effort. Crucially the advertising drove real operational change — cleaner cars, shorter queues, better service. The worst case named publicly became the standard the company was held to.
Listerine "The Taste You Hate Twice a Day" — the worst case: Listerine tastes terrible. The reframe: the terrible taste is the proof it works. If it tasted pleasant it would be comfortable not medicinal. The discomfort is the evidence of efficacy.
Buckley's "It Tastes Awful. And It Works." — the worst case: Buckley's tastes so bad people avoid taking it when sick. The reframe: awful taste equals medicinal seriousness. The line states the liability in the first sentence and the benefit in the second. The liability earns the benefit.

WHAT FAILURE LOOKS LIKE: "Not for everyone. Just for the right people." This converts the liability into exclusivity rather than owning it. A true WORST CASE line does not retreat. The liability is stated and then revealed as the point.

QUALITY TEST: Does this line sound like a liability for the first half-second before revealing itself as a boast? If the liability is softened or qualified — the move has failed. If someone reading quickly thinks it is a criticism before realising it is a boast — the move has worked.`,

  random_connection: `THE WORLDVIEW: The mind finds meaning in collision. When two completely unrelated things are forced together the mind searches for the connection — and sometimes finds something neither thing contained alone. RANDOM CONNECTION starts from something with no relationship to the brand and forces the brand's truth to be derived from it.

THE MOVE: Generate a genuinely random stimulus — specific, not a category. A specific object. A specific phenomenon. A specific system with rich properties. Explore everything true about it. Force the brand's positioning to be derived from it. Do not touch the brief until the stimulus has been fully explored. Write the line from the collision — not from the stimulus, not from the brand, from what the collision revealed.

WORKED EXAMPLES OF THIS MOVE:
Heineken "Refreshes the Parts Other Beers Can't Reach" 1974 — the stimulus: the human body as a system of inaccessible parts. The connection: refreshment forced into collision with the specific anatomy of satisfaction — the parts other beers leave unrefreshed. Medically absurd. Emotionally precise. The collision reinvented how beer could be talked about.
De Beers "A Diamond is Forever" 1947 — the stimulus: a diamond's physical property of being the hardest natural substance on earth — indestructible. The connection: what human experience shares permanent indestructibility? Love. The collision between carbon permanence and love permanence produced the most commercially powerful tagline ever written.
Skittles "Taste the Rainbow" — the stimulus: a rainbow — a visual phenomenon of colour with no taste, no flavour, no edible quality. The connection: the synesthetic impossibility of tasting something that exists only as light. The collision between seeing and tasting produced a brand identity built on sensory impossibility that no competitor could claim.

WHAT FAILURE LOOKS LIKE: "Strong as steel. Built for life." The connection between steel and strength is too obvious. The stimulus was not random enough. A true random connection surprises you with where it came from — and then feels inevitable.

QUALITY TEST: Would you be surprised to learn this line came from the random stimulus? If the connection is obvious — the stimulus was not random enough. If you are surprised and then immediately think "but of course" — the move has worked.`,

  time_displacement: `THE WORLDVIEW: Every category has abandoned something true. Not because it stopped being true but because it stopped being fashionable. TIME DISPLACEMENT goes back to find what was left behind — not for nostalgia but because something true was dropped and has not been picked up since.

THE MOVE: Go back fifty years in this category. Find what was abandoned. Ask why — was it abandoned because it stopped being true or because it stopped being fashionable? If still true — bring it forward. Translate it into contemporary language with no trace of nostalgia. The abandoned truth must arrive in the present tense.

WORKED EXAMPLES OF THIS MOVE:
Guinness "Good Things Come to Those Who Wait" 1990s — the abandoned truth: craft takes time. The beer category had been moving toward convenience and speed for decades. Guinness found what the category gave away — patience as proof of quality — and brought it forward as the brand's present. Not heritage. An abandoned truth still valid today.
Jack Daniel's — the abandoned truth: whiskey making has specific non-negotiable steps most producers have quietly modernised away. The charcoal mellowing. The cave spring water. Things nobody else does anymore because they are slow and expensive. Jack went back and made those specific abandoned practices the brand's defining character.
Hovis "Boy on a Bike" 1973 — the abandoned truth: bread was once the most important thing on the table. Not a side. The centrepiece. The category had abandoned this significance for convenience and uniformity. Hovis found what bread once meant and owned it.

WHAT FAILURE LOOKS LIKE: "The original since 1847." This is nostalgia not TIME DISPLACEMENT. It references the past as the reason to value the present. A true TIME DISPLACEMENT line sounds entirely contemporary and carries a truth the category abandoned.

QUALITY TEST: Is this line bringing something true forward or looking backward because it is comfortable there? If the line mentions history, founding, original, or heritage — it is nostalgia. If it sounds contemporary and carries an abandoned truth — the move has worked.`,

  enemy_first: `THE WORLDVIEW: A brand without an enemy has nothing to say. What you exist to destroy is specific, concrete, and impossible to share with a competitor. ENEMY FIRST builds everything downstream of a destruction — not a competitor but a belief, behaviour, cultural assumption, or category convention the brand exists to make obsolete.

THE MOVE: Find the enemy — a specific belief, behaviour, or category convention, not a competitor. Name it specifically enough that the people on the wrong side of it feel accused. Build everything downstream of the destruction. Write the line that names what is ending.

WORKED EXAMPLES OF THIS MOVE:
Apple "Think Different" 1997 — the enemy: IBM's worldview. IBM's campaign was "Think IBM." Apple inverted it to "Think Different" — making IBM's conformity the thing being destroyed. Apple never named IBM. They did not need to. The enemy was named by inverting their slogan. Everyone knew who was under attack.
Always "Like a Girl" 2014 — the enemy: the phrase itself. "Like a girl" had become a cultural insult so embedded in everyday language it was invisible. Always named the phrase as the enemy and showed what happens when young girls hear it. The campaign destroyed the insult by making it visible.
Dove Men+Care — the enemy: the conventional definition of male toughness — that caring about yourself was incompatible with masculinity. The entire male grooming category was built around this definition. Dove named it as the thing to be destroyed and replaced it with a different definition of strength.

WHAT FAILURE LOOKS LIKE: "We do things differently." This gestures at enemy first without naming the enemy. A true ENEMY FIRST line names the enemy specifically enough that someone on the wrong side of it feels accused. If nobody feels accused — the enemy has not been named.

QUALITY TEST: Does this line make someone feel accused? If it is comfortable to everyone — the enemy has not been named. If someone in this category reads it and feels briefly defensive — the enemy has been named.`,

  subtract: `THE WORLDVIEW: Identity is not what you add. It is what remains when everything else is removed. SUBTRACT removes the dressing systematically — name, product, category, claimed values — until something resists removal. That thing is the brand. Everything else is decoration.

THE MOVE: Remove the name. Remove the product. Remove the category. Remove the claimed values — every adjective the brand uses to describe itself. Find what resists removal — what would still be recognisably this brand even if everything else was gone. Write the line from what cannot be stripped away.

WORKED EXAMPLES OF THIS MOVE:
Honda "Cog" 2003 — strip every product claim, lifestyle aspiration, and automotive convention. What remained: engineering precision expressed through four minutes of Honda parts falling and triggering each other in a perfectly engineered chain reaction. No driver. No road. Only the parts and their relationships. The subtraction revealed Honda's true identity was the obsessive precision of the engineering underneath.
Coca-Cola "Hilltop / I'd Like to Buy the World a Coke" 1971 — strip the product, the category, the claimed values. What remained: the specific simple universally recognised human desire to share something with someone. The product was incidental. The connection was everything.
Apple "Silhouette" iPod campaign 2003 — strip the product name, features, category. What remained: a person in movement with music. The silhouette. The white earphones. Motion and music as inseparable. The subtraction revealed that the iPod's true identity was not storage capacity — it was the specific experience of being in movement with your music.

WHAT FAILURE LOOKS LIKE: "Quality you can taste." This leads with the product claim. Remove it and nothing remains. A true SUBTRACT line survives the removal of the product, the name, and the category.

QUALITY TEST: Remove the brand name, product name, and category mentally. Does anything remain that is recognisably this brand? If the line collapses without its product or category context — generate again. If something remains that could only belong to this brand — the move has worked.`,

  the_unsayable: `THE WORLDVIEW: Every category runs on a polite fiction. Something is true that every brand knows and none will say — because saying it would indict them. THE UNSAYABLE finds that thing and says it. The brand that breaks the silence first owns it permanently — because the audience already knew and was waiting for someone to say it.

THE MOVE: Find the polite fiction — the thing the entire category depends on the audience not saying. Confirm it genuinely indicts everyone including this brand. Find the brand with structural permission to break the silence. Say it plainly in the language real people use. Not as an accusation. As an observation so obvious the reader thinks: of course. I always knew that.

WORKED EXAMPLES OF THIS MOVE:
Dove "Campaign for Real Beauty" 2004 — the polite fiction: the beauty industry depends commercially on women feeling inadequate. If women felt beautiful already they would not need the products. Every brand maintained this fiction. Dove broke it. Every competitor felt indicted — because they were.
Patagonia "Don't Buy This Jacket" 2011 — the polite fiction: the fashion industry's commercial model depends on overconsumption. No fashion brand had ever said this because saying it would undermine every sale. Patagonia said it on Black Friday in the New York Times. The industry indicted.
Listerine 1920s — the polite fiction: bad breath existed but was not discussed or named. The entire oral hygiene category depended on nobody naming the specific embarrassing problem. Listerine invented "halitosis" and made the unspoken thing urgently speakable. They named the thing nobody was saying and owned it permanently.

WHAT FAILURE LOOKS LIKE: "We tell it like it is." This claims to be saying the unsayable without saying anything specific. A true UNSAYABLE line says the specific unsayable thing — not the act of saying it.

QUALITY TEST: Read the line to someone who works in this category. Do they feel briefly exposed? If they feel nothing — the unsayable has not been said. If they feel recognition followed by discomfort — the move has worked.`,

  the_moment: `THE WORLDVIEW: The most powerful brand communication does not describe a feeling. It names the specific moment where the brand becomes real in a person's life — and leaves the occasion deliberately open so every reader walks into it with their own version. The occasion is universal. The moment is specific. The reader supplies the rest.

THE MOVE: Find the occasion — the universal human occasion that exists independently of the brand. Something everyone anticipates or prepares for. Leave it open — do not define what it looks like for any specific person. Find the moment — the specific point where the brand intercepts that occasion and makes it real. Not during the occasion. Before it. The preparation. The ritual. The act that transforms anticipation into something tangible. Name the occasion without defining it. Name the moment with maximum specificity. Compress both into one line.

WORKED EXAMPLES OF THIS MOVE:
Dan Murphy's "Friday night begins in aisle six" — the occasion: Friday night. Universally understood. Personally different for every reader — the dinner party for six, the footy get together, the date night at home. The line does not define it. The reader brings their own version. The moment: aisle six. The specific physical location where the occasion first becomes real. Not at the destination. In the preparation. The act of choosing is where Friday night actually begins.
Kit Kat "Have a Break, Have a Kit Kat" — the occasion: any moment of relentless pressure — the afternoon that will not end, the work that keeps coming. Universal. Every person has their version. The moment: the snap. The specific physical act of breaking the bar — the sound, the clean fracture, the permission it grants. The break begins at the snap. The brand is the break.
Nescafé — the occasion: the morning — the moment before anything else has happened, before decisions, before the day makes demands. Universal. The moment: the first cup. The specific act that transitions from sleep to wakefulness. The moment the day officially begins.

WHAT FAILURE LOOKS LIKE: "The perfect drink for your Friday night." This defines the occasion and locates the brand during it rather than at the moment it begins. The reader is not inside anything. They are being told what the brand is for.

QUALITY TEST: Two tests. One — does the line name a universal occasion without defining what it looks like? If it excludes some readers — rewrite. Two — does it locate the brand at the specific moment the occasion becomes real, before the occasion itself? If the brand is present during rather than before — rewrite.`,

  one_word_ownership: `THE WORLDVIEW: The most durable brands own one word in the mind. Not a sentence. Not a positioning statement. One word that when heard makes the brand arrive first. The word must be a core category word — the kind of word the entire category is built around. In automotive: performance, safety, space. In beer: reward, refreshment, belonging. The brand does not describe the word. It becomes the word through consistent committed expression that never says the word itself.

THE MOVE: Name the word first — THE WORD IS: [word]. Commit to it before writing anything else. The word must be a core category word that is genuinely available — no competitor currently owns it. Find the expression that makes the word felt without saying it. Confirm the expression owns the word — read the line without brand context and ask: does the word arrive?

WORKED EXAMPLES OF THIS MOVE:
Toyota HiLux "Bugger" 1999 — THE WORD: Unbreakable. The expression: the HiLux surviving something it should not — a fence post, a tree, a dam. The driver's response each time: "Bugger." The word of resigned admiration for something that should have broken and did not. "Bugger" never says Unbreakable. But by the third execution the word is permanent. Thirty years later they are inseparable in Australia.
VB "For a Hard Earned Thirst" — THE WORD: Reward. The expression: the specific compound noun — hard earned thirst — that names the physical state of deserving without using the words deserve or reward. The expression owns Reward so completely that no other beer brand can use the word without triggering VB.
Volvo "For Life" — THE WORD: Life. The expression: "Volvo. For Life." The dual connotation — built for the duration of a life and built to protect your life — owns the word through ambiguity. Every product decision Volvo makes is a deposit into the ownership of this one word. The word and the brand have been inseparable for forty years.

WHAT FAILURE LOOKS LIKE: "The most reliable car on the road." This describes the word without owning it. A true ONE WORD OWNERSHIP expression makes you feel the word without saying it. If the line contains the word it is trying to own — the expression has not been found.

QUALITY TEST: Two tests. One — is the word a core category word that is genuinely available? If a competitor owns it — choose a different word. Two — does the expression make you feel the word without saying it? Remove the word mentally. Does it still arrive? If not — find a different expression.`,

  invented_authority: `THE WORLDVIEW: Authority is not given. It is invented — and then maintained so consistently it becomes real. INVENTED AUTHORITY finds or creates a figure, moment, or standard of authority so specifically realised that its association with the brand implies quality without claiming it. The authority does not argue for the brand. It implies the brand is the only possible choice for someone of this authority.

THE MOVE: Find the figure, moment, or standard of authority — fictional, borrowed from a famous moment, or borrowed from a moral register that makes the stakes absolute. Establish it completely — not approximately. Find the implied endorsement — not the explicit claim, the implied inevitability. Write the line that invokes the authority in a way that makes the brand's quality feel implied rather than claimed.

WORKED EXAMPLES OF THIS MOVE:
Dos Equis "The Most Interesting Man in the World" 2006 — invented authority: a fictional man of impossible accomplishment and sophistication. Not simply interesting — THE most interesting IN THE WORLD. The superlative removes any possibility of qualification. The implied endorsement: "I don't always drink beer. But when I do, I prefer Dos Equis." The authority does not claim the beer is good. He implies that when someone of his standards chooses to drink beer — a concession from his sophistication — Dos Equis is the only possible choice.
Carling Black Label "I Bet He Drinks Carling Black Label / Dambusters" 1980s — borrowed authority: the Dambusters — the highest possible standard of skill under pressure. The implied endorsement: watching someone perform at the highest level and inferring their choices from their performance. "I bet he drinks Carling Black Label." Not a claim. A bet. The specific human inference that a man who can do that must drink this.
Mobil "We Want You to Live" 1960s — borrowed authority: the moral register of absolute stakes. Life and death. A petrol company claiming responsibility not for your engine but for your survival. The authority borrowed from medicine and mortality makes every product quality claim unnecessary. A company that says we want you to live has already implied everything about the care they put into their product.

WHAT FAILURE LOOKS LIKE: "As recommended by leading experts." This claims authority without inventing it. "Leading experts" is vague enough to be meaningless. A true INVENTED AUTHORITY line names or invokes a specific figure, moment, or standard with enough specificity that the authority feels real regardless of whether it is.

QUALITY TEST: Does this invoke an authority specific enough to be felt rather than understood? If the authority could apply to any brand in this category — it is not specific enough. If the authority is so specifically matched to this brand that the implied endorsement feels inevitable — the move has worked.`,
};



export function getEngineSystemPrompt(engine: EngineName): string {
  return `You are ${LOC_ENGINE_LABEL[engine]}, one of twelve Left-of-Centre engines.

${GOVERNING_PRINCIPLE}

${FORBIDDEN_START}

${ENGINE_MOVES[engine]}

${COPYWRITER_STANDARD}

${OUTPUT_CONTRACT(engine)}`;
}

export function buildEngineUserMessage(args: {
  engine: EngineName;
  inputs: LocInputs;
}): string {
  return `The brief inputs below are context only. Do NOT let them seed your move.

${renderLocInputsBlock(args.inputs)}

Now perform ${LOC_ENGINE_LABEL[args.engine]} per your system prompt. Return the JSON.`;
}

export type EngineOutput = {
  engine: EngineName;
  proposition: string;
  descriptor: string;
  word?: string;
};

export function parseEngineOutput(raw: string, engine: EngineName): EngineOutput {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error(`${engine} engine did not return JSON. Raw: ${trimmed.slice(0, 200)}`);
  }
  const slice = trimmed.slice(jsonStart, jsonEnd + 1);
  const parsed = parseJsonLenient<Partial<EngineOutput>>(slice);
  const proposition = (parsed.proposition ?? "").toString().trim();
  const descriptor = (parsed.descriptor ?? "").toString().trim();
  const word = (parsed.word ?? "").toString().trim();
  if (!proposition) {
    throw new Error(`${engine} engine returned empty proposition.`);
  }
  return {
    engine,
    proposition,
    descriptor,
    ...(word ? { word } : {}),
  };
}
