'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { budgetShiftRows, formatOku } from '@/lib/sim-view';
import type { PrefectureFiscal } from '@/lib/types';
import { ChartTooltip } from './ChartTooltip';

type Props = {
  prefecture: PrefectureFiscal;
  /** 目的別歳出区分ごとの採択コスト合計（億円） */
  costByCategory: Record<string, number>;
};

const ROW_HEIGHT = 34;
const AXIS_BAND = 30;

/**
 * 目的別歳出の「現状」と「シミュレーション後」を並べた横棒グラフ。
 *
 * 2 系列なので凡例を必ず置く（色だけに頼らせない）。上乗せがあった区分だけ
 * 差分を棒の先に直接ラベルする。数値は表でも読めるようにしてある。
 */
export function BudgetShift({ prefecture, costByCategory }: Props) {
  const rows = budgetShiftRows(prefecture, costByCategory);
  const data = rows.map((row) => ({
    ...row,
    addedLabel: row.addedOku > 0 ? `+${formatOku(row.addedOku)}` : '',
  }));
  const chartHeight = data.length * ROW_HEIGHT + AXIS_BAND;

  return (
    <figure className="viz-root">
      <figcaption className="text-sm text-neutral-700 dark:text-neutral-300">
        <span className="block text-base font-medium text-neutral-900 dark:text-neutral-100">
          目的別歳出の組み替え
        </span>
        現状の目的別歳出（億円）に、採択された施策の想定コストを上乗せしたもの。
        歳出を抑える方向の施策にも実施コストがかかるため、上乗せは常にプラス側に出る。
      </figcaption>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-700 dark:text-neutral-300">
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-[2px]"
            style={{ background: 'var(--viz-series-1)' }}
          />
          現状
        </li>
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-[2px]"
            style={{ background: 'var(--viz-series-2)' }}
          />
          シミュレーション後
        </li>
      </ul>

      <div className="mt-2 w-full" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 52, bottom: 0, left: 0 }}
            barGap={2}
            barCategoryGap="30%"
          >
            <CartesianGrid horizontal={false} stroke="var(--viz-grid)" />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={{ stroke: 'var(--viz-axis)' }}
              tick={{ fill: 'var(--viz-muted)', fontSize: 11 }}
              tickFormatter={(value: unknown) => Number(value).toLocaleString('ja-JP')}
              unit=""
            />
            <YAxis
              type="category"
              dataKey="category"
              width={76}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--viz-ink-secondary)', fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: 'var(--viz-grid)', fillOpacity: 0.4 }}
              content={<ChartTooltip format={(value) => `${formatOku(value)} 億円`} />}
            />
            <Bar
              dataKey="currentOku"
              name="現状"
              fill="var(--viz-series-1)"
              radius={[0, 4, 4, 0]}
              maxBarSize={12}
              isAnimationActive={false}
            />
            <Bar
              dataKey="afterOku"
              name="シミュレーション後"
              fill="var(--viz-series-2)"
              radius={[0, 4, 4, 0]}
              maxBarSize={12}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="addedLabel"
                position="right"
                offset={8}
                fill="var(--viz-ink-secondary)"
                fontSize={10}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
        単位は億円。裁量枠 5% は本モデルの仮定値です。
      </p>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-neutral-600 underline underline-offset-2 dark:text-neutral-400">
          数値を表で見る
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[22rem] text-left text-xs tabular-nums">
            <thead className="text-neutral-500 dark:text-neutral-400">
              <tr>
                <th scope="col" className="py-1 pr-3 font-medium">
                  目的別歳出区分
                </th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">
                  現状
                </th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">
                  上乗せ
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  シミュレーション後
                </th>
              </tr>
            </thead>
            <tbody className="text-neutral-700 dark:text-neutral-300">
              {rows.map((row) => (
                <tr key={row.category} className="border-t border-neutral-200 dark:border-neutral-800">
                  <th scope="row" className="py-1 pr-3 font-normal">
                    {row.category}
                  </th>
                  <td className="py-1 pr-3 text-right">{formatOku(row.currentOku)}</td>
                  <td className="py-1 pr-3 text-right">
                    {row.addedOku > 0 ? `+${formatOku(row.addedOku)}` : '—'}
                  </td>
                  <td className="py-1 text-right">{formatOku(row.afterOku)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
