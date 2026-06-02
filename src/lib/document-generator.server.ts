// Server-only helpers for the new document generation system.
// - Section definitions per format
// - HTML assembly (cover, sections, prop-reveal page, footer)
// - Minimal markdown → HTML converter for inline rich text
//
// This file is server-only (`.server.ts`) so it can never be pulled into the
// client bundle — see tanstack-supabase-import-graph.

export type DocFormat = "consulting" | "agency" | "workshop";

export interface SectionDef {
  name: string;
  maxTokens: number;
  systemPrompt: string;
  userMessage: string;
}

export interface SessionLike {
  brand_name: string | null;
  category: string | null;
  selected_smp: string | null;
  stage_1_output: string | null;
  stage_2_output: string | null;
  stage_5_output: string | null;
  stage_7_output: string | null;
  stage_8_output: string | null;
  stage_10_output: string | null;
  stage_11_output: string | null;
  stage_12_output: string | null;
  stage_13_output: string | null;
  stage_14_output: string | null;
  stage_14b_output: string | null;
  stage_14c_output: string | null;
  stage_15_output: string | null;
}

const WRITING_STANDARD = `
You are a senior partner at a top-tier global strategy consultancy.
Write with authority and precision.
One idea per paragraph.
Four sentences maximum per paragraph.
No padding. No repetition.
No generic observations.
Every sentence must be specific to this brand and this situation.
Start writing immediately.
No preamble. No heading.
End with a complete sentence.
`;

function slice(value: string | null | undefined, n: number): string {
  return (value ?? "").substring(0, n);
}

const STAGE1_INTERNAL_LINE = /(PIPELINE DATA HEADER|BRIEF DEPTH LEVEL:|CATEGORY KNOWLEDGE CONFIDENCE:|BRIEF ELEMENTS PRESENT:|ASSUMPTIONS MADE:)/i;

function stripStage1Internals(value: string | null | undefined): string {
  return (value ?? "").split("\n").filter((l) => !STAGE1_INTERNAL_LINE.test(l)).join("\n");
}

export function getSectionDefs(format: DocFormat, session: SessionLike): SectionDef[] {
  const brand = session.brand_name ?? "Untitled Brand";
  const category = session.category ?? "";
  const smp = session.selected_smp ?? "";
  const s1 = slice(session.stage_1_output, 1500);
  const s2 = slice(session.stage_2_output, 3000);
  const s5 = slice(session.stage_5_output, 1500);
  const s7 = slice(session.stage_7_output, 2000);
  const s8 = slice(session.stage_8_output, 3000);
  const s10 = slice(session.stage_10_output, 1500);
  const s11 = slice(session.stage_11_output, 2000);
  const s12 = slice(session.stage_12_output, 1500);
  const s13 = slice(session.stage_13_output, 2000);
  const s14 = slice(session.stage_14_output, 2000);
  const s14b = slice(session.stage_14b_output, 2000);
  const s14c = slice(session.stage_14c_output, 2000);
  const s15 = slice(session.stage_15_output, 1000);

  // Self-contained userMessages: if upstream stage outputs are empty, instruct
  // the model to draw on general knowledge instead of receiving empty context.
  const situationUser = `Brand: ${brand}
Category: ${category}
Brief: ${(session.stage_1_output ?? "").substring(0, 2000)}
Write the opening argument for why ${brand} in ${category} faces a critical strategic moment right now. If no brief context is available, draw on general knowledge of this brand and category. Three paragraphs. 350 words maximum. Board level.`;

  const categoryUser = `Brand: ${brand}
Category: ${category}
Selected proposition: "${smp}"
Intelligence: ${s2 || "Draw on general knowledge of " + category}
Analyse the competitive landscape for ${brand} in ${category}. One paragraph per major competitor. Two paragraphs on category silence. 400 words maximum.`;

  const humanTruthUser = `Brand: ${brand}
Category: ${category}
Selected proposition: "${smp}"
Context: ${s7 || "Draw on general knowledge of " + category + " customers"}
Write the human insight section. The specific behaviour and contradiction of customers in ${category}. Three paragraphs building to the Human Contradiction Statement. 350 words maximum.`;

  const evidenceUser = `Brand: ${brand}
Category: ${category}
Selected proposition: "${smp}"
Tests: ${s11 || "Generate five integrity tests for this proposition"}
Write the validation section. Five pressure tests the proposition passed. Two paragraphs per test. 400 words maximum.`;

  if (format === "consulting") {
    return [
      {
        name: "situation",
        maxTokens: 800,
        systemPrompt:
          WRITING_STANDARD +
          `\nWrite the opening argument of a board strategy recommendation for ${brand} in ${category}.\nThree paragraphs. 350 words maximum.\nWhat has changed commercially or culturally. Why it demands a strategic response now. The specific stakes if the brand does not move.\nSpecific to this brand. Not generic category observations.`,
        userMessage: situationUser,
      },
      {
        name: "category",
        maxTokens: 900,
        systemPrompt:
          WRITING_STANDARD +
          `\nWrite the competitive analysis section of a board strategy recommendation for ${brand}.\nOne paragraph per major competitor — what they genuinely own in the audience's mind and the precise structural reason they cannot enter the recommended territory.\nEnd with two paragraphs naming what the category has collectively agreed not to say and why that silence created the opportunity.\nClose with a pull quote:\n> [The single most important insight — one precise sentence]`,
        userMessage: categoryUser,
      },
      {
        name: "human_truth",
        maxTokens: 800,
        systemPrompt:
          WRITING_STANDARD +
          `\nWrite the human insight section of a board strategy recommendation for ${brand}.\nThree paragraphs building to the core insight.\nThe specific behaviour — the gap between what this audience tells institutions and what they actually do.\nWrite as revelation not description.\nEnd with the Human Contradiction Statement as a pull quote:\n> [The specific contradiction — one precise sentence]\nThen one paragraph on what this insight makes strategically possible.`,
        userMessage: humanTruthUser,
      },
      {
        name: "why_brand",
        maxTokens: 1200,
        systemPrompt:
          WRITING_STANDARD +
          `\nWrite the brand credibility section of a board strategy recommendation for ${brand}.\nThree paragraphs on the specific advantages that make this territory available to this brand and unavailable to competitors.\nTwo paragraphs honestly assessing what the brand cannot yet do and what must change.\nDo not soften the honest gap. Boards respect directness.`,
        userMessage: `Brand: ${brand}\nCategory: ${category}\nBrand fit assessment: ${s13}`,
      },
      {
        name: "alternatives",
        maxTokens: 1500,
        systemPrompt:
          WRITING_STANDARD +
          `\nWrite the alternatives evaluation section of a board strategy recommendation for ${brand}.\nFor each alternative proposition — two paragraphs: what it was and its genuine strengths, then the precise strategic reason it was not selected.\nThe rejection must be so specific that a sceptical board member cannot respond with "but couldn't you just."`,
        userMessage: `Brand: ${brand}\nAll propositions evaluated: ${s8}\nScoring: ${s10}\nSelection rationale: ${s12}\nSelected proposition: "${smp}"`,
      },
      {
        name: "evidence",
        maxTokens: 900,
        systemPrompt:
          WRITING_STANDARD +
          `\nWrite the validation section of a board strategy recommendation for ${brand}.\nPresent each pressure test as a strategic argument — not a checklist or score table.\nFor each test: what was tested, what it confirmed, what it exposed, what the exposure means for implementation.\nTwo paragraphs per test.`,
        userMessage: evidenceUser,
      },
      {
        name: "recommendation_pre",
        maxTokens: 700,
        systemPrompt:
          WRITING_STANDARD +
          `\nWrite three paragraphs that synthesise the entire strategic argument for ${brand} — the category truth, the human insight, the brand's right to this territory, the evidence of its availability — into a single logical sequence that makes the selected proposition feel inevitable.\nDo not name the proposition.\nBuild the complete case first.\nEnd your final paragraph with a sentence that creates the conditions for the proposition to land as a conclusion.`,
        userMessage: `Brand: ${brand}\nCategory: ${category}\nSelected proposition: "${smp}"\nSelection rationale: ${s12}\nTerritory synthesis: ${s7}`,
      },
      {
        name: "recommendation_post",
        maxTokens: 700,
        systemPrompt:
          WRITING_STANDARD +
          `\nWrite the post-reveal section of a board strategy recommendation for ${brand}.\nThe selected proposition is: "${smp}"\nThis has just been revealed on its own page.\nNow write what it means:\nThree paragraphs covering:\n1. What it claims commercially — the specific market position\n2. What it requires of the business — product, operations, culture\n3. What success looks like — specific measurable outcomes`,
        userMessage: `Brand: ${brand}\nCategory: ${category}\nSelected proposition: "${smp}"\nBrand fit assessment: ${s13}\nConsistency audit: ${s15}`,
      },
      {
        name: "creative_world",
        maxTokens: 800,
        systemPrompt:
          WRITING_STANDARD +
          `\nWrite the creative world section of a board strategy recommendation for ${brand}.\nFour paragraphs describing the strategic universe the proposition opens — written for a board member who needs to understand what kind of work this strategy produces.\nNo bullet lists. Pure narrative.\nMake the creative world feel real, specific, and worth the commercial investment.`,
        userMessage: `Brand: ${brand}\nBrand world definition: ${s14c}\nTerritory mapping: ${s14}`,
      },
      {
        name: "what_must_change",
        maxTokens: 700,
        systemPrompt:
          WRITING_STANDARD +
          `\nWrite the operational commitments section of a board strategy recommendation for ${brand}.\nThree paragraphs. Direct. Honest.\nName specifically what must change in product, service, operations, and internal culture for the positioning to be credible.\nThis is where partners earn their fee — by saying the uncomfortable thing clearly.\nDo not soften. Do not hedge.`,
        userMessage: `Brand: ${brand}\nBrand fit assessment: ${s13}\nConsistency audit: ${s15}`,
      },
      {
        name: "next_steps",
        maxTokens: 500,
        systemPrompt:
          WRITING_STANDARD +
          `\nWrite the next steps section of a board strategy recommendation for ${brand}.\nExactly three paragraphs.\nOne decision per paragraph.\nSpecific action. Named ownership. Specific timing.\nNo "consider" or "explore."\nWhat must happen. Who does it. By when.`,
        userMessage: `Brand: ${brand}\nCategory: ${category}\nSelected proposition: "${smp}"`,
      },
    ];
  }

  if (format === "agency") {
    return [
      {
        name: "before_you_read",
        maxTokens: 600,
        systemPrompt: `\nYou are a senior global planning director at a world-class creative agency writing a strategic platform document.\nWrite directly to the creative teams who will use this document.\nSecond person. Direct. Alive.\nTell them what this document requires of them.\nExplain that the proposition arrives in the middle — not at the start — and why.\nTell them what kind of work this strategy demands.\n300 words maximum.\nStart immediately. No heading.`,
        userMessage: `Brand: ${brand}\nCategory: ${category}\nSelected proposition: "${smp}"`,
      },
      {
        name: "strategic_context",
        maxTokens: 700,
        systemPrompt: `\nYou are a senior global planning director writing a strategic platform document for ${brand}.\nWrite the strategic context section.\nThree paragraphs on the specific commercial and cultural moment this brand is navigating.\nThe structural shift that created the opportunity. The window that will not stay open.\nWritten for creative directors who need urgency and precision.\n350 words maximum.\nStart immediately. No heading.`,
        userMessage: `Brand: ${brand}\nCategory: ${category}\nBrief context: ${s1}\nCompetitive intelligence: ${slice(session.stage_2_output, 1000)}`,
      },
      {
        name: "category",
        maxTokens: 900,
        systemPrompt: `\nYou are a senior global planning director writing a strategic platform document for ${brand}.\nWrite the category section.\nOne paragraph per major competitor — what they own and why they cannot enter the recommended territory.\nTwo paragraphs on what the category has agreed not to say.\nClose with a pull quote:\n> [The category silence — one precise sentence]\n400 words maximum.\nStart immediately. No heading.`,
        userMessage: `Brand: ${brand}\nCategory: ${category}\nCompetitive intelligence: ${s2}`,
      },
      {
        name: "human_truth",
        maxTokens: 800,
        systemPrompt: `\nYou are a senior global planning director writing a strategic platform document for ${brand}.\nWrite the human truth section.\nFour paragraphs. The specific behaviour. The contradiction. The gap between what this audience tells institutions and what they actually do.\nWrite as revelation — something creative teams will immediately recognise.\nEnd with:\n> [Human Contradiction Statement]\nThen two paragraphs on what this opens creatively.\n400 words maximum.\nStart immediately. No heading.`,
        userMessage: `Brand: ${brand}\nStrategic territories: ${s7}\nInsights: ${s5}`,
      },
      {
        name: "why_brand",
        maxTokens: 700,
        systemPrompt: `\nYou are a senior global planning director writing a strategic platform document for ${brand}.\nWrite the brand section.\nThree paragraphs on what this brand has that no competitor possesses in the same combination.\nTwo paragraphs on the specific constraint every execution must respect — the credibility gap and the rule it creates.\n350 words maximum.\nStart immediately. No heading.`,
        userMessage: `Brand: ${brand}\nBrand fit assessment: ${s13}`,
      },
      {
        name: "alternatives",
        maxTokens: 800,
        systemPrompt: `\nYou are a senior global planning director writing a strategic platform document for ${brand}.\nWrite the alternatives section.\nFor each alternative proposition — two paragraphs: what it was and what a creative team could have built inside it, then the precise reason it was rejected.\nShow rigour. The recommendation survived real alternatives.\n400 words maximum.\nStart immediately. No heading.`,
        userMessage: `Brand: ${brand}\nAll propositions: ${s8}\nSelection rationale: ${s12}\nSelected: "${smp}"`,
      },
      {
        name: "proposition_pre",
        maxTokens: 600,
        systemPrompt: `\nYou are a senior global planning director writing a strategic platform document for ${brand}.\nWrite three paragraphs that synthesise the entire argument and make the proposition feel inevitable.\nDo not name the proposition.\nComplete the argument. Create the conditions for the proposition to land as the only possible conclusion.\n300 words maximum.\nStart immediately. No heading.`,
        userMessage: `Brand: ${brand}\nCategory: ${category}\nSelected proposition: "${smp}"\nTerritory synthesis: ${s7}`,
      },
      {
        name: "proposition_post",
        maxTokens: 700,
        systemPrompt: `\nYou are a senior global planning director writing a strategic platform document for ${brand}.\nThe proposition "${smp}" has just been revealed.\nWrite what it means for the work:\nWhat it claims — the specific territory being established.\nWhat it challenges — the category convention it contradicts.\nWhat it makes possible — the creative world it opens.\nWhat it requires — the specific demands on every execution.\nFour paragraphs. 350 words.\nStart immediately. No heading.`,
        userMessage: `Brand: ${brand}\nCategory: ${category}\nSelected proposition: "${smp}"\nBrand fit: ${slice(session.stage_13_output, 1000)}`,
      },
      {
        name: "creative_world",
        maxTokens: 1200,
        systemPrompt: `\nYou are a senior global planning director writing a strategic platform document for ${brand}.\nWrite the creative world section.\nThis is the most important section for creative teams.\nThe world — its character and governing tension. 2 paragraphs.\nThe rules of this world — each rule as a bold statement followed by one paragraph of explanation.\nWho inhabits this world — each archetype as a vivid behavioural portrait. 2 paragraphs each.\nWhat the brand does here. 2 paragraphs.\nNo bullet lists. Pure narrative.\n600 words maximum.\nStart immediately. No heading.`,
        userMessage: `Brand: ${brand}\nBrand world definition: ${s14c}\nTerritory mapping: ${s14}`,
      },
      {
        name: "channels",
        maxTokens: 800,
        systemPrompt: `\nYou are a senior global planning director writing a strategic platform document for ${brand}.\nWrite the channel behaviour section.\nFor each channel — Film, Social, Influencer, Activation, Partnership:\nTwo paragraphs: the specific capability this channel has in this territory, and the specific risk to protect against.\nNot campaign ideas. How the proposition's truth manifests in each environment.\n400 words maximum.\nStart immediately. No heading.`,
        userMessage: `Brand: ${brand}\nSelected proposition: "${smp}"\nChannel mapping: ${s14b}`,
      },
      {
        name: "brief_to_teams",
        maxTokens: 500,
        systemPrompt: `\nYou are a senior global planning director writing a strategic platform document for ${brand}.\nWrite the brief to creative teams.\nDirect address. Second person.\nWhat they are making and why.\nThe single most important thing the work must do.\nWhat the work must never do — specifically.\nThe test every execution must pass.\nThe one sentence that should be on the wall of every room where this work is being made.\n250 words maximum.\nStart immediately. No heading.`,
        userMessage: `Brand: ${brand}\nSelected proposition: "${smp}"\nCategory: ${category}`,
      },
    ];
  }

  // workshop
  return [
    {
      name: "facilitator_intro",
      maxTokens: 600,
      systemPrompt: `\nYou are a senior strategy facilitator writing a workshop guide for ${brand}.\nWrite the facilitator introduction.\nWhat this guide is for.\nThe design principle — why you construct rather than present.\nWhat the workshop produces.\nThe most important thing to get right.\nThe most common failure mode.\n300 words maximum.\nStart immediately. No heading.`,
      userMessage: `Brand: ${brand}\nCategory: ${category}\nSelected proposition: "${smp}"`,
    },
    {
      name: "preparation",
      maxTokens: 400,
      systemPrompt: `\nYou are a senior strategy facilitator writing a workshop guide for ${brand}.\nWrite the preparation section.\nTwo weeks before, one week before, day before, day of.\nSpecific enough that a first-time facilitator can execute without additional briefing.\n200 words maximum.\nStart immediately. No heading.`,
      userMessage: `Brand: ${brand}\nCategory: ${category}`,
    },
    {
      name: "session_one",
      maxTokens: 800,
      systemPrompt: `\nYou are a senior strategy facilitator writing a workshop guide for ${brand}.\nWrite Session One — The World We Operate In — 45 minutes.\nFour parts:\nFACILITATOR GUIDE — how to open, what energy to create, what to watch for. 2 paragraphs.\nPARTICIPANT CONTENT — the category reality from competitive intelligence. 3 paragraphs accessible to a mixed audience.\nDISCUSSION QUESTIONS — 3 specific questions that surface honest observations.\nSYNTHESIS ACTIVITY — specific activity with timing and output.\n400 words maximum.\nStart immediately. No heading.`,
      userMessage: `Brand: ${brand}\nCategory: ${category}\nCompetitive intelligence: ${slice(session.stage_2_output, 2000)}`,
    },
    {
      name: "session_two",
      maxTokens: 800,
      systemPrompt: `\nYou are a senior strategy facilitator writing a workshop guide for ${brand}.\nWrite Session Two — The People We Are Failing to Serve — 45 minutes.\nSame four-part structure as Session One.\nContent from the human insight.\nThe synthesis activity produces the Human Contradiction Statement in the room's own words before they see the one from the process.\n400 words maximum.\nStart immediately. No heading.`,
      userMessage: `Brand: ${brand}\nCategory: ${category}\nHuman insight: ${slice(session.stage_7_output, 2000)}`,
    },
    {
      name: "session_three",
      maxTokens: 800,
      systemPrompt: `\nYou are a senior strategy facilitator writing a workshop guide for ${brand}.\nWrite Session Three — What Is Available to Own — 45 minutes.\nSame four-part structure.\nPresent all alternative propositions without advocating for any.\nSynthesis: evaluate against recognition, exclusivity, deliverability.\nAddress how to handle groups that reach consensus too quickly.\n400 words maximum.\nStart immediately. No heading.`,
      userMessage: `Brand: ${brand}\nAll propositions: ${slice(session.stage_8_output, 2000)}\nSelected: "${smp}"`,
    },
    {
      name: "session_four",
      maxTokens: 700,
      systemPrompt: `\nYou are a senior strategy facilitator writing a workshop guide for ${brand}.\nWrite Session Four — The Proposition Reveal — 30 minutes.\nThe specific physical setup.\nThe exact words to say.\nThe silence to hold and how long.\nHow to collect reactions without moderating them.\nFour tests to run with the room.\nHow to handle defensive, excited, and confused responses specifically.\n350 words maximum.\nStart immediately. No heading.`,
      userMessage: `Brand: ${brand}\nSelected proposition: "${smp}"\nCategory: ${category}`,
    },
    {
      name: "session_five",
      maxTokens: 700,
      systemPrompt: `\nYou are a senior strategy facilitator writing a workshop guide for ${brand}.\nWrite Session Five — Making It Real — 45 minutes.\nChannel application activity — groups take specific channels and translate the strategy into specific changes in how they work.\nIndividual commitment activity — specific enough to be observable.\nFacilitator closing — significance not summary.\n350 words maximum.\nStart immediately. No heading.`,
      userMessage: `Brand: ${brand}\nSelected proposition: "${smp}"\nBrand world: ${slice(session.stage_14c_output, 1000)}`,
    },
    {
      name: "appendix_cards",
      maxTokens: 500,
      systemPrompt: `\nYou are a senior strategy facilitator writing a workshop guide for ${brand}.\nWrite five participant reference cards.\n150 words maximum each.\nCard 1: The Situation\nCard 2: The Human Truth\nCard 3: The Proposition — with 2-3 sentences on what it means\nCard 4: What This Requires\nCard 5: My Commitment — leave blank for participant\nStart immediately. No heading.`,
      userMessage: `Brand: ${brand}\nCategory: ${category}\nSelected proposition: "${smp}"`,
    },
    {
      name: "difficult_moments",
      maxTokens: 600,
      systemPrompt: `\nYou are a senior strategy facilitator writing a workshop guide for ${brand}.\nWrite the six difficult moments guide.\nFor each: name it precisely, the specific facilitator response, what to do if it does not work.\nAll six must be specific to this strategy and brand — not generic facilitation advice.\n300 words maximum.\nStart immediately. No heading.`,
      userMessage: `Brand: ${brand}\nCategory: ${category}\nSelected proposition: "${smp}"`,
    },
  ];
}

// ---------- HTML assembly ----------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmt(text: string): string {
  // Escape first, then re-apply bold/italic markers.
  let s = escapeHtml(text);
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  return s;
}

function md(text: string | undefined): string {
  if (!text) return "";
  const lines = text.split("\n");
  const out: string[] = [];
  let inUl = false;

  const closeUl = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      closeUl();
      continue;
    }

    if (line.startsWith("> ")) {
      closeUl();
      out.push(`<blockquote>${fmt(line.replace(/^>\s+/, ""))}</blockquote>`);
      continue;
    }
    if (/^###\s+/.test(line)) {
      closeUl();
      out.push(`<h3>${fmt(line.replace(/^###\s+/, ""))}</h3>`);
      continue;
    }
    if (/^##\s+/.test(line)) {
      // ## inside section content → h3 (section title h2 is added by assembly)
      closeUl();
      out.push(`<h3>${fmt(line.replace(/^##\s+/, ""))}</h3>`);
      continue;
    }
    if (/^[-—]\s+/.test(line)) {
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${fmt(line.replace(/^[-—]\s+/, ""))}</li>`);
      continue;
    }
    if (/^[*\-_]{3,}$/.test(line)) {
      closeUl();
      out.push("<hr>");
      continue;
    }
    closeUl();
    out.push(`<p>${fmt(line)}</p>`);
  }
  closeUl();
  return out.join("\n");
}

function section(part: string, title: string, html: string, timeLabel?: string): string {
  return `<div class="section">
  <div class="part-label">${escapeHtml(part)}</div>
  <h2>${escapeHtml(title)}</h2>${
    timeLabel ? `\n  <div class="session-time">${escapeHtml(timeLabel)}</div>` : ""
  }
  ${html}
</div>`;
}

function propReveal(smp: string): string {
  return `<div class="prop-reveal">
  <div class="prop-text">${escapeHtml(smp)}</div>
  <div class="prop-rule"></div>
</div>`;
}

export function sanitiseText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\u2014/g, "—")
    .replace(/\u2013/g, "–")
    .replace(/\u201C/g, '"')
    .replace(/\u201D/g, '"')
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u2026/g, "...");
}

export function buildHtmlDocument(
  rawSections: Record<string, string>,
  session: SessionLike,
  format: DocFormat,
): string {
  // Sanitise every section's text before it reaches md()
  const sections: Record<string, string> = {};
  for (const k of Object.keys(rawSections)) sections[k] = sanitiseText(rawSections[k] ?? "");

  const labels: Record<DocFormat, string> = {
    consulting: "BOARD STRATEGY RECOMMENDATION",
    agency: "AGENCY STRATEGY PLATFORM",
    workshop: "BRAND STRATEGY WORKSHOP GUIDE",
  };
  const label = labels[format];
  const brand = session.brand_name ?? "Untitled Brand";
  const smp = sanitiseText(session.selected_smp ?? "");
  const date = new Date().toLocaleDateString("en-AU", { month: "long", year: "numeric" });


  let body = "";

  if (format === "consulting") {
    body =
      section("PART ONE", "The Situation", md(sections.situation)) +
      section("PART TWO", "What the Category Has Agreed Not to Say", md(sections.category)) +
      section("PART THREE", "The People the Category Is Failing", md(sections.human_truth)) +
      section("PART FOUR", "Why This Brand", md(sections.why_brand)) +
      section("PART FIVE", "What Was Tested and Set Aside", md(sections.alternatives)) +
      section("PART SIX", "The Evidence", md(sections.evidence)) +
      section("PART SEVEN", "The Recommendation", md(sections.recommendation_pre)) +
      propReveal(smp) +
      `<div class="section">${md(sections.recommendation_post)}</div>` +
      section("PART EIGHT", "The Creative World", md(sections.creative_world)) +
      section("PART NINE", "What Must Change", md(sections.what_must_change)) +
      section("PART TEN", "Next Steps", md(sections.next_steps));
  } else if (format === "agency") {
    body =
      section("", "Before You Read This", md(sections.before_you_read)) +
      section("PART ONE", "The Strategic Context", md(sections.strategic_context)) +
      section("PART TWO", "The Category", md(sections.category)) +
      section("PART THREE", "The Human Truth", md(sections.human_truth)) +
      section("PART FOUR", "Why This Brand", md(sections.why_brand)) +
      section("PART FIVE", "What Was Set Aside", md(sections.alternatives)) +
      section("PART SIX", "The Strategic Proposition", md(sections.proposition_pre)) +
      propReveal(smp) +
      `<div class="section">${md(sections.proposition_post)}</div>` +
      section("PART SEVEN", "The Creative World", md(sections.creative_world)) +
      section("PART EIGHT", "How the Strategy Behaves Across Channels", md(sections.channels)) +
      section("PART NINE", "The Brief to Creative Teams", md(sections.brief_to_teams));
  } else {
    body =
      section("", "For the Facilitator", md(sections.facilitator_intro)) +
      section("", "Preparation", md(sections.preparation)) +
      section("SESSION ONE", "The World We Operate In", md(sections.session_one), "45 Minutes") +
      section("SESSION TWO", "The People We Are Failing to Serve", md(sections.session_two), "45 Minutes") +
      section("SESSION THREE", "What Is Available to Own", md(sections.session_three), "45 Minutes") +
      section("SESSION FOUR", "The Strategic Proposition", md(sections.session_four), "30 Minutes") +
      propReveal(smp) +
      section("SESSION FIVE", "Making It Real", md(sections.session_five), "45 Minutes") +
      section("APPENDIX A", "Participant Reference Cards", md(sections.appendix_cards)) +
      section("APPENDIX B", "Facilitator Guide to Difficult Moments", md(sections.difficult_moments));
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(label)} — ${escapeHtml(brand)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
@page { size: A4; margin: 20mm 22mm 20mm 22mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: #f4f1ec; }
body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10.5pt;
  line-height: 1.8;
  color: #1a1a18;
  padding: 64px 0 64px;
}
.page {
  max-width: 760px;
  margin: 0 auto;
  background: white;
  padding: 56pt 56pt 56pt;
  box-shadow: 0 6px 24px rgba(0,0,0,0.08);
}
#toolbar {
  position: fixed; top: 0; left: 0; right: 0;
  background: #1a1a18;
  padding: 10px 24px;
  display: flex; justify-content: space-between; align-items: center;
  z-index: 999;
}
#toolbar span { color: #8a8680; font-size: 12px; }
#toolbar .actions button {
  background: #D4924A; color: #000; border: none;
  padding: 8px 20px; border-radius: 4px;
  font-size: 13px; font-weight: bold; cursor: pointer; margin-left: 8px;
}
#toolbar .actions button.close {
  background: transparent; color: #aaa; border: 1px solid #444;
}
@media print {
  #toolbar { display: none; }
  body { padding: 0; background: white; }
  .page { box-shadow: none; max-width: none; padding: 0; }
  .section { page-break-inside: avoid; }
  h2 { page-break-after: avoid; }
  .prop-reveal { page-break-before: always; page-break-after: always; }
  .cover { page-break-after: always; }
}
.cover {
  min-height: 80vh;
  display: flex; flex-direction: column; justify-content: center;
  padding: 40pt 0;
  border-bottom: 2pt solid #D4924A;
  margin-bottom: 32pt;
}
.cover-brand {
  font-size: 11pt; font-weight: bold; letter-spacing: 0.1em;
  color: #1a1a18; margin-bottom: 8pt;
}
.cover-label {
  font-size: 9pt; font-weight: bold; letter-spacing: 0.12em;
  color: #D4924A; text-transform: uppercase; margin-bottom: 24pt;
}
.cover-title {
  font-size: 22pt; font-weight: 700; color: #1a1a18;
  line-height: 1.2; margin-bottom: 24pt;
}
.cover-rule { width: 40pt; height: 2pt; background: #D4924A; margin-bottom: 20pt; }
.cover-date { font-size: 9pt; color: #666; }
.cover-confidential { font-size: 8pt; color: #999; margin-top: 8pt; letter-spacing: 0.06em; }
.section { margin-bottom: 32pt; padding-top: 8pt; }
.part-label {
  font-size: 8pt; font-weight: bold; letter-spacing: 0.12em;
  color: #D4924A; text-transform: uppercase; margin-bottom: 6pt;
}
.session-time { font-size: 9pt; color: #999; margin-bottom: 12pt; font-style: italic; }
h2 {
  font-size: 14pt; font-weight: bold; color: #1a1a18;
  margin-bottom: 12pt; padding-left: 10pt;
  border-left: 3pt solid #D4924A; line-height: 1.3;
}
h3 {
  font-size: 11pt; font-weight: bold; color: #1a1a18;
  margin-top: 16pt; margin-bottom: 8pt;
}
p { margin-bottom: 10pt; orphans: 3; widows: 3; }
blockquote {
  border-left: 3pt solid #D4924A;
  padding: 8pt 12pt; margin: 14pt 0;
  background: #f9f9f7; font-style: italic;
  font-size: 11pt; line-height: 1.65;
}
ul { margin: 10pt 0; padding: 0; list-style: none; }
li { padding-left: 14pt; position: relative; margin-bottom: 5pt; }
li::before { content: '—'; position: absolute; left: 0; color: #D4924A; }
hr { border: none; border-top: 0.5pt solid #ddd; margin: 16pt 0; }
strong { font-weight: bold; }
em { font-style: italic; }
.prop-reveal {
  text-align: center; padding: 80pt 20pt;
  border-top: 2pt solid #D4924A; border-bottom: 2pt solid #D4924A;
  margin: 40pt 0;
}
.prop-text {
  font-size: 24pt; font-weight: bold; color: #1a1a18;
  line-height: 1.3; max-width: 400pt; margin: 0 auto;
}
.prop-rule { width: 40pt; height: 2pt; background: #D4924A; margin: 20pt auto 0; }
.footer {
  margin-top: 40pt; padding-top: 16pt;
  border-top: 0.5pt solid #ddd;
  font-size: 8pt; color: #999; text-align: center;
}
</style>
</head>
<body>
<div id="toolbar">
  <span>${escapeHtml(label)} — ${escapeHtml(brand)}</span>
  <div class="actions">
    <button onclick="window.print()">Save as PDF</button>
    <button class="close" onclick="window.close()">Close</button>
  </div>
</div>
<div class="page">
  <div class="cover">
    <div class="cover-brand">BRAND GRENADE</div>
    <div class="cover-label">${escapeHtml(label)}</div>
    <div class="cover-title">${escapeHtml(brand)}</div>
    <div class="cover-rule"></div>
    <div class="cover-date">${escapeHtml(date)}</div>
    <div class="cover-confidential">CONFIDENTIAL</div>
  </div>
  ${body}
  <div class="footer">Brand Grenade Strategy Intelligence System — Confidential</div>
</div>
<script>
setTimeout(function () { try { window.print(); } catch (e) {} }, 500);
</script>
</body>
</html>`;
}
