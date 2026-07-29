'use client';

import type { SimulationResult } from '@/lib/simulate';
import {
  budgetUsagePercent,
  buildStatement,
  formatOku,
  rejectionReasonText,
  topRejected,
} from '@/lib/sim-view';
import type { PrefectureFiscal, Weights } from '@/lib/types';
import { BudgetShift } from './BudgetShift';
import { PolicyCard } from './PolicyCard';
import { TradeoffChart } from './TradeoffChart';

type Props = {
  weights: Weights;
  result: SimulationResult;
  budgetOku: number;
  totalExpenseOku: number;
  prefecture: PrefectureFiscal;
};

function StatTile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-xs text-neutral-600 dark:text-neutral-400">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-neutral-900 dark:text-neutral-100">
        {value}
        {unit ? (
          <span className="ml-1 text-sm font-normal text-neutral-600 dark:text-neutral-400">
            {unit}
          </span>
        ) : null}
      </p>
    </div>
  );
}

/**
 * 組み上がった施策パッケージの表示。
 * 却下理由は選定エンジンが返した reason をそのまま文言化する（画面側で再判定しない）。
 */
export function ResultPanel({
  weights,
  result,
  budgetOku,
  totalExpenseOku,
  prefecture,
}: Props) {
  const statement = buildStatement(weights, result.adopted);
  const usage = budgetUsagePercent(result.totalCostOku, budgetOku);
  const rejected = topRejected(result.rejected);

  return (
    <div className="viz-root space-y-10">
      {/* 1. 施政方針文 */}
      <section aria-labelledby="statement-heading">
        <h2 id="statement-heading" className="text-xl font-semibold">
          この価値観から組み上がった方針
        </h2>
        <div className="mt-3 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
          <p className="text-base leading-relaxed text-neutral-900 dark:text-neutral-100">
            {statement.lead}
          </p>
          {statement.groups.length > 0 ? (
            <dl className="mt-4 space-y-2 text-sm">
              {statement.groups.map((group) => (
                <div key={group.horizon} className="sm:flex sm:gap-3">
                  <dt className="shrink-0 font-medium text-neutral-600 dark:text-neutral-400">
                    {group.label}
                  </dt>
                  <dd className="text-neutral-800 dark:text-neutral-200">
                    {group.names.join('、')}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          <p className="mt-4 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
            この文は、入力された重みだけから機械的に組み立てた列挙です。効果を約束するものでも、
            将来を予測するものでもありません。
          </p>
        </div>
      </section>

      {/* 2. 採択された施策 */}
      <section aria-labelledby="adopted-heading">
        <h2 id="adopted-heading" className="text-xl font-semibold">
          採択された施策（{result.adopted.length}件）
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          歳出を抑える方向の施策にも、実施のための想定コストが正の値で計上されます。裁量枠が
          戻ることはありません。
        </p>
        {result.adopted.length === 0 ? (
          <p className="mt-3 rounded-lg border border-neutral-200 p-5 text-sm text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
            採択された施策はありません。いずれかの軸の重みを上げると、スコアが正になる施策が
            現れます。
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {result.adopted.map(({ policy }) => (
              <PolicyCard key={policy.id} policy={policy} />
            ))}
          </div>
        )}
      </section>

      {/* 3. 切られた施策 */}
      <section aria-labelledby="rejected-heading">
        <h2 id="rejected-heading" className="text-xl font-semibold">
          切られた施策（上位 {rejected.length} 件）
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          採択されなかった施策のうち、優先度の高い順に表示しています。理由は選定ロジックが
          記録したものをそのまま示しています。
        </p>
        <div className="mt-3 space-y-3">
          {rejected.map(({ policy, reason }) => (
            <PolicyCard key={policy.id} policy={policy} note={rejectionReasonText(reason)} compact />
          ))}
        </div>
      </section>

      {/* 4. 予算 */}
      <section aria-labelledby="budget-heading">
        <h2 id="budget-heading" className="text-xl font-semibold">
          裁量枠の使い方
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <StatTile label="採択された施策" value={String(result.adopted.length)} unit="件" />
          <StatTile label="想定コスト合計" value={formatOku(result.totalCostOku)} unit="億円" />
          <StatTile
            label="裁量枠の使用率"
            value={usage.toLocaleString('ja-JP', {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}
            unit="%"
          />
        </div>

        <div className="mt-4">
          <div
            role="progressbar"
            aria-label="裁量枠の使用率"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(usage)}
            aria-valuetext={`${usage.toFixed(1)}%`}
            className="h-3 w-full overflow-hidden rounded-full"
            style={{ background: 'var(--viz-track)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.max(0, usage))}%`,
                background: 'var(--viz-series-1)',
              }}
            />
          </div>
          <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
            想定コスト合計 {formatOku(result.totalCostOku)} 億円 ／ 裁量枠{' '}
            {formatOku(budgetOku)} 億円
          </p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
            裁量枠は、{prefecture.name}の歳出総額 {formatOku(totalExpenseOku)} 億円の 5% として
            計算しています。この 5% は本モデルの仮定値です。枠を超える施策は採択されないため、
            使用率が 100% を超えることはありません。
          </p>
        </div>
      </section>

      {/* 5. チャート */}
      <section aria-labelledby="charts-heading" className="space-y-10">
        <h2 id="charts-heading" className="text-xl font-semibold">
          歳出構成と効果の相対指標
        </h2>
        <BudgetShift prefecture={prefecture} costByCategory={result.costByCategory} />
        <TradeoffChart effects={result.effects} />
      </section>
    </div>
  );
}
