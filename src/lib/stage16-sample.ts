// Representative Stage 16 output used as PDF body content until the
// Complete page is wired to fetch the session's persisted stage_16_*_output.

import type { PdfFormat } from "./pdf-generator";

const COMMON = (brand: string, smp: string) => `# Strategic Platform Document

## Executive Summary

This document presents the strategic platform for ${brand}, the product of a sixteen-stage Brand Grenade pipeline run. The platform is anchored by a single, defensible proposition and is intended to direct brand, product, marketing, and creative decisions for the next twenty-four months.

> ${smp}

## The Strategic Proposition

The Single-Minded Proposition (SMP) above is the result of divergence testing across competitor positioning, category convention auditing, and pressure-testing under four distinct strategic stressors. It survived selection because it reframes the category rather than competing within its existing terms.

### Why This Proposition

The proposition opens a creative territory that is owned, ownable, and operationally executable. It maps cleanly to the brand's existing capability profile while leaving room for product expansion in adjacent jobs-to-be-done.

## Strategic Field

FIELD: Finance Stack Trust

The strategic field defines the conversation the brand intends to lead. ${brand} is not arguing about transfer speed, fees, or volume — the existing category currency. It is arguing about the closing of the books, a job no other rail has claimed.

## Creative Territory

The creative territory opened by this proposition is the rhythm of the financial month — opening, working, and closing. Communication should operate inside the felt experience of finance teams who live by that rhythm and are measured by the date they close.

### Tone Register

Composed. Specific. Quietly confident. Never breathless. Never tech-jargon-heavy. The voice of someone who knows the work because they have done the work.

### Behavioural Moments

Communication lands on the days that matter most to finance teams: the first business day of the month, mid-month close prep, and the final reconciliation push.

## Brand Universe

The brand universe is constructed from three coherent components: the visual world (the calendar and the close), the language world (terms drawn from controllership, not consumer payments), and the behavioural world (a brand that arrives quietly and leaves cleanly).

### Archetype

The Steward — a brand role rooted in custodianship of the financial record. The Steward is not the hero. The finance team is the hero. The Steward makes the hero's work possible.

## Implementation Notes

This platform is durable. It is built to withstand new category entrants, pricing pressure, and product line extensions without requiring strategic re-statement.
`;

const PITCH_TAIL = `
## Creative Brief Anchors

Below are the anchors agencies and creative partners can build from without re-litigating strategy.

### Single-Minded Message
The brand closes the books — that is the work that matters.

### Tonal Reference Points
Composed financial broadsheet, not consumer fintech. The visual language of controllership, not of disruption.

### Channel Priorities
1. Practitioner press and trade publications.
2. Conference presence at controller and CFO events.
3. Long-form content addressed to the finance team, not to engineering.
`;

const CONSULTING_TAIL = `
## Methodology

The strategy presented here is the output of a sixteen-stage process built on Brand Grenade's strategic methodology. Each stage produces an auditable artifact that informs the next. Three human checkpoints were confirmed during this run.

## Evidence Base

Insights were drawn from a synthesis of category intelligence, competitor positioning audit, customer-language analysis, and constraint-driven divergence testing.

### Validated Insights

The platform rests on three validated insights, each tested against falsification criteria during Stage 6 and pressure-tested again during Stage 11.

## Risks and Mitigations

The proposition's primary risk is competitor imitation. Mitigation lies in operational ownership: the brand must visibly deliver close-rate improvement, not merely claim it.
`;

const WORKSHOP_TAIL = `
## Session Guide

This document doubles as a facilitation guide for the brand alignment workshop. Each section below maps to a workshop block.

### Block One — Opening
Read the proposition aloud. Do not paraphrase. Ask each participant to write down one immediate reaction without discussion.

### Block Two — Field
Discuss what conversation the brand is now committed to leading. Identify what the brand is choosing not to argue about.

### Block Three — Territory
Walk through the creative territory. Surface internal references and reject those that do not match the tone register.

### Block Four — Commitments
Each functional lead names one decision they will make differently as a result of the platform.
`;

export function SAMPLE_STAGE_16(
  brand: string,
  smp: string,
  format: PdfFormat,
): string {
  const tail =
    format === "pitch"
      ? PITCH_TAIL
      : format === "consulting"
        ? CONSULTING_TAIL
        : WORKSHOP_TAIL;
  return COMMON(brand, smp) + tail;
}
