'use client';

import { useMemo, useState } from 'react';
import policiesJson from '@/data/policies.json';
import { AxisSliders } from '@/components/sim/AxisSliders';
import { PresetButtons } from '@/components/sim/PresetButtons';
import { ResultPanel } from '@/components/sim/ResultPanel';
import { DEFAULT_WEIGHTS } from '@/lib/constants';
import { discretionaryBudgetOku, getAkita, totalExpenseOku } from '@/lib/fiscal';
import { simulate } from '@/lib/simulate';
import type { AxisKey, Policy, Weights } from '@/lib/types';

const POLICIES = policiesJson as Policy[];

export default function Page() {
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);

  const akita = getAkita();
  const expenseOku = useMemo(() => totalExpenseOku(akita), [akita]);
  const budgetOku = useMemo(() => discretionaryBudgetOku(akita), [akita]);
  const result = useMemo(() => simulate(weights, POLICIES, budgetOku), [weights, budgetOku]);

  const setAxis = (key: AxisKey, value: number) =>
    setWeights((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="viz-root">
      <h1 className="text-2xl font-bold">価値観から施策パッケージを組み立てる</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        5 つの軸の重みを動かすと、{POLICIES.length} 枚の施策カードから、単年度の裁量枠に収まる
        組み合わせが機械的に選ばれます。計算はすべてブラウザ内で完結する決定論的なもので、
        同じ入力からは常に同じ結果になります。カードのスコアと想定コストは本モデルの仮定値です。
      </p>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-8">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <section aria-labelledby="preset-heading">
            <h2 id="preset-heading" className="text-lg font-semibold">
              代表的な価値観から選ぶ
            </h2>
            <div className="mt-3">
              <PresetButtons weights={weights} onSelect={setWeights} />
            </div>
          </section>

          <section aria-labelledby="slider-heading" className="mt-8">
            <h2 id="slider-heading" className="text-lg font-semibold">
              価値観の重み
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              0 から 100 まで 5 刻みで動かせます。
            </p>
            <div className="mt-3">
              <AxisSliders weights={weights} onChange={setAxis} />
            </div>
          </section>
        </div>

        <ResultPanel
          weights={weights}
          result={result}
          budgetOku={budgetOku}
          totalExpenseOku={expenseOku}
          prefecture={akita}
        />
      </div>
    </div>
  );
}
