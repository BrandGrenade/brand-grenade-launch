// Dan Murphy's (Endeavour Group) — competitive set currency correction.
//
// Coles Group announced on 26 March 2025 that Vintage Cellars and First Choice
// Liquor Market would be retired and all Coles Liquor stores unified under the
// Liquorland banner through 2025. The stored Category Intelligence for session
// c5142f1d predates that consolidation and named five rivals, two of which no
// longer exist. This script corrects the stored data and re-argues the
// competitive-impossibility case against the competitors' live 2026 platforms
// (Liquorland "Legendary" / occasion solver; BWS "Refreshingly BWS" / "Here for it").
//
// Deterministic, idempotent, and auditable: every edit is an explicit string
// replacement that must match exactly once, or the script aborts.

import { SQL } from "bun";

const SESSION = "c5142f1d-a381-44aa-9b88-c21875cc7996";
const db = new SQL({ url: process.env["SUPABASE_DB_URL"] ?? process.env["DB_URL"]!, prepare: false });

type Edit = { find: string; replace: string; optional?: boolean };

// ---------------------------------------------------------------- shared prose

export const LIQUORLAND_RETEST =
  `**Competitive impossibility — re-tested against Liquorland's live position.** ` +
  `Liquorland is now the only Coles liquor banner, having absorbed the Vintage Cellars and ` +
  `First Choice Liquor Market networks through 2025, and its current "Legendary" platform ` +
  `explicitly claims occasion — hosting, celebrating, the everyday hero who turns up with the drinks. ` +
  `That is a genuine adjacency to "Friday starts in aisle six", so clean air cannot be assumed here; ` +
  `it has to be argued. It survives, but narrowly, and on one distinction only: Liquorland's occasion ` +
  `is already declared. The event exists, somebody has been asked to bring the drinks, and Liquorland ` +
  `supplies them. Dan Murphy's proposition sits earlier and further inside — the private moment in the ` +
  `aisle where one person decides, before telling anyone, that tonight is going to be something. ` +
  `Liquorland can claim the occasion; it cannot currently claim the threshold into it, because its ` +
  `store is positioned as a stop on the way to a party rather than the place the party is decided. ` +
  `That distinction is real but thin. If Liquorland's platform moves from supplying occasions to ` +
  `authoring them, this territory is contestable inside a single campaign cycle. The proposition is ` +
  `therefore defensible but not locked, and its defence depends on Dan Murphy's owning the in-store ` +
  `threshold in execution — the aisle itself — not on rivals being unable to talk about occasions.`;

export const BWS_RETEST =
  `**Re-tested against BWS's live position.** BWS runs "Refreshingly BWS" and its "Here for it" ` +
  `platform — the pre-party wingmate, cold drinks ready whenever you are. That is closer to this ` +
  `proposition than a generic convenience reading suggests, because BWS is already trading in ` +
  `anticipation rather than pure fulfilment. The distinction holds more cleanly than Liquorland's: ` +
  `BWS's anticipation belongs to a night already planned and is engineered to take seconds, while this ` +
  `proposition's anticipation is the deliberate walk through a large-format aisle. A drive-through ` +
  `cannot stage a threshold. BWS is excluded by format, not merely by positioning.`;

const CURRENCY_NOTE =
  `\n\n> **Competitive set currency (verified 2026).** Vintage Cellars and First Choice Liquor Market ` +
  `were retired by Coles Group from March 2025 and their approximately 160 stores converted to the ` +
  `Liquorland banner, lifting Liquorland's national footprint by roughly a quarter. They are not ` +
  `separate competitors and are not counted as such. The real contested set in Australian liquor retail ` +
  `is three named entities plus online pure-plays: BWS, Liquorland, and independent bottle shops.\n`;

// ---------------------------------------------------------------- edits by field

const EDITS: Record<string, Edit[]> = {
  stage_2_output: [
    {
      find: `**BWS (Woolworths)**
Convenient alcohol access attached to grocery shopping — the brand people use when buying alcohol is a task to complete alongside buying milk, not a decision that warrants dedicated attention.

**Liquorland (Coles Group)**
Neighbourhood bottle shop proximity with supermarket-style promotions — occupies the same strategic territory as BWS with marginally less distribution density.

**First Choice Liquor (Coles Group)**
Larger-format BWS with more range — attempts to compete with Dan Murphy's on selection while maintaining supermarket-style promotional intensity, but owns nothing distinct in the customer's mind.

**Vintage Cellars (Endeavour Group)**
Premium-positioned specialist with curated range — signals higher-end drinking but lacks the authority to genuinely educate or the scale to compete on convenience, leaving it in strategic no-man's land.`,
      replace: `**BWS (Woolworths)**
The pre-party wingmate — under "Refreshingly BWS" and its "Here for it" platform, BWS owns the cold-drinks-ready-when-you-are moment on the way to somewhere else, not the deliberate shop.

**Liquorland (Coles Group)**
The occasion supplier — now Coles' single liquor banner after absorbing Vintage Cellars and First Choice Liquor Market through 2025, and positioned under its "Legendary" platform as the ultimate occasion solver: the stop that ensures the barbecue, the dinner or the footy final has drinks in hand.`,
    },
    {
      find: `**"Expert staff who can help"** — Vintage Cellars, independent specialists, and premium retailers all claim staff expertise and personal service.`,
      replace: `**"Expert staff who can help"** — independent specialists and premium retailers all claim staff expertise and personal service.`,
    },
    {
      find: `## Overcrowded Territories`,
      replace: `${CURRENCY_NOTE}\n## Overcrowded Territories`,
    },
  ],

  stage_8_output: [
    {
      find: `It directly contradicts BWS and Liquorland's convenience positioning by suggesting that the most important shopping isn't last-minute at all`,
      replace: `It directly contradicts BWS's pre-party convenience and Liquorland's occasion-supply positioning by suggesting that the most important shopping isn't last-minute at all`,
    },
    {
      find: `Vintage Cellars' expert-staff positioning and the entire premium retail assumption`,
      replace: `Independent and premium specialists' expert-staff positioning and the entire premium retail assumption`,
    },
  ],

  stage_9_output: [
    {
      find: `through price (Dan Murphy's current position), convenience (BWS/Liquorland), or expertise (Vintage Cellars)`,
      replace: `through price (Dan Murphy's current position), pre-party convenience (BWS), occasion supply (Liquorland), or expertise (independent and premium specialists)`,
    },
    {
      find: `**The Unspoken Expertise** differentiates by protecting knowledge rather than performing it — Vintage Cellars celebrates expertise, independents offer personal service,`,
      replace: `**The Unspoken Expertise** differentiates by protecting knowledge rather than performing it — premium specialists celebrate expertise, independents offer personal service,`,
    },
    {
      find: `It cannot be adopted by Vintage Cellars without undermining their expert-staff value proposition.`,
      replace: `It cannot be adopted by premium and independent specialists without undermining their expert-staff value proposition.`,
    },
    {
      find: `**The Unspoken Expertise** cannot be adopted by Vintage Cellars or premium specialists without dismantling`,
      replace: `**The Unspoken Expertise** cannot be adopted by premium or independent specialists without dismantling`,
    },
  ],

  stage_10_output: [
    {
      find: `Where Vintage Cellars positions expertise as cultural capital and independents offer personal service that displays sophistication,`,
      replace: `Where premium specialists position expertise as cultural capital and independents offer personal service that displays sophistication,`,
    },
    {
      find: `**Competitive Impossibility: 7/10** — The line contradicts BWS and Liquorland's convenience-and-immediacy positioning, which makes it awkward for those specific rivals to claim without undermining their operational logic. However, no structural lock prevents a competitor from repositioning around occasion-planning — Liquorland could run a "plan your weekend" campaign with moderate effort, since nothing in the line derives from Dan Murphy's name or an exclusive asset.`,
      replace: `**Competitive Impossibility: 5/10** — Re-scored against the live competitive set rather than an outdated one. Liquorland does not merely compete on immediacy: its current "Legendary" platform positions it as the ultimate occasion solver, which is adjacent territory, not distant territory. ${LIQUORLAND_RETEST}\n\n${BWS_RETEST}\n\nThe score is reduced from 7 to 5 accordingly: the territory is defensible on the threshold distinction and on Dan Murphy's large-format aisle, but no structural lock prevents Liquorland from extending "Legendary" from supplying occasions to authoring them, and nothing in the line derives from Dan Murphy's name or an exclusive asset.`,
    },
    {
      find: `BWS ("Beer, Wine, Spirits" convenience) and Liquorland compete on immediacy and proximity, which is adjacent but oriented to the opposite moment — present-need fulfilment, not future-occasion design. No named rival brand or campaign currently claims the anticipatory-curation territory,`,
      replace: `BWS ("Here for it") claims the pre-party moment for a night already planned, and Liquorland ("Legendary") claims the occasion itself once it has been declared. Both are adjacent, and Liquorland is the closer of the two. Neither currently claims the moment before the occasion is declared — the in-store threshold where the decision is made privately. No named rival brand or campaign currently claims the anticipatory-curation territory,`,
    },
  ],

  stage_11_output: [
    {
      find: `Counter: "Everything you need, right when you need it." (BWS positioning convenience over planning)`,
      replace: `Counter: "Legendary." (Liquorland's live platform, positioning the brand as the ultimate occasion solver — the closest real threat, re-tested below) and "Here for it." (BWS's live pre-party platform)`,
    },
    {
      find: `Counter: "Discover something new with our expert team." (Vintage Cellars positioning staff expertise)`,
      replace: `Counter: "Discover something new with our expert team." (independent and premium specialists positioning staff expertise)`,
    },
    {
      find: `Counter: "Always bring something special." (Vintage Cellars or independent specialist positioning premium gifting)`,
      replace: `Counter: "Always bring something special." (independent or premium specialist positioning premium gifting)`,
    },
    {
      find: `A Vintage Cellars or independent specialist executing "always bring something special"`,
      replace: `A premium or independent specialist executing "always bring something special"`,
    },
  ],

  stage_16_consulting_output: [
    {
      find: `Coles Group owns Liquorland and First Choice, both trapped in the same promotional hamster wheel.`,
      replace: `Coles Group now runs a single liquor banner, Liquorland, after retiring Vintage Cellars and First Choice Liquor Market through 2025 and converting roughly 160 stores across.`,
    },
    {
      find: `First Choice attempts scale and range but cannot escape its supermarket DNA`,
      replace: `Liquorland's enlarged network attempts scale and range but cannot escape its supermarket DNA`,
    },
    {
      find: `When BWS counters "Friday starts in aisle six" with "everything you need, right when you need it," they validate that competitors remain trapped in fulfillment-moment thinking while we occupy planning-moment strategy.`,
      replace: `The real counter is not BWS but Liquorland. ${LIQUORLAND_RETEST}\n\n${BWS_RETEST}`,
    },
    {
      find: `When Vintage Cellars counters "nobody needs to know how much you know" with "discover something new with our expert team,"`,
      replace: `When a premium specialist counters "nobody needs to know how much you know" with "discover something new with our expert team,"`,
    },
  ],

  stage_16_vision_output: [
    {
      find: `**BWS** is built on convenience attached to grocery — it cannot claim the store as a threshold because its store is an afterthought beside the milk. **Liquorland** and **First Choice** occupy the same convenience-and-promotion territory with no distinct meaning to build from. **Vintage Cellars** trades on curation and sits in premium no-man's-land, unable to speak to the unpretentious mass moment.`,
      replace: `**BWS** runs "Here for it" — the pre-party wingmate, cold drinks ready on the way to a night already planned. It cannot claim the store as a threshold because its format is engineered to take seconds. **Liquorland**, now Coles' only liquor banner after absorbing Vintage Cellars and First Choice Liquor Market in 2025, runs "Legendary" and explicitly claims occasion. It is the closest real threat, and the distinction is a narrow one: Liquorland supplies an occasion someone has already declared, while this proposition owns the private moment in the aisle before anyone has been told. **Independent bottle shops** trade on curation and personal service, and cannot speak to the unpretentious mass moment at scale.`,
    },
  ],

  doc_consulting_sections: [
    {
      find: `**BWS (Woolworths)** owns the mental territory of \\"good enough, right now\\"`,
      replace: `**BWS (Woolworths)** runs \\"Here for it\\" and owns the pre-party moment — \\"good enough, right now\\"`,
    },
    {
      find: `**Liquorland (Coles)** operates as neighbourhood proximity without editorial point of view — the bottle shop closest to home when planning ahead seems excessive.`,
      replace: `**Liquorland (Coles)** is now Coles' single liquor banner, having absorbed the Vintage Cellars and First Choice Liquor Market networks through 2025, and under its \\"Legendary\\" platform positions itself as the ultimate occasion solver.`,
    },
    {
      find: `**Vintage Cellars (Endeavour Group)** signals sophisticated drinking for people who want reassurance they have sophisticated taste — a brand that validates aspiration but requires customers to arrive already feeling aspirational.`,
      replace: `**Independent bottle shops** signal sophisticated drinking for people who want reassurance they have sophisticated taste — they validate aspiration but require customers to arrive already feeling aspirational.`,
    },
    {
      find: `The competitive counter-proposition from BWS—\\"Everything you need, right when you need it\\"—validates our strategic choice by exposing how trapped rivals remain in fulfillment-moment thinking.`,
      replace: `The competitive counter is Liquorland, not BWS. ${LIQUORLAND_RETEST.replace(/"/g, '\\"')}`,
    },
    {
      find: `This defensive posture from BWS strengthens rather than weakens our position because it acknowledges the customer behavior we're naming without offering an alternative interpretation.`,
      replace: `${BWS_RETEST.replace(/"/g, '\\"')}`,
    },
    {
      find: `whether BWS's convenience, Liquorland's local access, or competitors' focus on the moment of consumption`,
      replace: `whether BWS's pre-party convenience, Liquorland's supply of already-declared occasions, or competitors' focus on the moment of consumption`,
    },
    {
      find: `where Vintage Cellars curates for connoisseurs and BWS competes on convenience`,
      replace: `where independents curate for connoisseurs and BWS competes on pre-party convenience`,
    },
  ],

  doc_agency_sections: [
    {
      find: `**BWS** owns convenient adequacy.`,
      replace: `**BWS** owns the pre-party, under \\"Refreshingly BWS\\" and \\"Here for it\\" — cold drinks ready when you are.`,
    },
    {
      find: `**Liquorland** occupies almost identical territory to BWS — Coles-proximate convenience with promotional pricing — but with lower share of mind and weaker distribution. It survives on shoppers who already shop at Coles, not shoppers who choose it deliberately. The brand cannot claim anything BWS doesn't already own, and its Coles-group ownership prevents it from developing independent brand meaning.`,
      replace: `**Liquorland** is the closest real threat. It is now Coles' single liquor banner, having absorbed the Vintage Cellars and First Choice Liquor Market networks through 2025 for roughly a quarter more national footprint, and its \\"Legendary\\" platform explicitly claims occasion — hosting, celebrating, the everyday hero arriving with the drinks.`,
    },
    {
      find: `Any cultural territory Liquorland attempted to claim would be undermined by its operational reality as a supermarket adjacency play.`,
      replace: `${LIQUORLAND_RETEST.replace(/"/g, '\\"')}`,
    },
    {
      find: `**Vintage Cellars** signals premium intent through darker store environments, smaller footprints, and ostensibly curated ranging.`,
      replace: `**Independent bottle shops** signal premium intent through darker store environments, smaller footprints, and genuinely curated ranging.`,
    },
    {
      find: `Vintage Cellars cannot enter culture-shaping territory because it has no cultural perspective, only a price-tier strategy dressed in moodier lighting.`,
      replace: `Independents cannot enter culture-shaping territory at national scale because they lack the footprint and the media weight, however strong their local relationships.`,
    },
    {
      find: `Third, brand architecture that separates it from BWS's convenience positioning and Vintage Cellars' curation theatre,`,
      replace: `Third, brand architecture that separates it from BWS's pre-party positioning and independents' curation theatre,`,
    },
    {
      find: `BWS optimises for convenience. Independents fetishise curation for its own sake. Vintage Cellars positions on premiumisation without utility.`,
      replace: `BWS optimises for the pre-party dash. Independents fetishise curation for its own sake. Liquorland supplies occasions that have already been declared.`,
    },
  ],

  brief_text: [
    {
      find: `Liquorland — no distinctive positioning.`,
      replace: `Liquorland — now Coles' single liquor banner after absorbing Vintage Cellars and First Choice Liquor Market in 2025; positions on occasion under its "Legendary" platform.`,
    },
    {
      find: `Vintage Cellars — premium wine positioning within Endeavour Group.`,
      replace: `Independent bottle shops — premium wine positioning and curation.`,
    },
    {
      find: `That BWS or Vintage Cellars is inferior.`,
      replace: `That BWS or Liquorland is inferior.`,
    },
  ],
};

// ---------------------------------------------------------------- apply

function applyEdits(field: string, text: string, edits: Edit[]): string {
  let out = text;
  for (const e of edits) {
    const count = out.split(e.find).length - 1;
    if (count === 0) {
      if (out.includes(e.replace)) {
        console.log(`  = ${field}: already applied`);
        continue;
      }
      throw new Error(`NO MATCH in ${field}: ${e.find.slice(0, 90)}…`);
    }
    if (count > 1) throw new Error(`AMBIGUOUS (${count}x) in ${field}: ${e.find.slice(0, 90)}…`);
    out = out.replace(e.find, e.replace);
    console.log(`  ✓ ${field}: ${e.find.slice(0, 70).replace(/\n/g, " ")}…`);
  }
  return out;
}

const row = (await db`select * from sessions where id = ${SESSION}`)[0];
if (!row) throw new Error("session not found");

const updates: Record<string, unknown> = {};
for (const [field, edits] of Object.entries(EDITS)) {
  const raw = row[field];
  if (raw == null) throw new Error(`${field} is null`);
  const isJson = typeof raw !== "string";
  const text = isJson ? JSON.stringify(raw) : raw;
  const next = applyEdits(field, text, edits);
  if (next !== text) updates[field] = isJson ? JSON.parse(next) : next;
}

for (const [field, value] of Object.entries(updates)) {
  const v = typeof value === "string" ? value : JSON.stringify(value);
  await db.unsafe(`update sessions set ${field} = $1 where id = $2`, [v, SESSION]);
  console.log(`saved ${field}`);
}

// saved brief carries the same stale input copy
const briefEdits = EDITS["brief_text"]!;
const brief = (await db`select brief_id, brief_text from saved_briefs where brief_text ~* '(vintage cellars|first choice)'`)[0];
if (brief) {
  const next = applyEdits("saved_briefs.brief_text", brief.brief_text as string, briefEdits);
  await db`update saved_briefs set brief_text = ${next} where brief_id = ${brief.brief_id}`;
  console.log("saved saved_briefs.brief_text");
}

await db.end();
console.log("done");
