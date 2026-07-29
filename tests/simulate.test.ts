import { describe, it, expect } from 'vitest';
import { simulate } from '../src/lib/simulate';
import type { Policy, Weights } from '../src/lib/types';

const W = (over: Partial<Weights> = {}): Weights => ({
  population: 0, economy: 0, fiscal: 0, quality: 0, durability: 0, ...over,
});

const card = (over: Partial<Policy> & { id: string }): Policy => ({
  name: over.id,
  summary: '',
  costOku: 10,
  expenseCategory: '民生費',
  scores: { population: 0, economy: 0, fiscal: 0, quality: 0, durability: 0 },
  rationale: '',
  sideEffects: ['x'],
  evidence: [{ label: 'l', url: 'https://example.gov' }],
  horizon: 'short',
  ...over,
});

describe('simulate', () => {
  it('ranks cards by weighted score and adopts the best first', () => {
    const policies = [
      card({ id: 'low', scores: { population: 1, economy: 0, fiscal: 0, quality: 0, durability: 0 } }),
      card({ id: 'high', scores: { population: 9, economy: 0, fiscal: 0, quality: 0, durability: 0 } }),
    ];
    const r = simulate(W({ population: 100 }), policies, 10);
    expect(r.adopted.map((a) => a.policy.id)).toEqual(['high']);
    expect(r.rejected.map((a) => a.policy.id)).toEqual(['low']);
  });

  it('is deterministic: identical input yields identical output', () => {
    const policies = [
      card({ id: 'a', scores: { population: 5, economy: 3, fiscal: 0, quality: 0, durability: 0 } }),
      card({ id: 'b', scores: { population: 3, economy: 5, fiscal: 0, quality: 0, durability: 0 } }),
    ];
    const w = W({ population: 70, economy: 30 });
    expect(simulate(w, policies, 100)).toEqual(simulate(w, policies, 100));
  });

  it('never exceeds the discretionary budget', () => {
    const policies = [
      card({ id: 'a', costOku: 60, scores: { population: 9, economy: 0, fiscal: 0, quality: 0, durability: 0 } }),
      card({ id: 'b', costOku: 60, scores: { population: 8, economy: 0, fiscal: 0, quality: 0, durability: 0 } }),
      card({ id: 'c', costOku: 60, scores: { population: 7, economy: 0, fiscal: 0, quality: 0, durability: 0 } }),
    ];
    const r = simulate(W({ population: 100 }), policies, 100);
    expect(r.totalCostOku).toBeLessThanOrEqual(100);
    expect(r.adopted).toHaveLength(1);
  });

  it('adopts at most one card per exclusive group', () => {
    const policies = [
      card({ id: 'strong', exclusiveGroup: 'g', costOku: 5, scores: { population: 9, economy: 0, fiscal: 0, quality: 0, durability: 0 } }),
      card({ id: 'weak', exclusiveGroup: 'g', costOku: 5, scores: { population: 4, economy: 0, fiscal: 0, quality: 0, durability: 0 } }),
    ];
    const r = simulate(W({ population: 100 }), policies, 1000);
    expect(r.adopted.map((a) => a.policy.id)).toEqual(['strong']);
    expect(r.rejected.map((a) => a.policy.id)).toEqual(['weak']);
  });

  it('lets a lower-weighted axis flip which card in a group wins', () => {
    const policies = [
      card({ id: 'expensive', exclusiveGroup: 'g', costOku: 40, scores: { population: 8, economy: 0, fiscal: -8, quality: 0, durability: 0 } }),
      card({ id: 'cheap', exclusiveGroup: 'g', costOku: 8, scores: { population: 4, economy: 0, fiscal: 2, quality: 0, durability: 0 } }),
    ];
    expect(simulate(W({ population: 100 }), policies, 1000).adopted[0].policy.id).toBe('expensive');
    expect(simulate(W({ population: 30, fiscal: 100 }), policies, 1000).adopted[0].policy.id).toBe('cheap');
  });

  it('sums the effect vector across adopted cards', () => {
    const policies = [
      card({ id: 'a', costOku: 5, scores: { population: 4, economy: 2, fiscal: -3, quality: 1, durability: 0 } }),
      card({ id: 'b', costOku: 5, scores: { population: 2, economy: 3, fiscal: -1, quality: 0, durability: 2 } }),
    ];
    const r = simulate(W({ population: 50, economy: 50 }), policies, 1000);
    expect(r.effects.population).toBe(6);
    expect(r.effects.economy).toBe(5);
    expect(r.effects.fiscal).toBe(-4);
  });

  it('aggregates adopted cost per expense category', () => {
    const policies = [
      card({ id: 'a', costOku: 12, expenseCategory: '民生費', scores: { population: 9, economy: 0, fiscal: 0, quality: 0, durability: 0 } }),
      card({ id: 'b', costOku: 8, expenseCategory: '民生費', scores: { population: 8, economy: 0, fiscal: 0, quality: 0, durability: 0 } }),
      card({ id: 'c', costOku: 5, expenseCategory: '教育費', scores: { population: 7, economy: 0, fiscal: 0, quality: 0, durability: 0 } }),
    ];
    const r = simulate(W({ population: 100 }), policies, 1000);
    expect(r.costByCategory).toEqual({ 民生費: 20, 教育費: 5 });
  });

  it('breaks score ties by id so ordering is stable', () => {
    const policies = [
      card({ id: 'b', scores: { population: 5, economy: 0, fiscal: 0, quality: 0, durability: 0 } }),
      card({ id: 'a', scores: { population: 5, economy: 0, fiscal: 0, quality: 0, durability: 0 } }),
    ];
    const r = simulate(W({ population: 100 }), policies, 1000);
    expect(r.adopted.map((x) => x.policy.id)).toEqual(['a', 'b']);
  });

  it('returns an empty package when every weight is zero and no card scores', () => {
    const policies = [card({ id: 'a', scores: { population: 0, economy: 0, fiscal: 0, quality: 0, durability: 0 } })];
    const r = simulate(W(), policies, 1000);
    expect(r.adopted).toHaveLength(0);
    expect(r.totalCostOku).toBe(0);
  });
});
