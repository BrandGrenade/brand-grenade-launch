import { describe, it, expect } from 'vitest';
import { uniqueClaims } from './unique-claims';

describe('Room 00 exact-claim deduplication', () => {
  it('serves 215 claims from 329 category rows without deleting or losing their evidence', () => {
    const original = Array.from({ length: 215 }, (_, i) => ({ claim_text: `Claim ${i}`, heading: 'Research', label: 'verified', source: 'report', position: i + 1 }));
    const rows = [...original, ...original.slice(0, 114).map(r => ({ ...r, heading: 'Brand health' }))];
    const served = uniqueClaims(rows);
    expect(rows).toHaveLength(329);
    expect(served).toHaveLength(215);
    expect(served.reduce((n, r) => n + r.occurrences.length, 0)).toBe(329);
    expect(served[0].headings).toEqual(['Research', 'Brand health']);
  });
  it('never merges different wording or discards conflicting evidence labels/sources', () => {
    const rows = [{ claim_text: 'A', heading: 'H1', label: 'verified', source: 'one' }, { claim_text: 'A', heading: 'H2', label: 'contradicted', source: 'two' }, { claim_text: 'A.', heading: 'H1' }];
    const served = uniqueClaims(rows);
    expect(served).toHaveLength(2);
    expect(served[0].occurrences).toMatchObject([{ label: 'verified', source: 'one' }, { label: 'contradicted', source: 'two' }]);
  });
});