'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { effectRows, formatSigned } from '@/lib/sim-view';
import type { AxisKey } from '@/lib/types';
import { ChartTooltip } from '@/components/charts/ChartTooltip';

type Props = {
  effects: Record<AxisKey, number>;
};

const ROW_HEIGHT = 40;

/**
 * 採択カードの軸別スコアを合算した「効果の相対指標」。
 *
 * 0 を挟んでプラス・マイナスの両側に伸びるので、極性を表す配色（青↔赤）を使う。
 * 単位はない。円や % ではないため、そう読めるラベルは付けない。
 */
export function TradeoffChart({ effects }: Props) {
  const rows = effectRows(effects);
  const bound = Math.max(10, ...rows.map((row) => Math.abs(row.value)));
  const domainBound = Math.ceil(bound / 10) * 10;

  const data = rows.map((row) => ({
    ...row,
    positive: row.value > 0 ? row.value : 0,
    negative: row.value < 0 ? row.value : 0,
    positiveLabel: row.value >= 0 ? formatSigned(row.value) : '',
    negativeLabel: row.value < 0 ? formatSigned(row.value) : '',
  }));

  return (
    <figure className="viz-root">
      <figcaption className="text-sm text-neutral-700 dark:text-neutral-300">
        <span className="block text-base font-medium text-neutral-900 dark:text-neutral-100">
          軸ごとの効果の相対指標
        </span>
        採択された施策に本モデルが割り当てた軸別スコアを、軸ごとに合計したもの。単位はなく、
        軸どうしの向きと大きさを見比べるための相対的な指標です。
      </figcaption>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-700 dark:text-neutral-300">
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-[2px]"
            style={{ background: 'var(--viz-positive)' }}
          />
          0 より大きい（右向き）
        </li>
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-[2px]"
            style={{ background: 'var(--viz-negative)' }}
          />
          0 より小さい（左向き）
        </li>
      </ul>

      <div
        className="mt-2 w-full"
        style={{ height: data.length * ROW_HEIGHT + 8 }}
        aria-hidden="true"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 40, bottom: 4, left: 0 }}
            barCategoryGap="35%"
          >
            <CartesianGrid horizontal={false} stroke="var(--viz-grid)" />
            <XAxis type="number" domain={[-domainBound, domainBound]} hide />
            <YAxis
              type="category"
              dataKey="label"
              width={84}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--viz-ink-secondary)', fontSize: 11 }}
            />
            <ReferenceLine x={0} stroke="var(--viz-axis)" />
            <Tooltip
              cursor={{ fill: 'var(--viz-grid)', fillOpacity: 0.4 }}
              content={<ChartTooltip format={(value) => formatSigned(value)} hideZero />}
            />
            <Bar
              dataKey="positive"
              name="合計値"
              stackId="effect"
              fill="var(--viz-positive)"
              radius={[0, 4, 4, 0]}
              maxBarSize={16}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="positiveLabel"
                position="right"
                offset={8}
                fill="var(--viz-ink-secondary)"
                fontSize={11}
              />
            </Bar>
            <Bar
              dataKey="negative"
              name="合計値"
              stackId="effect"
              fill="var(--viz-negative)"
              radius={[4, 0, 0, 4]}
              maxBarSize={16}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="negativeLabel"
                position="left"
                offset={8}
                fill="var(--viz-ink-secondary)"
                fontSize={11}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-1 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        これらの数値は本モデルが各施策に割り当てた仮定値の合計であり、将来の予測ではありません。
      </p>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-neutral-600 underline underline-offset-2 dark:text-neutral-400">
          数値を表で見る
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[16rem] text-left text-xs tabular-nums">
            <thead className="text-neutral-500 dark:text-neutral-400">
              <tr>
                <th scope="col" className="py-1 pr-3 font-medium">
                  軸
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  合計値（単位なし）
                </th>
              </tr>
            </thead>
            <tbody className="text-neutral-700 dark:text-neutral-300">
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-neutral-200 dark:border-neutral-800">
                  <th scope="row" className="py-1 pr-3 font-normal">
                    {row.label}
                  </th>
                  <td className="py-1 text-right">{formatSigned(row.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
