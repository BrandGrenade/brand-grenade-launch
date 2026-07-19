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

const PROCESS_FIELD_SPEC = `"process": "<MANDATORY — 3-5 sentences showing this engine's move being executed step by step. Not a summary of the line. Not a rationale. The actual intermediate work: the sacred assumption you named and inverted, the wrong room you chose and inhabited, the customer you removed and the ideology you found, the random stimulus you named and connected, the moment you located, the word you claimed, and so on. If the process field does not visibly show THIS engine's move being performed, the output is invalid and will be rejected.>"`;

// Per-engine mandatory intermediate outputs. These fields make the move
// auditable and unfakeable — they must exist BEFORE the proposition is
// generated. The model cannot skip the move because the intermediate
// output is required by contract and validated on parse.
type IntermediateField = { key: string; array?: boolean; minItems?: number; spec: string };
const INTERMEDIATES: Partial<Record<EngineName, IntermediateField[]>> = {
  inversion: [
    { key: "sacred_assumption", spec: `"sacred_assumption": "<MANDATORY — state the single category assumption every brand competes on, in the form: 'Every brand in this category competes on [X].' Written BEFORE the proposition.>"` },
  ],
  wrong_room: [
    { key: "wrong_room_chosen", spec: `"wrong_room_chosen": "<MANDATORY — name the specific unrelated industry entered (e.g. 'competitive powerlifting', 'monastic order', 'submarine warfare'). Not a category — a specific world.>"` },
    { key: "lines_from_inside", array: true, minItems: 2, spec: `"lines_from_inside": ["<MANDATORY — line one, produced entirely inside the wrong room's logic, before any translation>", "<line two, same rule>"]` },
  ],
  delete_customer: [
    { key: "ideology", spec: `"ideology": "<MANDATORY — state the conviction this brand would hold even if nobody bought anything. Not a customer description. Not 'for people who'. A belief. Written BEFORE the proposition.>"` },
  ],
  random_connection: [
    { key: "stimulus", spec: `"stimulus": "<MANDATORY — name one specific random object or phenomenon (not a category). E.g. 'a lighthouse', 'the migration pattern of monarch butterflies', 'the sound of ice cracking on a frozen lake'.>"` },
    { key: "stimulus_properties", array: true, minItems: 3, spec: `"stimulus_properties": ["<MANDATORY — true property one of the stimulus>", "<true property two>", "<true property three>"]` },
  ],
  time_displacement: [
    { key: "abandoned_truth", spec: `"abandoned_truth": "<MANDATORY — name what this category left behind fifty years ago and why. Written BEFORE the contemporary translation.>"` },
  ],
  enemy_first: [
    { key: "enemy_named", spec: `"enemy_named": "<MANDATORY — state the specific belief, behaviour, or convention being destroyed. Not a competitor. Specific enough that someone on the wrong side would feel accused. Written BEFORE the proposition.>"` },
  ],
  the_unsayable: [
    { key: "polite_fiction", spec: `"polite_fiction": "<MANDATORY — state the specific thing the entire category depends on nobody saying, in plain language. Written BEFORE the line.>"` },
  ],
  one_word_ownership: [
    { key: "word_owned", spec: `"word_owned": "<MANDATORY — the single core category word this brand will own. One word only. Written BEFORE any expression is attempted. If after two internal attempts no fully unowned word can be found, select the MOST-AVAILABLE core category word and still return it here. Silence is never acceptable.>"` },
    { key: "word_available", spec: `"word_available": "<MANDATORY — one sentence. Either (a) confirm no competitor currently owns this word, naming any brand you considered and ruled out, OR (b) if no fully unowned core category word could be found after two internal attempts, state 'CONTESTED — most-available word chosen' and name the competing brand(s) that partially occupy it. Both forms are valid — never return empty.>"` },
  ],
  invented_authority: [
    { key: "authority_figure", spec: `"authority_figure": "<MANDATORY — name the specific figure, moment, or standard of authority being invoked (fictional, historical, or moral register). Written BEFORE the implied endorsement.>"` },
  ],
};

function renderIntermediates(engineId: EngineName): string {
  const fields = INTERMEDIATES[engineId];
  if (!fields || fields.length === 0) return "";
  return fields.map((f) => `  ${f.spec},`).join("\n") + "\n";
}

const OUTPUT_CONTRACT = (engineId: EngineName) => {
  const intermediates = renderIntermediates(engineId);
  const hasIntermediates = intermediates.length > 0;
  const contractPreamble = `OUTPUT — return exactly one JSON object, no prose, no markdown fences. The "process" field${hasIntermediates ? " AND every intermediate field below are" : " is"} MANDATORY${hasIntermediates ? ". Intermediate fields must be produced BEFORE the proposition — they make the move auditable and unfakeable" : " and must show the move being executed"}. Outputs missing any required field are rejected:`;
  if (engineId === "one_word_ownership") {
    return `${contractPreamble}

{
  "engine": "${engineId}",
  ${PROCESS_FIELD_SPEC},
${intermediates}  "proposition": "<THE PROPOSITION — 8 words or fewer, must NEVER contain the owned word>",
  "descriptor": "<After the line — one sentence only on what the line does to the reader. Not why the brand owns it. Not how it connects to the brief. What it makes the reader feel or think before they understand it.>"
}`;
  }
  return `${contractPreamble}

{
  "engine": "${engineId}",
  ${PROCESS_FIELD_SPEC},
${intermediates}  "proposition": "<THE LINE — 8 words or fewer>",
  "descriptor": "<After the line — one sentence only on what the line does to the reader. Not why the brand owns it. Not how it connects to the brief. What it makes the reader feel or think before they understand it.>"
}`;
};


const FORBIDDEN_START = `HARD RULE — DO NOT START FROM THE BRIEF.
Do not start from the brief, the category, the customer, or the market. Perform this engine's move. Never let the brief seed the move.`;

const ENGINE_MOVES: Record<EngineName, string> = {
  inversion: `THE WORLDVIEW: The world's most powerful truths live on the other side of what the category takes for granted. Every category has a sacred assumption so deeply embedded that nobody questions whether it needs to be there. INVERSION refuses it completely — not a twist, not a modification, the structural opposite — and asks whether the brand could build its entire strategy on the other side.

THE MOVE: Name the single sacred assumption every brand in this category competes on. State it: "Every brand in this category competes on [X]." Then build the complete opposite. The inversion must be total. Find the line that lives entirely in the inverted world without referencing what it inverted.

WORKED EXAMPLES OF THIS MOVE:

Volkswagen "Think Small" 1959
Sacred assumption: cars should be large, powerful, and aspirational. Size equals status. Inversion: small is not the compromise. Small is the intelligence. Made every other car's size look like insecurity.

Avis "We're Number Two. We Try Harder." 1962
Sacred assumption: brands compete by claiming to be the best. Inversion: being second is the proof of effort. Made being number one sound complacent.

Got Milk? 1993
Sacred assumption: you sell milk by showing people drinking it and feeling good. Inversion: show the moment when it is absent. The want created by absence is more powerful than the satisfaction of having.

Marmite "Love It Or Hate It" 1996
Sacred assumption: food brands should maximise their appeal and minimise polarisation. Inversion: the polarisation is the product truth. Made being divisive the evidence of authenticity.

Hoover "Nothing Sucks Like A Hoover" 1970s
Sacred assumption: brands should never use negative language about their own product. Inversion: the negative word is the positive claim. Every competitor's polite language looked evasive by comparison.

The Independent "It Is. Are You?" 1990s
Sacred assumption: newspapers compete by claiming comprehensiveness or authority. Inversion: the paper does not claim to be independent. It asks whether the reader is. Made choosing The Independent an act of self-definition.

REI "OptOutside" 2015
Sacred assumption: retailers compete on Black Friday by opening earlier and discounting more. Inversion: close on Black Friday. The refusal was the advertisement.

Tui "Yeah Right" New Zealand 1990s
Sacred assumption: beer brands compete on taste, mateship, and aspiration. Inversion: mock every advertising claim including your own. Made every other beer brand's sincerity look like self-importance.

Strong Enough For A Man Made For A Woman — Secret deodorant 1970s
Sacred assumption: women's products are gentler versions of men's products. Inversion: the strongest product is the women's product. Made every competitor's gentle positioning look patronising.

Ronseal "Does Exactly What It Says On The Tin" 1994
Sacred assumption: all products require aspirational storytelling. Inversion: say only what the product does. The complete absence of advertising language is the advertising.

Stella Artois "Reassuringly Expensive" 1982
Sacred assumption: price is a barrier to overcome. Inversion: the high price is the assurance. Made every competitor's value claim look like an admission of inferiority.

Dove "Real Beauty" 2004
Sacred assumption: beauty brands sell an ideal. Inversion: the ideal is the problem. Made every competitor's campaign look like it was selling inadequacy.

Burger King "Have It Your Way" 1974
Sacred assumption: fast food efficiency requires standardisation. Inversion: the standardisation is the competitor's limitation. Made McDonald's operational efficiency feel like a constraint on the customer.

Carlsberg "Probably The Best Beer In The World" 1973
Sacred assumption: superlative claims require certainty. Inversion: probably is more credible than definitely. Every competitor's unqualified claim looked like bluster.

Patagonia "Don't Buy This Jacket" 2011
Sacred assumption: retail brands exist to sell more product. Inversion: selling less is the brand's stated goal. Published on Black Friday in the New York Times.

Lufthansa "The Airline For People Who Don't Like Flying"
Sacred assumption: airlines compete by making flying seem exciting and aspirational. Inversion: acknowledge the anxiety. Made every other airline's glamour advertising look disconnected from reality.

Pepsi Challenge 1975
Sacred assumption: Coca-Cola's brand superiority is self-evident. Inversion: remove the brand. Test the product. Made Coke's authority look like it depended on the label not the liquid.

Listerine "Even Your Best Friends Won't Tell You" 1920s
Sacred assumption: personal care brands focus on the positive outcome. Inversion: focus on the social silence around the problem. The social dynamic was more powerful than any positive claim.

Renault Clio "Va Va Voom" 2000s
Sacred assumption: small cars compete on practicality and economy. Inversion: the small car is not practical. It is desirable. Made the category's rational arguments look like they were missing the point.

Innocent Drinks anti-corporate voice 1990s onwards
Sacred assumption: brands communicate through authority, aspiration, and polish. Inversion: write like a human being with opinions who admits uncertainty. Every competitor's professional distance looked like it was hiding something.

WHAT FAILURE LOOKS LIKE: "The beer that doesn't take itself too seriously." This gestures at inversion without committing to the opposite. It qualifies rather than inverts. A true inversion builds entirely on the other side as if the assumption never existed.

QUALITY TEST: Does this make the category's sacred assumption look absurd by refusing to acknowledge it? If the line references the assumption in any way — rewrite. If a brand in this category would say "that's against everything we stand for" — the inversion is working. Does this output demonstrate the same move type as the worked examples — or does it merely resemble them superficially? If the move was not executed — reject and start again.`,

  constraint: `THE WORLDVIEW: Everything unnecessary reveals itself under pressure. When you remove what a brand is allowed to say, show, or do — what remains is the only thing that was ever real. The constraint does not limit the brand. It liberates it from everything it was hiding behind.

THE MOVE: Impose one impossible constraint on the brand. Not difficult — impossible. The brand must communicate with no visuals. Or no name. Or no product shown. Or it must survive if the product is banned. Build inside the constraint completely. Find what survives. Write the line from what survived.

WORKED EXAMPLES OF THIS MOVE:

BMW "The Ultimate Driving Machine" 1973
Constraint: remove everything except the act of driving itself. No passengers, no destination, no lifestyle. What survived: the pure physical relationship between driver and machine. Held for fifty years.

Mercedes-Benz "Engineered Like No Other Car In The World"
Constraint: remove all emotional and lifestyle claims. Only what the engineers actually did is permitted. What survived: the obsessive standard of the engineering process itself.

Audi "Vorsprung Durch Technik" 1971
Constraint: say it in German in an English-speaking market. Do not translate. Do not explain. What survived: untranslatability as proof of genuine technical superiority.

Apple "1984" 1984
Constraint: do not show the product. Do not name it. Do not describe what it does. What survived: the destruction of conformity as the only communication worth making at the moment of the Mac's launch. Ran once. Still referenced forty years later.

Guinness "Surfer" 1999
Constraint: the product takes 119.5 seconds to pour correctly. That is not changeable. Work only with what is true about the wait. What survived: patience as the mark of someone who understands quality.

Silk Cut 1980s
Constraint: tobacco regulations made direct claims impossible. What survived: the brand name itself translated into pure visual metaphor. Silk being cut. The legal constraint produced the most distinctive identity in the category.

Heinz "It Has To Be Heinz" 1980s
Constraint: remove the product entirely. Show only the moment when a substitute is offered and rejected. What survived: the specific irrational loyalty that exists beyond reason or price.

Apple "Shot On iPhone" 2015
Constraint: remove every product claim and specification. Show only what the product produces. What survived: the quality of ordinary people's vision.

Cadbury "Gorilla" 2007
Constraint: remove the product, the occasion, the recipe, the brand story. Everything that makes this a chocolate advertisement. What survived: pure unexpected joy arriving through the most unexpected vessel.

VW "Lemon" 1960
Constraint: show only a car that failed quality control. What survived: the rejection process itself as the proof of quality. Showing failure proved the standard more completely than any success story.

Hamlet Cigars "Air On A G String" 1970s
Constraint: tobacco regulations prevented direct enjoyment claims. What survived: the cigar as the one reliable comfort when everything else goes wrong.

Tango "You've Been Tango'd" 1992
Constraint: remove all claims about taste and refreshment. The only truth is immediate impact. What survived: the physical sensation of sudden unexpected assault.

Porsche "There Is No Substitute" 1990s
Constraint: remove all comparisons and competitive claims. State only what the product is in absolute terms. What survived: the category of one. The refusal to compete.

Levi's "Laundrette" 1985
Constraint: remove fashion, style, fit, quality, and durability. What survived: desire expressed through the physical act of removing clothing in a public space.

De Beers "A Diamond Is Forever" 1947
Constraint: remove luxury, fashion, and status. Work only from the physical property of the stone. What survived: permanence. The connection between carbon and love.

John Lewis "The Long Wait" 2011
Constraint: remove the store, the products, the prices, and the offers. What survived: a child unable to sleep thinking about the gift they give not the gift they receive.

British Airways "Arrivals" 1983
Constraint: remove destinations, prices, routes, comfort, and service. What survived: the face in the arrivals hall. The recognition. The embrace.

Honda "Cog" 2003
Constraint: remove every lifestyle aspiration and automotive convention. Show only the parts. What survived: engineering precision — Honda components triggering each other in a perfectly timed chain. 606 takes. Two minutes on screen.

Apple iPod Silhouette 2003
Constraint: remove the product name, features, and category. What survived: a person in movement with music. The silhouette. The white earphones. Motion and sound inseparable.

Innocent Drinks bottle copy 1990s
Constraint: no marketing language. No claims. No aspirational framing. Write only as a genuine human being would write. What survived: warmth and honesty — the specific relief of a brand that seems to have nothing to hide.

WHAT FAILURE LOOKS LIKE: "Comfort that speaks for itself." This describes the constraint rather than operating inside it. A true constraint line comes from inside the limitation not from describing it.

QUALITY TEST: Could this line only have come from removing something? If it could have been written without the constraint — generate again. Does this output demonstrate the same move type as the worked examples — or does it merely resemble them superficially? If the move was not executed — reject and start again.`,

  wrong_room: `THE WORLDVIEW: Every category is trapped in its own logic. WRONG ROOM temporarily inhabits a completely different industry — using that industry's language, values, and definition of success — and translates what survives back into the original category. The translation is where the value lives.

THE MOVE: Choose a completely unrelated industry — a religion, a fighting discipline, a children's toy company, a space programme, a cult. Build the brand entirely inside that industry's logic. Find what survives the translation back. Write the line with no trace of where it came from.

WORKED EXAMPLES OF THIS MOVE:

Old Spice "The Man Your Man Could Smell Like" 2010
Wrong room: 1980s action movie. Built entirely inside action movie logic — impossible competence, location changes mid-sentence, direct address to camera. Translated back with no trace of where it came from. The collision produced something neither category could produce alone.

Compare The Market "Meerkat" 2009
Wrong room: wildlife documentary. Insurance comparison built inside David Attenborough logic. A Russian meerkat businessman confused about market versus meerkat. The absurdity of the wrong room made an interchangeable commodity feel specific and unmissable.

Marlboro Man 1950s
Wrong room: American Western mythology. Cigarettes built inside frontier mythology. The lone cowboy. The open landscape. A filtered cigarette — originally marketed to women — became the defining symbol of American masculine independence through the room it was placed in.

Hovis "Boy On A Bike" 1973
Wrong room: Edwardian period drama. Bread built inside a nostalgic British period film. Cobbled streets. A brass band. A boy cycling uphill. The values of that world transferred to the product without being stated.

Guinness "NoitulovE" 2005
Wrong room: natural history documentary run backwards. Beer built inside reverse evolution — creatures devolving to the moment they earned a Guinness. The absurdity made the payoff feel genuinely deserved.

Volvo Trucks "Epic Split" 2013
Wrong room: performance art and ballet. Truck stability built inside an impossible physical performance. Jean-Claude Van Damme. Two trucks. The splits. Enya. The dance room found the only way to make a B2B product feature emotionally transcendent.

Tourism Queensland "Best Job In The World" 2009
Wrong room: recruitment advertisement. Tourism campaign built entirely inside job advertisement logic. The destination as the workplace. The experience as the job description. Generated earned media worth hundreds of times the paid budget.

Harvey Nichols "Sorry I Spent It On Myself" 2013
Wrong room: confessional support group. Luxury retail built inside the logic of an apology meeting. People confessing to terrible gifts because they spent the budget on themselves. The therapy room gave permission to name what the category had never admitted.

Barnardo's "The Golden Years" 2003
Wrong room: aspirational retirement savings advertising. Child poverty charity built inside a warm retirement advertisement. Revealed as a child's imagined future they will never reach. The wrong room created devastation no direct emotional appeal could have produced.

Ikea "Lamp" 2002
Wrong room: psychological thriller about an abandoned object. Furniture built inside a sad story about an inanimate object left in the rain. You feel genuine sympathy for the lamp before the Swede tells you that you are crazy.

Chipotle "Back To The Start" 2012
Wrong room: animated Pixar-style short film about industrial farming. Fast food positioned inside an environmental documentary made for children. The animated family film room allowed a critique that a straightforward argument could never have made without preaching.

Dos Equis "The Most Interesting Man In The World" 2006
Wrong room: literary biography of an impossible polymath. Beer built inside the biography of a man whose accomplishments defy physical possibility. Generated a character universe that produced cultural content for fifteen years.

Metro Trains Melbourne "Dumb Ways To Die" 2012
Wrong room: children's animated safety video crossed with an indie pop song. Rail safety built inside cheerful animation about spectacularly stupid deaths. Made teenagers share a public safety message voluntarily — something no conventional safety campaign achieved.

Carling Black Label "Dambusters" 1980s
Wrong room: World War Two documentary. Lager built inside the specific logic of the Dambusters raid — technical skill and courage under maximum pressure. "I bet he drinks Carling Black Label." An implied endorsement through inference not assertion.

Red Bull "Stratos" 2012
Wrong room: NASA space programme documentary. Energy drink built inside the logic of a space agency achievement. A man falling from the edge of space. No energy drink claim could have done what the space programme room did.

Absolut Vodka bottle art 1980s
Wrong room: contemporary art gallery. Vodka built inside the logic of minimalist contemporary art. The bottle as canvas. The product as art object. The room transformed a commodity spirit into a cultural object.

Diesel "For Successful Living" 1990s
Wrong room: satirical magazine from an alternate dystopian future. Jeans built inside the logic of a satirical publication from a world where everything had gone slightly wrong. Made every competitor's sincere aspirational campaign look naive.

Speight's "Southern Man" New Zealand 1990s
Wrong room: Western film — the strong silent type archetype. Beer built inside the logic of a Western. The rugged understated man who does not need to explain himself. Gave a regional lager a mythology disproportionate to its size.

Land Rover "Above And Beyond"
Wrong room: exploration documentary — Shackleton, Scott, Amundsen. Vehicles built inside the specific vocabulary of people who go to places that might kill them. The exploration room produced a register of absolute reliability no urban driving scenario could.

Taco Bell "Thinking Outside The Bun"
Wrong room: corporate innovation manifesto. Fast food positioned inside the language of business strategy and disruptive innovation. Product decisions framed as deliberate strategic departures. Made ordering feel like participation in a movement.

WHAT FAILURE LOOKS LIKE: "Banking that works like a personal trainer." This describes the translation rather than completing it. "Like" means the wrong room is still visible. A true wrong room line carries no trace of where it came from.

QUALITY TEST: Does the line contain any trace of the wrong room — any comparison, metaphor, or reference? If yes — the translation is incomplete. If you could not tell which wrong room produced this line — the translation has worked. Does this output demonstrate the same move type as the worked examples — or does it merely resemble them superficially? If the move was not executed — reject and start again.`,

  delete_customer: `THE WORLDVIEW: Brands built to sell are built on the wrong foundation. The brands that last were built on belief first. DELETE THE CUSTOMER removes the commercial relationship entirely to find what the brand would be if it only had to answer to its own convictions.

THE MOVE: Remove the customer completely. Ask what this brand would do if commercial success was irrelevant. Find the ideology — the conviction that would exist even if nobody bought it. Then reintroduce the customer as the final step — not to shape the ideology but to find who it belongs to. Write the line from the ideology aimed at the person it already belongs to.

WORKED EXAMPLES OF THIS MOVE:

Nike "Just Do It" 1988
Ideology without customer: everyone with a body is an athlete. Not a demographic. A conviction about human potential. Phil Knight hated the line. The customer was the last thing considered. The customer found themselves inside the conviction.

Patagonia "Don't Buy This Jacket" 2011
Ideology without customer: consumption is destroying the environment and a company that genuinely believes this must say so even at direct commercial cost. The ideology was so customer-free it actively discouraged the commercial relationship. The customer arrived anyway in greater numbers.

Harley-Davidson — the entire brand voice
Ideology without customer: freedom from conformity is the only acceptable answer to a world built on obligation and routine. The brand never described its customer. The customer found the brand and recognised the conviction as their own.

The Guardian "Three Little Pigs" 2012
Ideology without customer: journalism exists to interrogate every version of a story until the truth emerges regardless of who it implicates. The ideology was stated as a practice not a promise. The reader recognised it as the thing they had been waiting for.

Bodyform "Blood" 2017
Ideology without customer: female bodies are not shameful and the category's sanitised convention was a commercial decision to avoid confronting reality. Showed what the category had always hidden. The customer had always known the hiding was wrong.

Ben and Jerry's — activist flavour naming
Ideology without customer: a company has a moral responsibility to use its platform for causes it believes in regardless of commercial consequence. The ideology was expressed through product naming — the most direct possible commercial act.

Oatly "It's Like Milk But Made For Humans"
Ideology without customer: dairy milk is not designed for adult human consumption and the industry's normalisation of it is a commercial fiction. The ideology indicted the entire category the brand was competing in. No customer research would have produced this.

BrewDog "Equity For Punks"
Ideology without customer: the beer industry is controlled by corporations whose interests oppose the interests of the people who drink beer. The only authentic response is to give those people actual ownership. Converted customers into shareholders.

REI "OptOutside" 2015
Ideology without customer: Black Friday is antithetical to everything a company that believes in the outdoors should stand for. The ideology cost real money. That cost was the proof the conviction was real.

Method "People Against Dirty"
Ideology without customer: cleaning products should not be toxic. The industry's acceptance of harmful ingredients is a commercial choice not a manufacturing necessity. Named the dirt inside the cleaning products.

Tony's Chocolonely — entire brand
Ideology without customer: the chocolate industry's commercial dependence on child labour is a choice and a company that knows this and does not act is complicit. The ideology was stated on the packaging as the primary communication.

Warby Parker "Buy A Pair Give A Pair"
Ideology without customer: vision correction is a human right and a company in this category that does not act on that belief has no moral foundation. Built into the commercial model not added as a marketing layer.

Innocent Drinks — founding voice
Ideology without customer: food should be honest, simple, and made by people who are genuinely decent human beings. The ideology produced a voice so different from the category that the customer arrived because the conviction was recognisable.

Dove Men+Care "Real Strength" 2010
Ideology without customer: the conventional definition of male toughness — emotional unavailability as strength — is wrong. Named a cultural convention as the enemy before introducing an alternative. The customer recognised themselves in the alternative without being described by it.

Nike "Dream Crazy" Kaepernick 2018
Ideology without customer: believing in something enough to sacrifice everything for it is the highest expression of athletic conviction. The ideology was demonstrated through the choice of spokesperson rather than stated in copy. The conviction was shown not claimed.

Cards Against Humanity — entire brand
Ideology without customer: comedy should be genuinely transgressive or it is not comedy. Comfort is the enemy of laughter. The ideology was so specific it excluded most people and included exactly the right people completely.

Aesop — long-form product copy
Ideology without customer: skincare should be approached with the same intellectual seriousness as literature or philosophy. The product descriptions read like essays. Produced a retail experience unlike anything in the category.

Benetton "We On Death Row" 1990s
Ideology without customer: a brand with global reach has a moral obligation to use that reach to provoke debate on issues that matter regardless of whether it sells clothes. Created a new category — brand as platform for uncomfortable truth.

Glossier "Skin First Makeup Second"
Ideology without customer: the beauty industry's product hierarchy is the wrong way around. Skin health comes first. Reorganised the entire category hierarchy. The customer built the brand with the founders because the conviction was already theirs.

Under Armour "Rule Yourself"
Ideology without customer: the difference between good and great is not talent. It is the discipline of what you do when nobody is watching. Differentiated from Nike's motivational register by going to a darker more demanding place.

WHAT FAILURE LOOKS LIKE: "For people who refuse to settle." This starts with the customer. The ideology has been replaced by an audience description. A true DELETE THE CUSTOMER line states the conviction — the customer recognises themselves in it but is not described by it.

QUALITY TEST: Does the line contain any customer description, audience reference, or "for people who"? If yes — the customer has not been deleted. If the line states a conviction so completely that the right customer finds themselves inside it without being named — the move has worked. Does this output demonstrate the same move type as the worked examples — or does it merely resemble them superficially? If the move was not executed — reject and start again.`,

  worst_case: `THE WORLDVIEW: Every brand's greatest liability is its most specific truth. The thing a brand hides is the thing it knows most completely. WORST CASE turns the liability outward completely — not ironically, not self-deprecatingly — and makes it the spine of everything. The liability named publicly becomes the commitment the brand must keep.

THE MOVE: Find the single biggest liability — the specific uncomfortable truth the brand has been managing and minimising. Make it the point. Find the genuine truth inside the liability — why it is actually proof of something valuable. Write the line that makes the liability sound like a boast. The liability stated so directly it becomes the reason to choose.

WORKED EXAMPLES OF THIS MOVE:

Avis "We're Number Two. We Try Harder." 1962
Liability: being second in car rental behind Hertz. Reframe: being second means no complacency is possible. The liability named publicly became the operational standard the company was held to. The advertising drove real change in service quality.

Buckley's "It Tastes Awful. And It Works." 1985
Liability: Buckley's tastes so bad patients actively avoid taking it. Reframe: terrible taste is proof of medicinal seriousness. The confession in the first sentence earns the claim in the second.

KFC UK "FCK" 2018
Liability: KFC ran out of chicken. Reframe: own the crisis completely. Rearrange the brand name. The humility of naming the disaster directly in their own brand voice converted a crisis into a brand-building moment.

VW "Lemon" 1960
Liability: this specific car failed quality control. Reframe: the rejection process proves the standard. Showing failure proved quality more completely than any success story could have.

Marmite "Love It Or Hate It" 1996
Liability: half the population actively dislikes Marmite. Reframe: the divisiveness is the product truth. Something this specific should not be liked by everyone. Made being hated a commercial advantage.

Stella Artois "Reassuringly Expensive" 1982
Liability: Stella costs significantly more than other lagers. Reframe: the price is the assurance. Cheap would be suspicious. Turned the category's biggest objection into the brand's primary claim.

Ronseal "Does Exactly What It Says On The Tin" 1994
Liability: a completely functional product with no aspirational story to tell. Reframe: the complete absence of aspiration is the product's greatest strength. In a category of overclaiming the honesty of literal description became the premium position.

Listerine "Halitosis" 1920s
Liability: Listerine tastes medicinal and antiseptic. Reframe: the unpleasantness is proportionate to the seriousness of the problem it solves. Made pleasant-tasting competitors seem ineffective by comparison.

Dollar Shave Club "Our Blades Are F*ing Great" 2012
Liability: blades were not technologically advanced. Reframe: the technology race is a con. The blade needed to shave was perfected decades ago. Named the category's commercial fiction as a liability.

Dyson "We Solve The Problems Others Ignore"
Liability: Dyson costs significantly more than every competitor. Reframe: the price reflects the cost of solving a problem the industry had decided was acceptable to leave unsolved.

Ryanair — provocative fare advertising 2000s
Liability: reputation for poor service and hidden charges. Reframe: the price is so low that the inconveniences are irrelevant. The liability is the proof of the price point. Used outrage as a media strategy.

BrewDog banned by Portman Group
Liability: high-alcohol beer banned by the drinks industry regulatory body. Reframe: the ban is the credential. A beer so genuinely unconventional that the industry moved against it. A quality signal no marketing budget could manufacture.

Pepsi Challenge 1975
Liability: consistently second to Coca-Cola. Reframe: remove the brand and test the product. Made Coke's authority look like it depended on the label not the liquid.

Tiffany Blue Box — the price signal
Liability: distinctive packaging immediately reveals the premium price before opening. Reframe: the revelation is the point. The box communicates what the giver felt before the recipient sees what is inside.

Penguin Books plain cover design
Liability: minimal and plain compared to competitors' elaborate designs. Reframe: the plainness is the confidence. A book needing an elaborate cover is selling the packaging not the content.

Oatly "Wow No Cow" 2020
Liability: oat milk does not taste identical to dairy milk. Reframe: that is not a bug. It is proof of being a different thing entirely — not a dairy substitute but a category of its own.

Häagen-Dazs "Dedicated To Pleasure" 1991
Liability: ice cream is associated with guilt and excess. Reframe: the indulgence is not a side effect. It is the entire point. Naming the guilt directly and refusing to apologise made every competitor's attempt to make indulgence feel innocent look evasive.

Lurpak — premium price in commodity category
Liability: Lurpak costs significantly more than generic butter. Reframe: the price is proportionate to what happens in the pan. A cook who takes food seriously cannot use inferior butter.

Malteser "The Lighter Way To Enjoy Chocolate"
Liability: smaller and lighter than most chocolate bars. Less chocolate per unit. Reframe: the lightness is the product truth. The indulgence that feels like restraint. Made the defining physical limitation into a distinctive specific pleasure.

Mobil "We Want You To Live" Australia 1990s
Liability: a fuel company talking about road safety seems self-interested or hypocritical. Reframe: the brand that profits from driving is the brand most motivated to ensure you survive it. The seeming contradiction made the claim more powerful not less.

WHAT FAILURE LOOKS LIKE: "Not for everyone. Just for the right people." This converts the liability into exclusivity rather than owning it. A true WORST CASE line does not retreat. The liability is stated and then revealed as the point.

QUALITY TEST: Does this line sound like a liability for the first half-second before revealing itself as a boast? If the liability is softened or qualified — the move has failed. If someone reading quickly thinks it is a criticism before realising it is a boast — the move has worked. Does this output demonstrate the same move type as the worked examples — or does it merely resemble them superficially? If the move was not executed — reject and start again.`,

  random_connection: `THE WORLDVIEW: The mind finds meaning in collision. When two completely unrelated things are forced together the mind searches for the connection — and sometimes finds something neither thing contained alone. RANDOM CONNECTION starts from something with no relationship to the brand and forces the brand's truth to be derived from it.

THE MOVE: Generate a genuinely random stimulus — specific, not a category. A specific object. A specific phenomenon. A specific system with rich properties. Explore everything true about it. Force the brand's positioning to be derived from it. Do not touch the brief until the stimulus has been fully explored. Write the line from the collision — not from the stimulus, not from the brand, from what the collision revealed.

WORKED EXAMPLES OF THIS MOVE:

De Beers "A Diamond Is Forever" 1947
Random stimulus: diamond's physical property — indestructible, unchanged by time, the hardest natural substance. Collision with brand truth: what human experience shares the property of permanence? Love. The collision between carbon permanence and emotional permanence produced the most commercially powerful tagline ever written.

Heineken "Refreshes The Parts Other Beers Cannot Reach" 1974
Random stimulus: human anatomy — the specific inaccessible locations of the body. The itch you cannot scratch. Collision: what if refreshment penetrated where nothing else goes? Medically absurd. Emotionally precise. Reinvented how beer refreshment could be communicated.

Skittles "Taste The Rainbow" 1994
Random stimulus: a rainbow — purely visual, no taste, no texture, no edible quality. Collision: what if you could taste something that exists only as light? Built a brand identity on synesthetic impossibility no competitor could claim.

Kit Kat "Have A Break, Have A Kit Kat" 1957
Random stimulus: the physical act of breaking — the snap, the clean fracture, the specific sound of something separating precisely. Collision: what if the break in the chocolate was a human permission structure? The snap is how you give yourself permission to stop.

Apple iPod "1000 Songs In Your Pocket" 2001
Random stimulus: the pocket — the intimate space designed to carry small essential personal objects. Keys. Wallet. The things you do not leave home without. Collision: what if music belonged in the same category? A scale claim that felt intimate rather than overwhelming.

Persil "Dirt Is Good" 2005
Random stimulus: mud — the specific physical substance children produce when they play freely. The stain that is evidence of engagement not negligence. Collision: what if the cleaning product was in alliance with dirt rather than opposition? Made every competitor's stain removal message sound like it was punishing children for living.

John West Salmon "Bear" 2000
Random stimulus: a bear catching salmon in a river — the violent drama of a predator intercepting prey. Collision: what if the quality of canned salmon was determined by what John West fights a bear to get? The absurdity was the evidence.

Carling Black Label "Dambusters" 1980s
Random stimulus: the Dambusters raid — technical skill and precision under extreme operational pressure. Collision: what if lager quality could be inferred from the choices of men operating at the absolute limit of capability? "I bet he drinks Carling Black Label." An inference not a claim.

Lurpak "Weigh Up Your Butter"
Random stimulus: the professional chef's relationship with raw ingredients — the specific gravity of fine materials held in the hand before committing them to the pan. Collision: what if butter deserved the same consideration a sculptor gives marble? A premium positioning no taste claim could generate.

Tango "You've Been Tango'd" 1992
Random stimulus: unexpected physical assault — the involuntary full-body response to being hit without warning. Collision: what if taste was not refreshing but assaulting? Made the impact of the flavour physically real.

Snap Crackle Pop — Kellogg's Rice Krispies 1929
Random stimulus: the specific acoustic phenomenon of cereal reacting to milk — three distinct sounds in sequence. Collision: what if the sounds were characters? The first branded product sound. Three onomatopoeic words that encoded the product experience more precisely than any description.

Foster's "He Who Drinks Australian Thinks Australian"
Random stimulus: national philosophy expressed through the most casual daily act. Collision: what if choosing a beer was a philosophical alignment rather than a consumption act? Made a lager feel like a worldview adoption.

Dove "Evolution" 2006
Random stimulus: time-lapse photography — the visual form that compresses transformation into seconds. Collision: what if the time-lapse format was applied to the production of a beauty standard? Made the industry's manufacturing of beauty visible in a way no static image could.

VW "Snowplow" 1964
Random stimulus: a snowplow driver at 3am in a blizzard — someone doing essential work in conditions that punish mechanical failure. Collision: what if the proof of reliability was the vehicle chosen by the person whose work cannot be delayed? A quality claim no test track demonstration could match.

Nike "Courage" 2008 Olympics
Random stimulus: the physical vocabulary of courage — the intake of breath before the impossible attempt. The decision before the jump. Collision: what if sports equipment advertising was about the decision that precedes the performance rather than the performance itself? Emotional territory no specification could occupy.

Chipotle "Back To The Start" 2012
Random stimulus: a small family farm — the specific scale of agriculture that preceded industrialisation. The farmer who knew every animal. Collision: what if fast food was measured against what farming looked like before efficiency became the only value? A critique no straightforward argument could make without preaching.

Extra Gum "The Story Of Sarah And Juan" 2015
Random stimulus: gum wrappers as drawing paper — the specific domestic repurposing of a throwaway material. Collision: what if gum wrappers were the medium through which a couple recorded their entire relationship? Turned a disposable purchase into the keeper of a whole story.

Coca-Cola "I'd Like To Teach The World To Sing" 1971
Random stimulus: a hillside — the topographical feature that gathers people from different directions into one place. Collision: what if sharing a Coke was the same act as choosing to stand on the same hillside as a stranger? The product was incidental. The wish was everything.

Guinness "Anticipation" — surfer 1999
Random stimulus: surfing — the discipline of waiting in water for the right wave. Patience as a professional skill. Collision: what if the 119.5 seconds of the pour was not waiting but vigiling? The most celebrated beer advertisement ever made. Sold a wait as a privilege.

Singapore Airlines "A Great Way To Fly"
Random stimulus: the experience of being a guest in a private home — a social form built on care rather than transaction. Collision: what if air travel was not a transport product but an act of hospitality? Differentiated by making the journey itself the product.

WHAT FAILURE LOOKS LIKE: "Strong as steel. Built for life." The connection between steel and strength is too obvious. The stimulus was not random enough. A true random connection surprises you with where it came from — and then feels inevitable.

QUALITY TEST: Would you be surprised to learn this line came from the random stimulus? If the connection is obvious — the stimulus was not random enough. If you are surprised and then immediately think "but of course" — the move has worked. Does this output demonstrate the same move type as the worked examples — or does it merely resemble them superficially? If the move was not executed — reject and start again.`,

  time_displacement: `THE WORLDVIEW: Every category has abandoned something true. Not because it stopped being true but because it stopped being fashionable. TIME DISPLACEMENT goes back to find what was left behind — not for nostalgia but because something true was dropped and has not been picked up since.

THE MOVE: Go back fifty years in this category. Find what was abandoned. Ask why — was it abandoned because it stopped being true or because it stopped being fashionable? If still true — bring it forward. Translate it into contemporary language with no trace of nostalgia. The abandoned truth must arrive in the present tense.

WORKED EXAMPLES OF THIS MOVE:

Guinness "Good Things Come To Those Who Wait" 1999
Abandoned truth: craft takes time. Patience is proof of quality. Abandoned because the drinks category moved toward convenience and instant gratification. Still true because a product requiring 119.5 seconds to pour correctly cannot compete on speed. The wait was the only honest territory available — and the strongest.

Jack Daniel's — the old way
Abandoned truth: whiskey making has specific non-negotiable craft steps — charcoal mellowing, cave spring water — that most producers abandoned because they are slow and expensive. Still true because Jack never abandoned them. Every abandoned practice became a differentiator because everyone else had stopped.

Johnnie Walker "Keep Walking"
Abandoned truth: the original promise of whisky in the Victorian era was not indulgence but perseverance. The drink of people who keep going when others stop. Still true because the human desire to persist despite difficulty is permanent.

Hovis "Boy On A Bike" 1973
Abandoned truth: bread was once the most important thing on the table. Not a side. The centrepiece. Abandoned because the category moved to convenience and sliced bread. Still true because the emotional significance of bread — nourishment, home, continuity — never stopped being true. It had simply stopped being said.

Levi's "Laundrette" 1985
Abandoned truth: denim was workwear — clothing that carried the identity of the wearer because it was made for hard use not fashion. Abandoned because jeans became a fashion category. Still true because the emotional truth of denim as authentic identity — worn not bought — was still true and no fashion-jeans competitor was saying it.

The Economist "I Never Read The Economist. Management Trainee. Aged 42." 1988
Abandoned truth: the most valuable publications make you feel the cost of not reading them. Abandoned because media moved toward accessibility and removing barriers. Still true for ambitious professionals who understood the cost of ignorance.

VB "For A Hard Earned Thirst"
Abandoned truth: beer was the reward for physical labour. Earned by work rather than chosen for pleasure. Abandoned because the category moved toward social aspiration and lifestyle. Still true because the emotional satisfaction of something earned — the hard earned thirst — had never stopped resonating.

Dulux — the Old English Sheepdog
Abandoned truth: the quality of paint was measured by its physical substance — the richness of the pigment, the thickness of the coverage. Abandoned because the category moved to colour range and technical specs. Still true because the sensory truth of quality — that you can feel it before you apply it — never changed.

Barclays "Because Life's Complicated Enough"
Abandoned truth: the original promise of banking was simplicity. One institution. Your money. Managed honestly. Abandoned because financial products proliferated into complexity the category embraced as sophistication. Still true because the vast majority of customers wanted simplicity and had never wanted anything else.

Anchor Butter New Zealand
Abandoned truth: dairy products taste better from cows that eat real grass in real fields. Abandoned because industrial farming made the pastoral origin inaccessible to most producers. Still true in New Zealand where the pastoral reality had genuinely been preserved. Not nostalgia — a current manufacturing fact the category had stopped saying.

Specsavers "Should've Gone To Specsavers" 2002
Abandoned truth: the most persuasive thing a brand can show is the consequence of not using it. Abandoned because advertising convention moved entirely toward positive outcomes and benefit demonstration. Still true because consequence is always more motivating than benefit.

Rolex "Perpetual"
Abandoned truth: a watch was originally a precision instrument whose quality was measured by accuracy and longevity not aesthetics. Abandoned because the luxury watch category moved toward status and fashion. Still true because the satisfaction of an instrument that does its job perfectly and indefinitely had never been replaced by anything better.

Singapore Airlines "A Great Way To Fly"
Abandoned truth: air travel was once an event — an occasion requiring appropriate dress and worthy of anticipation. Abandoned because democratisation of flying made the event quality impossible to maintain universally. Still true at Singapore Airlines which recovered the standard of hospitality aviation had abandoned.

Ritz-Carlton "Ladies And Gentlemen Serving Ladies And Gentlemen"
Abandoned truth: the finest service was once conceived as a mutual relationship of respect. The server and the served both operating at the highest standard of conduct. Abandoned because the service industry moved toward a hierarchy where the customer was always right and the server subordinate. Still true because the experience of being served by someone who takes their own dignity seriously is more satisfying than being served by someone who is simply deferential.

Land Rover "Above And Beyond"
Abandoned truth: the original promise of a four-wheel drive vehicle was operational capability in conditions that most vehicles cannot survive — not urban comfort. Abandoned because the category moved toward luxury SUVs competing on interior comfort and lifestyle. Still true because the specific desire for a vehicle that will not fail in extreme conditions had never stopped being the deepest truth of the category.

Aesop — long-form product copy
Abandoned truth: the finest products were once accompanied by writing that treated the purchaser as an intelligent adult capable of understanding complexity. Abandoned because marketing moved toward short accessible aspirational language for the broadest audience. Still true because the pleasure of being addressed as a thinking person had never been replaced.

The New York Times "All The News That's Fit To Print"
Abandoned truth: the original promise of serious journalism was curation — the editor's judgment about what deserved the reader's attention. Abandoned because digital media moved toward volume, speed, and algorithmic selection. Still true because the value of a trusted editor had never been higher than in an environment of infinite undifferentiated content.

Chanel short films
Abandoned truth: the finest luxury goods were once connected to art — not as a marketing strategy but as a genuine shared standard of excellence. Abandoned because luxury marketing moved toward celebrity endorsement and lifestyle positioning. Still true because the relationship between craft and art — the idea that a perfume and a film could share a standard of beauty — was available to any brand willing to invest in it genuinely.

VB "It's A Beautiful Thing"
Abandoned truth: the original pleasure of a mainstream beer was uncomplicated enjoyment shared with people you did not need to impress. Abandoned because the beer category moved toward aspirational masculine achievement and adventurous lifestyle. Still true because the specific pleasure of something easy and unpretentious shared among people comfortable with each other had never been replaced.

Budweiser "Whassup?" 1999
Abandoned truth: the original promise of beer between friends was the low-stakes pleasure of checking in with someone you did not need to impress. Abandoned because beer marketing moved toward masculine achievement and social status. Still true because the specific pleasure of a greeting that requires nothing had never stopped being the most honest description of what beer between friends actually felt like.

WHAT FAILURE LOOKS LIKE: "The original since 1847." This is nostalgia not TIME DISPLACEMENT. It references the past as the reason to value the present. A true TIME DISPLACEMENT line sounds entirely contemporary and carries a truth the category abandoned.

QUALITY TEST: Is this line bringing something true forward or looking backward because it is comfortable there? If the line mentions history, founding, original, or heritage — it is nostalgia. If it sounds contemporary and carries an abandoned truth — the move has worked. Does this output demonstrate the same move type as the worked examples — or does it merely resemble them superficially? If the move was not executed — reject and start again.`,

  enemy_first: `THE WORLDVIEW: A brand without an enemy has nothing to say. What you exist to destroy is specific, concrete, and impossible to share with a competitor. ENEMY FIRST builds everything downstream of a destruction — not a competitor but a belief, behaviour, cultural assumption, or category convention the brand exists to make obsolete.

THE MOVE: Find the enemy — a specific belief, behaviour, or category convention, not a competitor. Name it specifically enough that the people on the wrong side of it feel accused. Build everything downstream of the destruction. Write the line that names what is ending.

WORKED EXAMPLES OF THIS MOVE:

Apple "Think Different" 1997
Enemy: IBM's worldview — conformity, institutional hierarchy, computing as a tool of corporate power. The destruction: Apple inverted IBM's own slogan. "Think IBM" became "Think Different." The enemy was named by destroying their most recognisable asset without mentioning them.

Always "Like A Girl" 2014
Enemy: the phrase itself — a cultural insult so embedded it had become invisible. The destruction: showing what happens when young girls first hear it used as an insult. Making the invisible audible. Everyone who had ever used the phrase felt implicated.

Nike "Dream Crazy" Kaepernick 2018
Enemy: the belief that an athlete's commercial value should override their right to a political conscience. The destruction: choosing Kaepernick. The choice was the statement. The conviction was demonstrated through action not copy.

Benetton "We On Death Row" 1990s
Enemy: the belief that fashion advertising should exist only to sell clothes. The destruction: used global media footprint to show death row prisoners and force a conversation about capital punishment. Created a new category — brand as platform for uncomfortable truth.

Fearless Girl State Street 2017
Enemy: the belief that corporate boardrooms are naturally and appropriately male. The destruction: a small girl with her hands on her hips facing the Wall Street bull. Installed on International Women's Day. No copy required. The posture named the assumption and refused it.

Oatly "It's Like Milk But Made For Humans"
Enemy: the dairy industry's claim that cow's milk is the natural and appropriate adult human beverage. The destruction: naming the biological reality. Cow's milk is made for calves. The entire dairy category implicated without any competitor named.

BrewDog "Craftwashing"
Enemy: major beer corporations presenting acquired craft brands as genuine craft without disclosing corporate ownership. The destruction: named the deception publicly at the moment it mattered most. Equipped the audience to recognise it.

Listerine "Halitosis" 1920s
Enemy: social silence — the convention that bad breath was not to be named or discussed. The destruction: invented a clinical term for it. Made it a medical condition with a specific solution. Created the market by naming the thing the market depended on not naming.

Dove "Real Beauty" 2004
Enemy: the beauty industry's commercial dependence on manufactured inadequacy. The destruction: showed real women and real bodies in beauty advertising. Every competitor felt indicted because every competitor was guilty.

Method "People Against Dirty"
Enemy: the cleaning industry's acceptance of toxic ingredients — the belief that effective cleaning required harmful chemistry. The destruction: named the dirt inside the cleaning products. Turned the category's products into the thing being cleaned away.

REI "OptOutside" 2015
Enemy: Black Friday — the belief that commercial success on the year's biggest retail day was compatible with a brand that claimed to value the outdoors over commerce. The destruction: closing all stores. The action was the argument.

Harvey Nichols "Sorry I Spent It On Myself" 2013
Enemy: the pretence of Christmas gift-giving selflessness — the convention requiring everyone to pretend the gift budget is spent thinking about others. The destruction: celebrating spending it on yourself as the more honest and satisfying choice. Named with affection rather than aggression.

Bodyform "Blood" 2017
Enemy: the feminine hygiene category's collective decision to show blue liquid and white clothing rather than the reality of menstruation. The destruction: showing blood. The enemy was visible in every competitor's advertisement. Destroying it required only showing what had always been hidden.

Wendy's "Where's The Beef?" 1984
Enemy: the convention that fast food burgers contained the amount of meat their advertising implied. The destruction: an elderly woman looking at a competitor's enormous bun with a tiny patty asking where the beef was. Made the competitor's product the evidence.

The Guardian "Three Little Pigs" 2012
Enemy: the belief that journalism serves the powerful and powerless with equal impartiality. The destruction: demonstrated through the three pigs narrative that every version of a story reflects the interests of the storyteller. Then distinguished itself by confronting that condition.

Ryanair — category conventions
Enemy: the belief that airline passengers deserve comfort and courtesy as non-negotiable elements of the travel experience. The destruction: stripped every comfort and reduced the price to the point where the destruction became the value proposition.

Carlsberg "Probably The Best Beer In The World" 1973
Enemy: false certainty — the category habit of making superlative claims no beer could substantiate. The destruction: the hedge. Probably. One word that made every other beer's unqualified claim look like a bluff.

Apple "Hello I'm A Mac, Hello I'm A PC" 2006
Enemy: the belief that computing was serious and required expertise. The destruction: embodied the enemy as a character. Made the PC's limitations visible through personality rather than specification. The Mac's superiority communicated through contrast not claim.

Pepsi Challenge 1975
Enemy: the belief that Coca-Cola's superiority was intrinsic rather than brand-dependent. The destruction: removed the brand and tested the product. Made the blind taste test the evidence that the authority lived in the label not the liquid.

Tui "Yeah Right" New Zealand 1990s
Enemy: the sincerity of advertising — the convention that brands should make genuine claims with conviction. The destruction: a beer brand that responded to every advertising claim with sarcastic refusal. Named advertising itself as the enemy. The most anti-advertising strategy was the most effective advertising in the category.

WHAT FAILURE LOOKS LIKE: "We do things differently." This gestures at enemy first without naming the enemy. A true ENEMY FIRST line names the enemy specifically enough that someone on the wrong side of it feels accused. If nobody feels accused — the enemy has not been named.

QUALITY TEST: Does this line make someone feel accused? If it is comfortable to everyone — the enemy has not been named. If someone in this category reads it and feels briefly defensive — the enemy has been named. Does this output demonstrate the same move type as the worked examples — or does it merely resemble them superficially? If the move was not executed — reject and start again.`,

  subtract: `THE WORLDVIEW: Identity is not what you add. It is what remains when everything else is removed. SUBTRACT removes the dressing systematically — name, product, category, claimed values — until something resists removal. That thing is the brand. Everything else is decoration.

THE MOVE: Remove the name. Remove the product. Remove the category. Remove the claimed values — every adjective the brand uses to describe itself. Find what resists removal — what would still be recognisably this brand even if everything else was gone. Write the line from what cannot be stripped away.

WORKED EXAMPLES OF THIS MOVE:

Honda "Cog" 2003
Stripped: every product claim, lifestyle aspiration, driving experience, automotive convention, music, driver, road. What remained: engineering precision — Honda parts triggering each other in a perfectly timed chain reaction. 606 takes. Two minutes. No driver. No road. The subtraction revealed Honda's true identity — an engineering obsession that happened to produce cars.

Coca-Cola "Hilltop / I'd Like To Buy The World A Coke" 1971
Stripped: the product, the category, the refreshment promise, the taste claim, the brand history. What remained: the specific simple desire to share something with someone you have never met. Remove Coca-Cola from this film and the human truth still stands.

British Airways "Arrivals" 1983
Stripped: destinations, prices, routes, comfort, service, frequency, aircraft. What remained: the face in the arrivals hall. The recognition. The embrace. The specific human moment only air travel produces. The brand claimed that moment so completely it still belongs to them.

Nike "Just Do It" 1988
Stripped: the product, the athlete endorser, the sport, the performance claim, the technology. What remained: the fundamental human relationship with physical challenge. The internal instruction that overrides hesitation. Remove Nike entirely and the line still belongs to Nike.

Heinz "It Has To Be Heinz" 1980s
Stripped: taste claims, heritage, recipe, ingredients, nutritional benefits. What remained: the specific irrational loyalty that exists beyond taste, price, and rational justification. The emotional truth no rational argument created and no rational argument can remove.

Apple "Think Different" 1997
Stripped: the product, the technology, the specifications, the applications. What remained: the conviction that the people who change the world are the ones who believe they can. Remove every Apple product and the line still belongs to Apple.

Guinness "Surfer" 1999
Stripped: taste, refreshment, social occasion, heritage, the pub, mateship. What remained: the specific experience of waiting for the right moment — the patience of someone who knows that the thing worth having requires the willingness to wait. Remove everything about the beer and a philosophy about how to live remains.

VW "Think Small" 1959
Stripped: power, size, status, aspiration, lifestyle, every positive automotive convention. What remained: honesty. The specific relief of a brand that does not pretend to be something it is not. The subtraction made the honesty visible.

Tiffany — the blue box
Stripped: the jewellery, the design, the craftsmanship, the occasion, the price, the heritage. What remained: a colour on a box. One specific shade of blue that communicates everything about the relationship between giver and receiver before it is opened. Remove the jewellery and the brand still exists completely.

Haagen-Dazs "Dedicated To Pleasure" 1991
Stripped: flavours, ingredients, dairy quality, occasions, social context. What remained: the specific private ritual of pleasure taken alone without social justification. The first spoonful from an unopened tub. The category had never dared name the truth that the best ice cream experiences are private.

Marlboro Country
Stripped: the product, the taste, the social occasion, the health positioning. What remained: a geography of freedom. The open landscape. The absence of obligation. The specific relief of a place without rules. The brand owned a geography not a product.

Dove Men+Care "Real Strength"
Stripped: grooming performance, fragrance, skin benefits, masculine aspiration. What remained: the specific experience of genuine care — caring for others as the expression of real strength rather than its negation.

Porsche — the engine sound
Stripped: speed claims, performance specifications, racing heritage, design, luxury positioning, price justification. What remained: the specific acoustic signature of the flat-six engine. A sound so particular it communicates everything about the brand before a word is spoken. That sound is the brand. Everything else is decoration.

Coca-Cola "Share A Coke" 2011
Stripped: the product, the taste, the occasion, the refreshment, the brand history. What remained: the specific act of thinking about someone who is not present. Finding their name. The moment a mass-produced object becomes personal.

Innocent Drinks bottle copy
Stripped: every marketing convention — claims, aspiration, professional distance, the register of a brand speaking to consumers. What remained: the voice of a genuine human being who has nothing to hide and nothing to sell except what they believe.

P&G "Thank You Mom" Olympics 2012
Stripped: every product, every category, every cleaning or personal care benefit. What remained: behind every athlete is a mother who did ordinary things with extraordinary consistency for twenty years. Remove P&G entirely and the human truth still stands.

Airbnb "Belong Anywhere"
Stripped: the accommodation listing, the price, the location, the amenities, the booking process. What remained: the specific experience of feeling at home in a place that is not your home. Belonging as a human need.

Levi's "Laundrette" 1985
Stripped: fashion, style, fit, fabric, durability, brand heritage. What remained: desire expressed through the act of removing clothing in a public space. The product was incidental to the moment it created.

Under Armour "Rule Yourself"
Stripped: the sportswear, the technology, the athlete endorser's achievements. What remained: the specific experience of self-discipline in the absence of an audience. What you do when nobody is watching.

Thai Life Insurance "Unsung Hero" 2013
Stripped: the insurance product, the policy, the financial protection, the brand. What remained: the specific human pattern of a person who does small good things with no expectation of return and discovers that goodness compounds. Remove the insurance company and the human truth still stands.

WHAT FAILURE LOOKS LIKE: "Quality you can taste." This leads with the product claim. Remove it and nothing remains. A true SUBTRACT line survives the removal of the product, the name, and the category.

QUALITY TEST: Remove the brand name, product name, and category mentally. Does anything remain that is recognisably this brand? If the line collapses without its product or category context — generate again. If something remains that could only belong to this brand — the move has worked. Does this output demonstrate the same move type as the worked examples — or does it merely resemble them superficially? If the move was not executed — reject and start again.`,

  the_unsayable: `THE WORLDVIEW: Every category runs on a polite fiction. Something is true that every brand knows and none will say — because saying it would indict them. THE UNSAYABLE finds that thing and says it. The brand that breaks the silence first owns it permanently — because the audience already knew and was waiting for someone to say it.

THE MOVE: Find the polite fiction — the thing the entire category depends on the audience not saying. Confirm it genuinely indicts everyone including this brand. Find the brand with structural permission to break the silence. Say it plainly in the language real people use. Not as an accusation. As an observation so obvious the reader thinks: of course. I always knew that.

WORKED EXAMPLES OF THIS MOVE:

Patagonia "Don't Buy This Jacket" 2011
Polite fiction: a brand's commercial model is compatible with genuine environmental responsibility. Who could say it: Patagonia — whose trust structure and founder's philosophy had been established over decades. Published on Black Friday. The most commercially counterintuitive act a retailer could make became the most commercially powerful statement it ever made.

Dove "Campaign For Real Beauty" 2004
Polite fiction: the beauty industry exists to help women feel better about themselves. Who could say it: Dove — whose product proposition did not depend on manufactured inadequacy. Every competitor felt indicted because the fiction funded all of them.

Harvey Nichols "Sorry I Spent It On Myself" 2013
Polite fiction: Christmas gift-giving is motivated by generosity rather than desire management. Who could say it: Harvey Nichols — whose customer was sophisticated enough to find the honesty charming. Gave permission to a universal private impulse nobody had been allowed to celebrate.

Dollar Shave Club "Our Blades Are F*ing Great" 2012
Polite fiction: Gillette's razor innovation was genuine and the premium price was justified by real improvement. Who could say it: a new entrant with no investment in the fiction. Named the commercial fiction so directly that Gillette could not respond without confirming it.

VW "Lemon" 1960
Polite fiction: car manufacturers do not produce defective vehicles and should never admit to imperfection. Who could say it: VW — whose quality control was rigorous enough that showing a rejected car proved the standard rather than undermined it. The admission of failure was more convincing than any claim of success.

The Guardian "Three Little Pigs" 2012
Polite fiction: journalism serves the powerful and powerless with equal impartiality. Who could say it: The Guardian — whose trust structure genuinely insulated it from commercial editorial pressure. Named a structural condition of all journalism and distinguished itself by confronting rather than denying it.

Listerine "Halitosis" 1920s
Polite fiction: bad breath was a private embarrassment that social convention required to remain unspoken. Who could say it: a brand with a product that could solve the problem once it was named. Naming the unspeakable converted a social taboo into a commercial category.

Tui "Yeah Right" New Zealand 1990s
Polite fiction: advertising claims are made in good faith and represent genuine product truths. Who could say it: a beer brand with nothing to lose and everything to gain from naming the game. Made the most anti-advertising campaign the most effective advertising in the category.

Oatly "It's Like Milk But Made For Humans"
Polite fiction: dairy milk is the natural and appropriate adult human beverage. Who could say it: a brand with no stake in the dairy fiction. Stated the biological reality so plainly that the industry's normalisation became visible as the commercial choice it was.

Bodyform "Blood" 2017
Polite fiction: the feminine hygiene category's blue liquid convention was a reasonable representation of female experience. Who could say it: Bodyform — with enough consumer trust to survive the confrontation. Showed what the category had always hidden. Made every competitor's sanitised campaign look like an active decision to shame women.

Method "People Against Dirty"
Polite fiction: cleaning products made with toxic ingredients were safe for household use. Who could say it: a brand with genuinely clean formulations. Named the dirt inside the cleaning products and made every conventional brand complicit.

KFC UK "FCK" 2018
Polite fiction: major brands do not make catastrophic operational errors — and when they do they manage communications to minimise accountability. Who could say it: KFC — with enough brand warmth to survive complete honesty. Complete ownership of the disaster earned more goodwill than any crisis management strategy could have produced.

Burger King "McWhopper" 2015
Polite fiction: competitor brands are enemies and the appropriate response to a competitor is to ignore or attack them. Who could say it: Burger King — whose challenger position gave them permission to propose what the category leader could not. Named the absurdity of brand rivalry in the context of Peace Day.

Always "Like A Girl" 2014
Polite fiction: the phrase "like a girl" is a neutral description rather than a culturally embedded insult. Who could say it: Always — a brand whose audience was the people most damaged by the phrase. Made the invisible audible. Everyone had heard the phrase. Nobody had named it as the damage it was.

Wendy's "Where's The Beef?" 1984
Polite fiction: fast food burgers contain the amount of meat their advertising implies. Who could say it: Wendy's — whose product genuinely contained more beef than competitors. The question named what everyone suspected and nobody had asked aloud.

Ronseal "Does Exactly What It Says On The Tin" 1994
Polite fiction: all products require aspiration, emotion, and creative storytelling to be sold effectively. Who could say it: a brand whose only genuine differentiation was honesty. Named the advertising convention itself as the thing being departed from.

REI "OptOutside" 2015
Polite fiction: participating in the retail event of the year is compatible with a brand that claims to value the outdoors over commerce. Who could say it: REI — whose cooperative structure and values were documented over decades. Named the contradiction between stated values and commercial behaviour.

Benetton death row campaigns 1990s
Polite fiction: fashion brands exist to sell clothes and should not make audiences uncomfortable. Who could say it: Benetton — whose founder believed the brand's scale created a responsibility to speak. So completely named the convention it was departing from that it created a new category — brand as platform for social provocation.

The Independent "It Is. Are You?" 1990s
Polite fiction: newspapers claim to be independent as a marketing position rather than as a structural editorial reality. Who could say it: a publication with a specific editorial structure that genuinely supported the claim. Named independence as a challenge to the reader rather than a claim about the paper.

Mobil "We Want You To Live" Australia 1990s
Polite fiction: a fuel company's interest in road safety is incompatible with its commercial interest in more driving. Who could say it: Mobil — whose road safety conviction had to overcome the obvious conflict of interest to be believed. The seeming contradiction made the claim more powerful not less. Naming the conflict was the proof of the conviction.

WHAT FAILURE LOOKS LIKE: "We tell it like it is." This claims to be saying the unsayable without saying anything specific. A true UNSAYABLE line says the specific unsayable thing — not the act of saying it.

QUALITY TEST: Read the line to someone who works in this category. Do they feel briefly exposed? If they feel nothing — the unsayable has not been said. If they feel recognition followed by discomfort — the move has worked. Does this output demonstrate the same move type as the worked examples — or does it merely resemble them superficially? If the move was not executed — reject and start again.`,

  the_moment: `THE WORLDVIEW: The most powerful brand communication does not describe a feeling. It names the specific moment where the brand becomes real in a person's life — and leaves the occasion deliberately open so every reader walks into it with their own version. The occasion is universal. The moment is specific. The reader supplies the rest.

THE MOVE: Find the occasion — the universal human occasion that exists independently of the brand. Something everyone anticipates or prepares for. Leave it open — do not define what it looks like for any specific person. Find the moment — the specific point where the brand intercepts that occasion and makes it real. Not during the occasion. Before it. The preparation. The ritual. The act that transforms anticipation into something tangible. Name the occasion without defining it. Name the moment with maximum specificity. Compress both into one line.

WORKED EXAMPLES OF THIS MOVE:

Dan Murphy's "Friday Starts In Aisle Six"
Occasion: Friday night — universally understood, personally different for every reader. Moment: aisle six — the specific physical location where Friday first becomes real. Not at the destination. In the choosing. The line does not define what Friday night looks like. Every reader supplies their own version.

Kit Kat "Have A Break, Have A Kit Kat" 1957
Occasion: any moment of relentless pressure — the afternoon that will not end. Moment: the snap — the specific physical act of breaking the bar, the sound, the clean fracture, the permission it grants. The brand is not the chocolate. The brand is the permission to stop.

Nescafé — the first cup
Occasion: the morning — the transition from sleep to wakefulness before the day makes demands. Moment: the first cup — the act that officially begins the day. The specific ritual that transitions from one state to another. Before any decision is made.

Hovis "Boy On A Bike" 1973
Occasion: the return home — arrival after an effort that has earned what waits. Moment: the hill — the specific physical effort of the ascent before the descent. The brand intercepts at the moment of earning rather than the moment of receiving.

John Lewis "The Long Wait" 2011
Occasion: Christmas morning — universally understood, personally different. Moment: the night before — a child awake not from excitement about receiving but from anticipation of giving. Intercepted Christmas at the moment nobody expected.

Guinness "Surfer" 1999
Occasion: the drink worth waiting for. Moment: the vigil — watching the dark liquid settle and the cream head form. The period of watching that converts waiting into ceremony. The brand exists in the two minutes before the product is ready.

Nike — the breath before the start
Occasion: any athletic achievement. Moment: the breath before the attempt. The internal instruction that overrides hesitation. The brand does not exist in the achievement. It exists in the decision to try.

Cadbury "Gorilla" 2007
Occasion: the arrival of unexpected joy. Moment: the drum fill — the eight bars of Phil Collins before the song begins. The anticipatory pleasure that is almost unbearable. The brand intercepted joy at the moment before it arrives.

Levi's "Laundrette" 1985
Occasion: the charged social situation — the room where two people register each other. Moment: the undressing — the specific act that creates the atmosphere the rest of the situation inhabits. The brand intercepts at the most electrically charged moment.

Tango "You've Been Tango'd" 1992
Occasion: the moment of tasting something for the first time. Moment: the impact — the involuntary full-body response before the taste is processed. Intercepted at its most immediate moment.

Apple "Shot On iPhone" 2015
Occasion: any human moment worth recording. Moment: the recognition — the specific instant when someone realises this moment should be captured. Before the shot is taken. The brand exists in the human impulse to preserve.

Stella Artois — the order
Occasion: a round of drinks — the social ritual of declaring what you want. Moment: the specific public declaration. The moment of choosing that is also a statement of identity.

Persil "Dirt Is Good" 2005
Occasion: childhood play. Moment: the mud — the specific sensory evidence that a child was fully present. The stain that confirms engagement. Intercepted play at its most physical evidence point.

Haagen-Dazs "Dedicated To Pleasure" 1991
Occasion: the private indulgence. Moment: breaking the seal of an unopened tub. The specific act of beginning a private ceremony. Intercepted at the most deliberate moment — the decision to begin, before the pleasure arrives.

Lurpak "Weigh Up Your Butter"
Occasion: cooking for someone you care about. Moment: the butter in the hand — the weight before it goes in the pan. The moment of consideration before the commitment. Before the heat, the smell, the taste.

Coca-Cola "Share A Coke" 2011
Occasion: thinking about someone who is not present. Moment: finding their name on a bottle. The specific instant when a mass-produced object becomes personal.

Snickers "You're Not You When You're Hungry" 2010
Occasion: any high-stakes situation requiring full capacity. Moment: the recognition that hunger has already changed you before you noticed. The moment of external observation rather than internal awareness. Intercepted before the person in it recognised they were compromised.

Red Bull Stratos 2012
Occasion: the achievement of something at the absolute limit of human possibility. Moment: the step off the capsule — the specific act of leaving the last safe structure before the fall. The single most irreversible moment.

P&G "Thank You Mom" Olympics 2012
Occasion: a child's achievement of something extraordinary. Moment: the early morning — the mother who got up before everyone else to take the child to training when the achievement was still only a possibility. Intercepted at the earliest possible point.

Extra Gum "The Story Of Sarah And Juan" 2015
Occasion: the long arc of a relationship — years of small moments accumulating into something irreplaceable. Moment: the gum wrapper drawing — the specific tiny act of preserving a moment on the most disposable possible material. The moment that turns out to have been the keeper of the whole story.

WHAT FAILURE LOOKS LIKE: "The perfect drink for your Friday night." This defines the occasion and locates the brand during it rather than at the moment it begins. The reader is not inside anything. They are being told what the brand is for.

QUALITY TEST: Two tests. One — does the line name a universal occasion without defining what it looks like? If it excludes some readers — rewrite. Two — does it locate the brand at the specific moment the occasion becomes real, before the occasion itself? If the brand is present during rather than before — rewrite. Does this output demonstrate the same move type as the worked examples — or does it merely resemble them superficially? If the move was not executed — reject and start again.`,

  one_word_ownership: `THE WORLDVIEW: The most durable brands own one word in the mind. Not a sentence. Not a positioning statement. One word that when heard makes the brand arrive first. The word must be a core category word — the kind of word the entire category is built around. In automotive: performance, safety, space. In beer: reward, refreshment, belonging. The brand does not describe the word. It becomes the word through consistent committed expression that never says the word itself.

THE MOVE: Name the word first — THE WORD IS: [word]. Commit to it before writing anything else. The word must be a core category word that is genuinely available — no competitor currently owns it. Find the expression that makes the word felt without saying it. Confirm the expression owns the word — read the line without brand context and ask: does the word arrive?

FALLBACK — MANDATORY: If after TWO internal attempts you cannot find a fully unowned core category word, DO NOT stop and DO NOT return empty. Select the MOST-AVAILABLE core category word — the one with the weakest existing ownership by any competitor — and proceed. In the "process" field explicitly note the contested ownership: name the competing brand(s), explain why the word is still worth pursuing, and complete the move. In "word_available" state 'CONTESTED — most-available word chosen' and name the competitor(s). Always return a proposition. Silence is never acceptable. A contested-but-committed word beats no output every time.

WORKED EXAMPLES OF THIS MOVE:

Toyota HiLux "Bugger" Australia 1999 — THE WORD: Unbreakable
Expression: the HiLux surviving something it should not — a fence post, a dam, a tree. The driver's response each time: "Bugger." The word of resigned admiration for something that should have broken and did not. "Bugger" never says Unbreakable. Thirty years later in Australia they are inseparable.

VB "For A Hard Earned Thirst" — THE WORD: Reward
Expression: "hard earned thirst" — the compound noun that names the physical state of deserving without using the words deserve or reward. Reward never appears. The physical experience of deserving owns the word more completely than any direct claim.

Volvo "For Life" — THE WORD: Safety
Expression: "For Life." The dual connotation — built for the duration of a life and built to protect your life. Safety never appears. Life appears in both its meanings. The word owned is present in both readings of the word used.

Nike "Just Do It" — THE WORD: Will
Expression: the command addressed to the self. The instruction to override hesitation and act. Will never appears. The line is Will in action — the experience the line creates is the word itself.

De Beers "A Diamond Is Forever" — THE WORD: Permanent
Expression: Forever. Permanent never appears. Forever is Permanent expressed in human terms rather than technical ones. The distinction between the words is the brand's commercial advantage.

Porsche "There Is No Substitute" — THE WORD: Singular
Expression: the refusal to compete. Five words that contain the concept of a category of one. Singular never appears. The refusal to name substitutes names singularity.

Marlboro Country — THE WORD: Freedom
Expression: Marlboro Country. The open landscape. The lone rider answering to nothing. Freedom never appears in the headline. Marlboro Country is Freedom made geographic.

Innocent Drinks — entire brand voice — THE WORD: Honesty
Expression: packaging copy that reads like a note from a person who has nothing to hide. Honesty never appears on Innocent packaging. The experience of reading it is the experience of honesty.

Haagen-Dazs "Dedicated To Pleasure" — THE WORD: Indulgence
Expression: the visual language of intimacy. Close framing. Absence of social context. Private pleasure as ceremony. Indulgence never appears. The visual register makes it the only possible reading.

Johnnie Walker "Keep Walking" — THE WORD: Progress
Expression: the instruction to continue — not toward a destination but as the condition of being alive to possibility. Progress never appears. Keep Walking is Progress expressed as an instruction — a verb commanding an act not a noun describing a state.

Airbnb "Belong Anywhere" — THE WORD: Home
Expression: Belong Anywhere. The paradox of belonging without location. Home never appears in the tagline. Belong Anywhere is Home freed from geography.

Red Bull "Gives You Wings" — THE WORD: Possibility
Expression: wings — the mythological symbol of transcendence, the ability to go beyond ordinary physical limits. Possibility never appears. Wings are Possibility made physical.

Apple "Think Different" — THE WORD: Rebellion
Expression: "Think Different." The grammar is deliberately incorrect — a small act of rebellion in the language itself. Rebellion never appears. The grammatical incorrectness that Apple refused to correct despite professional pressure is rebellion demonstrated rather than claimed.

Guinness "Good Things Come To Those Who Wait" — THE WORD: Craft
Expression: the proverb reactivated. The patience required is the evidence of craft. Craft never appears. The patience required by craft is present in every second of the pour and every frame of the advertising.

Barbie "You Can Be Anything" — THE WORD: Potential
Expression: "You Can Be Anything." Every possible future held simultaneously. Potential never appears. "You Can Be Anything" is Potential expressed as permission.

John Lewis Christmas campaigns — THE WORD: Generosity
Expression: the specific act of giving that costs something beyond money — time, attention, imagination. Generosity never appears in any John Lewis Christmas headline. The campaigns show it. The word is present only in the act.

Tiffany — the blue box — THE WORD: Love
Expression: a specific shade of robin's egg blue on a box. Love never appears on the packaging. The blue box is Love made physical — the word present in the colour without being written anywhere.

BMW "The Ultimate Driving Machine" — THE WORD: Precision
Expression: "The Ultimate Driving Machine." The superlative applied to the mechanical object — the machine that does the one thing it exists to do with the least deviation from the ideal. Precision never appears. "Ultimate Driving Machine" is Precision expressed as completeness.

Under Armour "Rule Yourself" — THE WORD: Discipline
Expression: "Rule Yourself." The specific act of governing your own behaviour in the absence of external authority. Discipline never appears. "Rule Yourself" is Discipline expressed as power — a capacity exercised from within not a constraint imposed from outside.

Mastercard "Priceless" — THE WORD: Value
Expression: the systematic demonstration that the things that matter most cannot be purchased. The meal is priced. The moment is priceless. Value never appears in the Priceless campaign. The word is present in everything the campaign demonstrates cannot be reduced to a price.

WHAT FAILURE LOOKS LIKE: "The most reliable car on the road." This describes the word without owning it. A true ONE WORD OWNERSHIP expression makes you feel the word without saying it. If the line contains the word it is trying to own — the expression has not been found.

QUALITY TEST: Two tests. One — is the word a core category word that is genuinely available? If a competitor owns it — choose a different word. Two — does the expression make you feel the word without saying it? Remove the word mentally. Does it still arrive? If not — find a different expression. Does this output demonstrate the same move type as the worked examples — or does it merely resemble them superficially? If the move was not executed — reject and start again.`,

  invented_authority: `THE WORLDVIEW: Authority is not given. It is invented — and then maintained so consistently it becomes real. INVENTED AUTHORITY finds or creates a figure, moment, or standard of authority so specifically realised that its association with the brand implies quality without claiming it. The authority does not argue for the brand. It implies the brand is the only possible choice for someone of this authority.

THE MOVE: Find the figure, moment, or standard of authority — fictional, borrowed from a famous moment, or borrowed from a moral register that makes the stakes absolute. Establish it completely — not approximately. Find the implied endorsement — not the explicit claim, the implied inevitability. Write the line that invokes the authority in a way that makes the brand's quality feel implied rather than claimed.

WORKED EXAMPLES OF THIS MOVE:

Dos Equis "The Most Interesting Man In The World" 2006
Authority invented: a fictional man of impossible accomplishment and sophistication. Implied endorsement: "I don't always drink beer. But when I do, I prefer Dos Equis." The authority does not claim the beer is good. He implies that when someone of his standards condescends to drink beer — Dos Equis is the only possible choice.

Carling Black Label "Dambusters" 1980s
Authority borrowed: the Dambusters — verified historical moment of technical skill and courage under maximum pressure. Implied endorsement: "I bet he drinks Carling Black Label." Not an assertion. A bet. A logical inference not a claim.

Mobil "We Want You To Live" Australia 1990s
Authority borrowed: medicine and mortality — the absolute moral register of life and death. Implied endorsement: a fuel company that cares enough about your survival to say so publicly has implied everything about the standard of care they invest in their product.

The Economist "Management Trainee Aged 42" 1988
Authority invented: the anonymous management trainee who did not read The Economist and is now aged 42 and still a management trainee. Implied endorsement: the authority of the cautionary figure — the ghost of the reader's possible future. The positive version was supplied by the reader themselves.

Dos Equis "Stay Thirsty My Friends"
Authority invented: the Most Interesting Man evolved from product endorser to cultural philosopher dispensing wisdom about how to live. Implied endorsement: if someone of this philosophical standing has one piece of advice about the disposition required to live well — stay thirsty — the brand associated with that advice inherits the authority.

Listerine "Your Best Friends Won't Tell You" 1920s
Authority invented: the inner circle — the people close enough to know the truth and too considerate to say it. Implied endorsement: if your most trusted people are protecting you from this information the information must be serious enough to require the product.

Churchill Insurance "Oh Yes" nodding dog
Authority invented: Churchill the nodding dog — a figure of cheerful, consistent, uncritical affirmation. Implied endorsement: the insurance company that always says yes. The dog who never finds a reason to refuse. Specific enough to carry one brand truth with total clarity.

Compare The Market "Aleksandr Orlov" 2009
Authority invented: a Russian meerkat businessman with a fully realised backstory, a family, a website, and a social media presence. Meerkatcomparemarket.com was a real destination. The specificity of the invented figure made the authority feel real enough to sustain a brand for fifteen years.

Stella Artois "Reassuringly Expensive" — the Belgian brewing tradition
Authority borrowed: centuries of Belgian brewing craft — the implied standard of a tradition that predates modern marketing. Implied endorsement: the price is the authority's signal. Expensive proved the tradition rather than the tradition justifying the price.

Old Spice "The Man Your Man Could Smell Like" 2010
Authority invented: a man of supernatural competence and effortless achievement. Implied endorsement: the product chosen by a man who can do anything. The authority was so specifically impossible it transcended aspiration and became comedy — which made the implied endorsement more powerful than any sincere version.

Rolex — extreme achievement moments
Authority borrowed: the specific moment of human achievement under the most demanding conditions — Everest, the deep sea, the Grand Slam final. Implied endorsement: the watch on the wrist at the moment of maximum achievement. The watch's presence at the decisive moment was the evidence of its worthiness.

Guinness "Anticipation" — the surfer 1999
Authority borrowed: the surfer — a person for whom patience is a professional skill. Someone who knows from experience that the thing worth having requires waiting for the right conditions. Implied endorsement: if someone whose entire practice is built on the discipline of waiting finds the 119.5 seconds worth it — the standard of the wait is set by the most demanding possible judge.

Johnnie Walker "Keep Walking" — historical figures
Authority borrowed: historical figures who kept walking despite apparent defeat — scientists, explorers, artists who refused the stopping point their circumstances seemed to demand. Implied endorsement: the whisky of people who do not stop. Associated with a quality that can be proven through documented historical example.

Ritz-Carlton "Ladies And Gentlemen Serving Ladies And Gentlemen"
Authority invented: the standard of mutual respect — a figure of service who maintains their own dignity while extending it to the guest. Implied endorsement: a hotel whose staff operate at a standard of personal dignity that elevates the experience of being served by them. You are not just being served. You are being served by someone who considers themselves your equal.

Imperial Leather "The Cossack"
Authority invented: the imperial Russian officer — a figure of absolute personal standards under conditions of extreme physical demand. Implied endorsement: if the standard of personal hygiene required at this level of physical extremity involves this product — its efficacy in ordinary circumstances is implied by the most demanding possible context.

Barclays "A Big Bank. On Your Side."
Authority borrowed: the concept of an institution large enough to be genuinely powerful combined with a disposition to use that power on behalf of the individual. Implied endorsement: a bank both large enough to help you with anything and specifically oriented toward your interests rather than its own.

Dove "Evolution" 2006
Authority invented: the beauty industry's production process shown in time-lapse as the authority that determines what beauty means. Implied endorsement: if the beauty standard is manufactured through this documented process — the brand that names the process has authority over the standard by exposing it.

NSW RTA "Speeding. No One Thinks It'll Happen To Them."
Authority invented: the specific survivor or bereaved family member — a person whose authority comes from being the evidence rather than the expert. Implied endorsement: the road safety message delivered by the person it has already happened to has authority that no government body or expert can match.

Fearless Girl State Street 2017
Authority invented: a small girl standing with her hands on her hips facing the Wall Street bull. Implied endorsement: the financial institution that installed her implies that female leadership is not a diversity aspiration but a market reality the financial world has been slow to recognise. The girl's posture implied everything about the standard the brand was claiming to hold itself to.

Singapore Airlines "A Great Way To Fly" — The Singapore Girl
Authority invented: the Singapore Girl — a figure of composed, unhurried, attentive hospitality who represents a standard of service that makes no concession to efficiency at the expense of care. Implied endorsement: an airline whose service standard is embodied by a specific human figure — not a brand character but a living figure whose presence implies a standard the airline is committed to maintaining.

---

Typecheck clean. Deploy to production now. Confirm when done with confirmation that all thirteen ENGINE_MOVES blocks have been updated and the expanded worked examples are being passed to the model in each engine's system prompt.

WHAT FAILURE LOOKS LIKE: "As recommended by leading experts." This claims authority without inventing it. "Leading experts" is vague enough to be meaningless. A true INVENTED AUTHORITY line names or invokes a specific figure, moment, or standard with enough specificity that the authority feels real regardless of whether it is.

QUALITY TEST: Does this invoke an authority specific enough to be felt rather than understood? If the authority could apply to any brand in this category — it is not specific enough. If the authority is so specifically matched to this brand that the implied endorsement feels inevitable — the move has worked. Does this output demonstrate the same move type as the worked examples — or does it merely resemble them superficially? If the move was not executed — reject and start again.`,
};



// Engines that must NOT see brief context (diagnosis / tension / truths / raw
// brief) before they generate. Their move is designed to start from somewhere
// other than the brief. They receive only brand, category, and a single-
// sentence strategic opportunity.
const BRIEF_ISOLATED_ENGINES: ReadonlySet<EngineName> = new Set<EngineName>([
  "inversion",
  "wrong_room",
  "delete_customer",
  "random_connection",
  "time_displacement",
]);

export function getEngineSystemPrompt(engine: EngineName): string {
  // Reordered: ENGINE_MOVES first (dominant), then GOVERNING_PRINCIPLE,
  // then COPYWRITER_STANDARD last. The move is the instruction — the two
  // shared blocks are filters applied to what the move produces.
  return `You are ${LOC_ENGINE_LABEL[engine]}, one of twelve Left-of-Centre engines.

${ENGINE_MOVES[engine]}

${FORBIDDEN_START}

${GOVERNING_PRINCIPLE}

${COPYWRITER_STANDARD}

${OUTPUT_CONTRACT(engine)}`;
}

export function buildEngineUserMessage(args: {
  engine: EngineName;
  inputs: LocInputs;
  retryInstructions?: string;
}): string {
  const { engine, inputs, retryInstructions } = args;
  const opportunity =
    inputs.realOpportunity && inputs.realOpportunity !== "(not diagnosed)"
      ? inputs.realOpportunity
      : inputs.realProblem && inputs.realProblem !== "(not diagnosed)"
        ? inputs.realProblem
        : "(no single-sentence strategic opportunity captured)";

  const header = `Brand: ${inputs.brandName}
Category: ${inputs.category}
Strategic opportunity (one sentence — context only, NOT a seed): ${opportunity}`;

  const hasRetry = !!(retryInstructions && retryInstructions.trim());
  const retryBlock = hasRetry
    ? `\n\n=== MANDATORY USER RETRY DIRECTIVE (highest priority — overrides any conflicting instruction) ===\nThe previous attempt failed to execute this engine's move correctly. The human operator has supplied the following corrective instructions. You MUST follow them literally. If your output does not visibly satisfy these instructions in the "process" field, it will be rejected.\n\n${retryInstructions!.trim()}\n=== END RETRY DIRECTIVE ===`
    : "";

  // On retry with a user directive, strip Step 2 truths and Step 4 tension
  // from EVERY engine's input. The directive replaces them entirely. Model
  // receives only brand, category, strategic opportunity, and the directive.
  if (hasRetry || BRIEF_ISOLATED_ENGINES.has(engine)) {
    const note = hasRetry
      ? "The user retry directive below fully replaces any prior supporting evidence. Do not ask for or infer Step 2 truths or Step 4 tension — they have been intentionally withheld. Fire the move using only the directive plus your engine's own worldview."
      : "Your move must fire from its own worldview, not from the brief. You have been given no brief context deliberately — this is the whole point of this engine.";
    return `${header}

Perform ${LOC_ENGINE_LABEL[engine]} per your system prompt. ${note} Return the JSON.${retryBlock}`;
  }

  const tensionBlock = inputs.anchoredTension
    ? `=== ANCHORED TENSION (Briefing Room Step 4, verbatim) ===\n${inputs.anchoredTension}\n${inputs.anchoredTensionMeta}`
    : "";
  const truthsBlock = inputs.rawHumanTruths
    ? `=== RAW HUMAN TRUTHS (Briefing Room Step 2, unfiltered) ===\n${inputs.rawHumanTruths}`
    : "";
  const evidence = [tensionBlock, truthsBlock].filter(Boolean).join("\n\n");

  return `${header}

Perform ${LOC_ENGINE_LABEL[engine]} per your system prompt. Fire the move first. Only after you have a candidate line, check it against the supporting evidence below — never let this evidence seed the move. Return the JSON.

${evidence}`;
}



export type EngineOutput = {
  engine: EngineName;
  process: string;
  proposition: string;
  descriptor: string;
  word?: string;
  // Auditable intermediates (engine-specific — see INTERMEDIATES map)
  sacred_assumption?: string;
  wrong_room_chosen?: string;
  lines_from_inside?: string[];
  ideology?: string;
  stimulus?: string;
  stimulus_properties?: string[];
  abandoned_truth?: string;
  enemy_named?: string;
  polite_fiction?: string;
  word_owned?: string;
  word_available?: string;
  authority_figure?: string;
};

export function parseEngineOutput(raw: string, engine: EngineName): EngineOutput {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error(`${engine} engine did not return JSON. Raw: ${trimmed.slice(0, 200)}`);
  }
  const slice = trimmed.slice(jsonStart, jsonEnd + 1);
  const parsed = parseJsonLenient<Record<string, unknown>>(slice);
  const proposition = String(parsed.proposition ?? "").trim();
  const descriptor = String(parsed.descriptor ?? "").trim();
  const process = String(parsed.process ?? "").trim();
  if (!proposition) {
    throw new Error(`${engine} engine returned empty proposition.`);
  }
  if (!process || process.length < 40) {
    throw new Error(
      `${engine} engine returned no auditable process — the move was not executed. Retry required.`,
    );
  }

  // Validate engine-specific intermediates and collect them onto the output.
  const required = INTERMEDIATES[engine] ?? [];
  const extras: Record<string, string | string[]> = {};
  for (const field of required) {
    const value = parsed[field.key];
    if (field.array) {
      const arr = Array.isArray(value)
        ? value.map((v) => String(v ?? "").trim()).filter((v) => v.length > 0)
        : [];
      const min = field.minItems ?? 1;
      if (arr.length < min) {
        throw new Error(
          `${engine} engine missing required intermediate "${field.key}" (need ${min} non-empty item${min > 1 ? "s" : ""}). The move was not executed. Retry required.`,
        );
      }
      extras[field.key] = arr;
    } else {
      const str = String(value ?? "").trim();
      if (!str || str.length < 8) {
        throw new Error(
          `${engine} engine missing required intermediate "${field.key}". The move was not executed. Retry required.`,
        );
      }
      extras[field.key] = str;
    }
  }

  // Backwards compat: one_word_ownership consumers read `.word`. Map from
  // word_owned so decision-package and validation keep working unchanged.
  const legacyWord = String(parsed.word ?? "").trim();
  const derivedWord =
    engine === "one_word_ownership"
      ? (typeof extras.word_owned === "string" ? extras.word_owned : legacyWord)
      : legacyWord;

  return {
    engine,
    process,
    proposition,
    descriptor,
    ...(derivedWord ? { word: derivedWord } : {}),
    ...extras,
  };
}

