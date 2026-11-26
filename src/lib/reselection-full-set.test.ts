import { expect, it } from "vitest";
import { parseSMPCards } from "../components/SMPSelection";

const saved = 'SMP: "First saved proposition" — FIELD: Alpha\nSMP VERDICT: VALIDATED\n\nSMP: "Second saved proposition" — FIELD: Beta\nSMP VERDICT: ELIMINATED\n';

it("reselection exposes every saved core verdict, including eliminated candidates, without changing it", () => {
  const cards = parseSMPCards("", saved, undefined, true);
  expect(cards.map(c => [c.smpLine, c.pressureTestNote])).toEqual([
    ["First saved proposition", "VALIDATED"],
    ["Second saved proposition", "ELIMINATED"],
  ]);
});
it("ordinary first-time selection retains its existing surviving-core filter", () => {
  expect(parseSMPCards("", saved).map(c => c.smpLine)).toEqual(["First saved proposition"]);
});