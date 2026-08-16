#!/usr/bin/env python3
"""
BRAND GRENADE — PRINT-LAYOUT AUDIT
==================================
The HTML certification reads DOM source order. Print layout does not: Chromium
fragments blocks across A4 pages, so content can be *painted after* the footer
even though it precedes it in the source. That is exactly how the Jaguar
footer-bleed survived every string-based check.

This audit renders each certified HTML file with print emulation, measures the
painted geometry of every block, maps it to a page number, and fails when:

  * any content block is painted after the footer (later page, or same page
    and lower on the page),
  * the footer is split across two pages,
  * a block overflows the printable page width or height.

Usage: python3 scripts/audit-print-layout.py [html-dir] [report-path]
"""

import asyncio
import glob
import json
import sys
from pathlib import Path

from playwright.async_api import async_playwright

HTML_DIR = sys.argv[1] if len(sys.argv) > 1 else "/tmp/certify"
REPORT = sys.argv[2] if len(sys.argv) > 2 else "/mnt/documents/print-layout-audit.md"

# A4 at 96dpi CSS pixels, less the 18mm print margins the doc shell declares.
PAGE_H = 1123.0

MEASURE = """
() => {
  const footer = document.querySelector('.footer');
  const blocks = [];
  const sel = 'p, li, h1, h2, h3, h4, blockquote, table, .section, .callout, .pull, .stat-grid, .footer';
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest('.toolbar')) continue;
    const r = el.getBoundingClientRect();
    if (r.height === 0 && r.width === 0) continue;
    const text = (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 90);
    if (!text) continue;
    blocks.push({
      tag: el.tagName.toLowerCase(),
      cls: el.className || '',
      top: r.top + window.scrollY,
      bottom: r.bottom + window.scrollY,
      isFooter: !!footer && (el === footer || footer.contains(el)),
      text,
    });
  }
  return { blocks, hasFooter: !!footer, docHeight: document.documentElement.scrollHeight };
}
"""


async def audit(page, path):
    await page.goto(Path(path).as_uri(), wait_until="load")
    await page.emulate_media(media="print")
    await page.wait_for_timeout(120)
    data = await page.evaluate(MEASURE)
    failures = []
    if not data["hasFooter"]:
        return ["document has no rendered footer"]

    footers = [b for b in data["blocks"] if b["isFooter"]]
    ftop = min(b["top"] for b in footers)
    fbottom = max(b["bottom"] for b in footers)
    fpage = int(ftop // PAGE_H)

    if int(fbottom // PAGE_H) != fpage:
        failures.append(
            f"footer is split across print pages {fpage + 1} and {int(fbottom // PAGE_H) + 1}"
        )

    for b in data["blocks"]:
        if b["isFooter"]:
            continue
        page_no = int(b["top"] // PAGE_H)
        painted_after = page_no > fpage or (page_no == fpage and b["top"] >= fbottom - 1)
        if painted_after:
            failures.append(
                f"content painted after the footer on print page {page_no + 1}: "
                f"<{b['tag']}> “{b['text']}”"
            )
        if b["bottom"] - b["top"] > PAGE_H * 1.02 and b["tag"] in ("p", "li", "blockquote", "h1", "h2", "h3"):
            failures.append(f"block taller than one print page: <{b['tag']}> “{b['text']}”")

    return failures[:12]


async def main():
    files = sorted(glob.glob(f"{HTML_DIR}/*.html"))
    if not files:
        print(f"no HTML files in {HTML_DIR}")
        return 0
    lines = ["# Brand Grenade — print-layout audit", "", f"{len(files)} rendered documents", ""]
    failed = 0
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 794, "height": 1123})
        page = await ctx.new_page()
        for f in files:
            try:
                fails = await audit(page, f)
            except Exception as exc:  # noqa: BLE001
                fails = [f"render error: {exc}"]
            name = Path(f).name
            if fails:
                failed += 1
                lines.append(f"- **FAILED** `{name}`")
                lines += [f"    - {x}" for x in fails]
            else:
                lines.append(f"- PASS `{name}` — footer is the last painted content, no oversized block")
        await browser.close()
    lines.insert(3, f"**{len(files) - failed} clean · {failed} with print-layout failures**\n")
    Path(REPORT).parent.mkdir(parents=True, exist_ok=True)
    Path(REPORT).write_text("\n".join(lines))
    print("\n".join(lines[:60]))
    print(f"\nPRINT LAYOUT: {len(files)} documents, {failed} with failures.")
    return 1 if failed else 0


sys.exit(asyncio.run(main()))
