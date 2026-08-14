update public.sessions set stage_10_output =
  regexp_replace(
  regexp_replace(
  regexp_replace(
  regexp_replace(
  regexp_replace(
  regexp_replace(
    stage_10_output,
    '\*\*Competitive Impossibility:\*\* 5/10 — [^\n]*',
    '**Competitive Impossibility:** 6/10 — CORRECTED ON REVIEW (was 5/10). The original pass dismissed name-derived semantic ownership too flatly. "Stealth" is the literal behavioural trait of the animal Jaguar is named after, so the claim carries a partial lock no rival can replicate: Porsche, Tesla and Lucid can all claim quiet, low-signature capability as an engineering or aesthetic property, but none of them can make stealth read as the brand''s own nature — the name does the arguing. A rival adopting this line inherits the words without the semantic root, which is a fundamental weakness rather than a free ride. It remains reachable with repositioning, so it does not climb above 6, but it is "difficult but not impossible with repositioning", not "available with moderate effort". Note: the original 5/10 also rested partly on "stealth grey" as a colourway, which is disallowed occupancy evidence under the corrected standard. Meets the hard floor.',
    'g'),
    '\*\*Clean Air:\*\* 4/10 — [^\n]*',
    '**Clean Air:** 8/10 — RE-RUN UNDER CORRECTED ANCHORS (was 4/10). The corrected standard admits only genuine competing brand positioning claims, platforms, taglines or advertising expressions as occupancy evidence. On that test, no named competitor occupies stealth, restraint, withholding or predatory composure as a strategic identity: Tesla positions on technological inevitability and performance proof; Porsche on engineered performance heritage; Lucid on efficiency and range leadership; Rivian on adventure and utility; BMW on driving pleasure; Mercedes-Benz on luxury and "the best or nothing"; Audi on progressive technology; Polestar on design purity and sustainability transparency. None of these is a claim to concealment or withheld power. The 4/10 was scored entirely against generic word usage — "stealth grey" as a paint colourway, "stealth mode" as a technical product setting, aerospace/military vocabulary, and unattributed quiet-luxury trend adjacency — none of which are competitor claims. That was occupied vocabulary, not occupied territory, and is excluded. Score is 8 rather than 10 because quiet-luxury and understatement are a live directional drift in adjacent premium categories, which is weak and distant competitive presence, not occupancy.',
    'g'),
    '- ELIMINATED · weighted 50/100 · "Stealth\. By Design\."[^\n]*',
    '- PASS · weighted 55.5/100 · "Stealth. By Design." — FIELD: Stealth. By Design. — clears both hard floors after review correction',
    'g'),
    '\n    ⚠ CLEAN AIR: this territory has competitive presence — occupancy risk',
    '',
    'g'),
    'CODE VERDICT: ELIMINATED — Competitive Impossibility 5/10 below hard floor of 6\.',
    'CODE VERDICT: PASS — clears Stage 10 hard floors (Truth Strength 6 ≥ 5, Competitive Impossibility 6 ≥ 6) following human-reviewed correction of Competitive Impossibility and re-run of Clean Air under the named-competitor evidence standard.',
    'g'),
    'CODE COMPOSITE: 50/100 weighted',
    'CODE COMPOSITE: 55.5/100 weighted',
    'g')
where id = '6ab4ea96-7c3a-4e0a-91a9-24b601752b35';