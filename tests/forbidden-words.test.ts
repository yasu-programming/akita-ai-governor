import { describe, it, expect } from 'vitest';
import policies from '../src/data/policies.json';
import { FORBIDDEN_WORDS } from '../src/lib/forbidden-words';
import type { Policy } from '../src/lib/types';

const list = policies as Policy[];

function textOf(p: Policy): string {
  return [p.name, p.summary, p.rationale, ...p.sideEffects, ...p.evidence.map((e) => e.label)].join(
    ' ',
  );
}

describe('policy copy', () => {
  it('contains no forbidden political terms', () => {
    for (const p of list) {
      const text = textOf(p);
      for (const word of FORBIDDEN_WORDS) {
        expect(text.includes(word), `${p.id} contains "${word}"`).toBe(false);
      }
    }
  });

  it('never presents model output as a prediction', () => {
    for (const p of list) {
      expect(textOf(p).includes('と予測されます'), p.id).toBe(false);
    }
  });
});
