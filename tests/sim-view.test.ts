import { describe, it, expect } from 'vitest';
import policiesJson from '../src/data/policies.json';
import { simulate } from '../src/lib/simulate';
import type { RejectedPolicy, ScoredPolicy } from '../src/lib/simulate';
import { discretionaryBudgetOku, getAkita } from '../src/lib/fiscal';
import { AXES, DEFAULT_WEIGHTS, PRESETS } from '../src/lib/constants';
import type { Policy, PrefectureFiscal, Weights } from '../src/lib/types';
import {
  REJECTION_REASON_TEXT,
  budgetShiftRows,
  budgetUsagePercent,
  buildStatement,
  effectRows,
  expenseByPurposeOku,
  formatOku,
  formatSigned,
  horizonGroups,
  matchingPresetId,
  perCapitaYenToOku,
  rejectionReasonText,
  topAxes,
  topRejected,
} from '../src/lib/sim-view';

const POLICIES = policiesJson as Policy[];
const akita = getAkita();
const budgetOku = discretionaryBudgetOku(akita);

function policy(id: string, over: Partial<Policy> = {}): Policy {
  return {
    id,
    name: `施策 ${id}`,
    summary: '',
    costOku: 1,
    expenseCategory: '総務費',
    scores: { population: 1, economy: 1, fiscal: 1, quality: 1, durability: 1 },
    rationale: '',
    sideEffects: [],
    evidence: [],
    horizon: 'short',
    ...over,
  };
}

function scored(p: Policy): ScoredPolicy {
  return { policy: p, score: 1 };
}

describe('却下理由 → 画面文言', () => {
  it('エンジンが返す 3 種類の理由すべてに文言がある', () => {
    expect(rejectionReasonText('score')).toBe('この価値観では優先度が立たない');
    expect(rejectionReasonText('exclusive')).toBe('同じ目的でより優先度の高い施策を選んだため');
    expect(rejectionReasonText('budget')).toBe('裁量枠を使い切ったため');
    expect(Object.keys(REJECTION_REASON_TEXT).sort()).toEqual(['budget', 'exclusive', 'score']);
  });

  it('実際のシミュレーション結果に出るすべての理由が文言化できる', () => {
    const result = simulate(DEFAULT_WEIGHTS, POLICIES, budgetOku);
    for (const item of result.rejected) {
      expect(rejectionReasonText(item.reason)).toBeTruthy();
    }
  });

  it('topRejected はエンジンの並び順を変えずに先頭から切り出す', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(
      (id): RejectedPolicy => ({ policy: policy(id), score: 1, reason: 'budget' }),
    );
    const top = topRejected(items);
    expect(top).toHaveLength(6);
    expect(top.map((t) => t.policy.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(topRejected(items.slice(0, 3)).map((t) => t.policy.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('人口1人当たり円 → 億円の換算', () => {
  it('1人当たり円 × 人口 ÷ 1億 で計算する', () => {
    expect(perCapitaYenToOku(10_000, 1_000_000)).toBeCloseTo(100, 10);
    expect(perCapitaYenToOku(0, 924_620)).toBe(0);
  });

  it('秋田県の民生費が既知の値になる', () => {
    // 89,286 円/人 × 924,620 人 ÷ 1億 = 825.55…億円
    const rows = expenseByPurposeOku(akita);
    const minsei = rows.find((r) => r.category === '民生費');
    expect(minsei).toBeDefined();
    expect(minsei!.oku).toBeCloseTo(825.55, 1);
  });

  it('目的別歳出の合計が歳出総額とほぼ一致する', () => {
    // 出典データの 1 人当たり円は整数に丸められているため、区分ごとの丸め差が
    // 人口分だけ拡大する（1 円/人 の差 = 約 0.009 億円）。0.1 億円の許容で照合する。
    const sum = expenseByPurposeOku(akita).reduce((acc, r) => acc + r.oku, 0);
    expect(sum).toBeCloseTo((akita.expenseTotal * akita.population) / 100_000_000, 1);
  });

  it('0 円の区分は落とし、降順に並べる', () => {
    const rows = expenseByPurposeOku(akita);
    expect(rows.every((r) => r.oku > 0)).toBe(true);
    expect(rows.map((r) => r.category)).not.toContain('消防費');
    expect(rows.map((r) => r.category)).not.toContain('公営企業費');
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].oku).toBeGreaterThanOrEqual(rows[i].oku);
    }
  });
});

describe('歳出の組み替え行', () => {
  const fake: PrefectureFiscal = {
    ...akita,
    population: 1_000_000,
    expenseByPurpose: { 民生費: 10_000, 教育費: 5_000, 消防費: 0 },
  };

  it('現状に採択コストを上乗せする', () => {
    const rows = budgetShiftRows(fake, { 民生費: 20 });
    const minsei = rows.find((r) => r.category === '民生費')!;
    expect(minsei.currentOku).toBeCloseTo(100, 10);
    expect(minsei.addedOku).toBe(20);
    expect(minsei.afterOku).toBeCloseTo(120, 10);
  });

  it('上乗せがない区分は現状と同じ値になる', () => {
    const rows = budgetShiftRows(fake, { 民生費: 20 });
    const kyoiku = rows.find((r) => r.category === '教育費')!;
    expect(kyoiku.addedOku).toBe(0);
    expect(kyoiku.afterOku).toBeCloseTo(kyoiku.currentOku, 10);
  });

  it('0 円の区分は落とすが、採択コストがある区分は残す', () => {
    const rows = budgetShiftRows(fake, { 商工費: 7 });
    expect(rows.map((r) => r.category)).not.toContain('消防費');
    const shoko = rows.find((r) => r.category === '商工費')!;
    expect(shoko.currentOku).toBe(0);
    expect(shoko.afterOku).toBe(7);
  });

  it('上乗せは常に 0 以上（コスト削減施策でも枠は戻らない）', () => {
    for (const preset of PRESETS) {
      const result = simulate(preset.weights, POLICIES, budgetOku);
      const rows = budgetShiftRows(akita, result.costByCategory);
      expect(rows.every((r) => r.addedOku >= 0)).toBe(true);
      expect(rows.every((r) => r.afterOku >= r.currentOku)).toBe(true);
    }
  });
});

describe('裁量枠の使用率', () => {
  it('割合を % で返す', () => {
    expect(budgetUsagePercent(100, 200)).toBe(50);
    expect(budgetUsagePercent(0, 200)).toBe(0);
  });

  it('枠が 0 以下なら 0 を返す（0 除算を作らない）', () => {
    expect(budgetUsagePercent(10, 0)).toBe(0);
    expect(budgetUsagePercent(10, -5)).toBe(0);
  });

  it('どのプリセットでも 100% を超えない', () => {
    for (const preset of PRESETS) {
      const result = simulate(preset.weights, POLICIES, budgetOku);
      expect(budgetUsagePercent(result.totalCostOku, budgetOku)).toBeLessThanOrEqual(100);
    }
  });
});

describe('最上位の軸', () => {
  it('重みが最大の軸を返す', () => {
    const w: Weights = { population: 10, economy: 90, fiscal: 20, quality: 30, durability: 40 };
    expect(topAxes(w).map((a) => a.key)).toEqual(['economy']);
  });

  it('同点なら AXES の並び順ですべて返す', () => {
    const w: Weights = { population: 90, economy: 90, fiscal: 20, quality: 30, durability: 40 };
    expect(topAxes(w).map((a) => a.key)).toEqual(['population', 'economy']);
    expect(topAxes(DEFAULT_WEIGHTS).map((a) => a.key)).toEqual(AXES.map((a) => a.key));
  });
});

describe('horizon ごとの分類', () => {
  const adopted = [
    scored(policy('a', { horizon: 'long', name: '長期A' })),
    scored(policy('b', { horizon: 'short', name: '短期B' })),
    scored(policy('c', { horizon: 'short', name: '短期C' })),
  ];

  it('短期・中期・長期の順に並べ、空のグループは返さない', () => {
    const groups = horizonGroups(adopted);
    expect(groups.map((g) => g.label)).toEqual(['短期', '長期']);
    expect(groups[0].names).toEqual(['短期B', '短期C']);
  });

  it('採択なしなら空配列', () => {
    expect(horizonGroups([])).toEqual([]);
  });
});

describe('施政方針文', () => {
  it('最上位の軸と件数を含む', () => {
    const w: Weights = { population: 10, economy: 90, fiscal: 20, quality: 30, durability: 40 };
    const statement = buildStatement(w, [scored(policy('a')), scored(policy('b'))]);
    expect(statement.lead).toBe(
      'この価値観のもとでは、経済成長を最上位に置き、2件の施策を選びました。',
    );
  });

  it('同率首位のときは同率と書く', () => {
    const statement = buildStatement(DEFAULT_WEIGHTS, [scored(policy('a'))]);
    expect(statement.lead).toContain('同率で最上位');
    expect(statement.lead).toContain('1件');
  });

  it('採択が 0 件なら別の文になる', () => {
    const statement = buildStatement(DEFAULT_WEIGHTS, []);
    expect(statement.lead).toContain('採択できる施策がありませんでした');
    expect(statement.groups).toEqual([]);
  });

  it('効果を断定する語を含めない', () => {
    for (const preset of PRESETS) {
      const result = simulate(preset.weights, POLICIES, budgetOku);
      const statement = buildStatement(preset.weights, result.adopted);
      for (const word of ['予測', '改善します', '増加します', '達成します', '見込まれます']) {
        expect(statement.lead).not.toContain(word);
      }
    }
  });
});

describe('プリセットとの一致判定', () => {
  it('完全一致するプリセットの id を返す', () => {
    for (const preset of PRESETS) {
      expect(matchingPresetId(preset.weights)).toBe(preset.id);
    }
  });

  it('1 軸でも違えば null', () => {
    const base = PRESETS[0].weights;
    expect(matchingPresetId({ ...base, quality: base.quality === 0 ? 5 : base.quality - 5 })).toBe(
      null,
    );
  });
});

describe('効果の行と数値の書式', () => {
  it('AXES の並び順で 5 軸すべてを返す', () => {
    const result = simulate(DEFAULT_WEIGHTS, POLICIES, budgetOku);
    const rows = effectRows(result.effects);
    expect(rows.map((r) => r.key)).toEqual(AXES.map((a) => a.key));
    expect(rows.map((r) => r.label)).toEqual(AXES.map((a) => a.label));
  });

  it('億円は小数第1位まで、整数なら小数を出さない', () => {
    expect(formatOku(285.84)).toBe('285.8');
    expect(formatOku(42)).toBe('42');
    expect(formatOku(1234.56)).toBe('1,234.6');
  });

  it('符号つきの表示は 0 に符号を付けない', () => {
    expect(formatSigned(12)).toBe('+12');
    expect(formatSigned(-12)).toBe('-12');
    expect(formatSigned(0)).toBe('0');
  });
});
