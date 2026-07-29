'use client';

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fiscalData } from '@/lib/fiscal';
import {
  EXPENSE_MODES,
  expenseCategories,
  expenseMean,
  expenseRanking,
  FISCAL_AVERAGE_LABEL,
  formatExpenseValue,
  type ExpenseMode,
} from '@/lib/data-view';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend, DataTable, FilterRow, SelectField, SourceNote, TableDetails } from './parts';

/** 1 県ぶんの行の高さ。47 行ぶんの高さをここから決める */
const ROW_HEIGHT = 18;

/**
 * 47 都道府県を 1 つの歳出区分について並べたランキング。
 *
 * 主役は 1 県（秋田県）なので、カテゴリ配色ではなく「強調」の形にしてある
 * ＝ 秋田県だけ系列色、残り 46 県は退かせた灰色。47 本の棒に 47 色を割り当てても
 * 読み手は識別できない。
 *
 * 順位は常に「値の大きい順」で確定させ、表示順とは切り離してある
 * （並び替えても各県の順位表示は動かない）。
 */
export function ExpenseBars() {
  const [mode, setMode] = useState<ExpenseMode>('purpose');

  const categories = useMemo(() => expenseCategories(mode), [mode]);
  const [purposeCategory, setPurposeCategory] = useState('民生費');
  const [natureCategory, setNatureCategory] = useState('人件費');

  const category = mode === 'purpose' ? purposeCategory : natureCategory;
  const setCategory = mode === 'purpose' ? setPurposeCategory : setNatureCategory;

  // 区分の選択がモード切り替えで無効になった場合に備える（状態は持ち越さず、その場で解決する）
  const activeCategory = categories.includes(category) ? category : categories[0];

  const rows = useMemo(
    () => expenseRanking(mode, activeCategory, 'desc'),
    [mode, activeCategory],
  );
  const average = useMemo(() => expenseMean(mode, activeCategory), [mode, activeCategory]);

  const modeInfo = EXPENSE_MODES.find((m) => m.mode === mode)!;
  const akita = rows.find((r) => r.akita)!;
  const format = (value: number) => formatExpenseValue(mode, value);

  return (
    <figure className="viz-root">
      <figcaption className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        <span className="block text-base font-medium text-neutral-900 dark:text-neutral-100">
          歳出の内訳を47都道府県で比べる
        </span>
        {modeInfo.note}単位は{modeInfo.unit}です。縦の実線は{FISCAL_AVERAGE_LABEL}を示します。
      </figcaption>

      <FilterRow>
        <SelectField
          id="expense-mode"
          label="分け方"
          value={mode}
          onChange={(value) => setMode(value as ExpenseMode)}
        >
          {EXPENSE_MODES.map((m) => (
            <option key={m.mode} value={m.mode}>
              {m.label}
            </option>
          ))}
        </SelectField>
        <SelectField id="expense-category" label="区分" value={activeCategory} onChange={setCategory}>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>
      </FilterRow>

      <ChartLegend
        items={[
          { label: '秋田県', color: 'var(--viz-series-1)' },
          { label: 'その他の46都道府県', color: 'var(--viz-deemph)' },
        ]}
      />

      <p className="mt-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        秋田県の{activeCategory}は {format(akita.value)}で、47都道府県中 {akita.rank} 位です（
        {FISCAL_AVERAGE_LABEL}は {format(average)}）。
      </p>

      <div
        className="mt-2 w-full overflow-x-auto"
        style={{ height: `${rows.length * ROW_HEIGHT + 56}px` }}
        aria-hidden="true"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
            <CartesianGrid stroke="var(--viz-grid)" horizontal={false} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={{ stroke: 'var(--viz-axis)' }}
              tick={{ fill: 'var(--viz-muted)', fontSize: 11 }}
              label={{
                value: `${activeCategory}（${modeInfo.unit}）`,
                position: 'insideBottom',
                offset: -14,
                fill: 'var(--viz-ink-secondary)',
                fontSize: 11,
              }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={64}
              interval={0}
              tickLine={false}
              axisLine={{ stroke: 'var(--viz-axis)' }}
              tick={{ fill: 'var(--viz-muted)', fontSize: 10 }}
            />
            <ReferenceLine
              x={average}
              stroke="var(--viz-axis)"
              label={{
                value: `平均 ${format(average)}`,
                position: 'insideTopRight',
                fill: 'var(--viz-muted)',
                fontSize: 10,
              }}
            />
            <Tooltip cursor={false} content={<ChartTooltip format={format} />} />
            <Bar dataKey="value" name={activeCategory} isAnimationActive={false}>
              {rows.map((row) => (
                <Cell
                  key={row.code}
                  fill={row.akita ? 'var(--viz-series-1)' : 'var(--viz-deemph)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <SourceNote meta={fiscalData.meta} />

      <TableDetails minWidth="22rem">
        <DataTable>
          <caption className="sr-only">
            47都道府県の{activeCategory}（{modeInfo.unit}、多い順）
          </caption>
          <thead className="text-neutral-500 dark:text-neutral-400">
            <tr>
              <th scope="col" className="py-1 pr-3 text-right font-medium">
                順位
              </th>
              <th scope="col" className="py-1 pr-3 font-medium">
                都道府県
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                {activeCategory}
              </th>
            </tr>
          </thead>
          <tbody className="text-neutral-700 dark:text-neutral-300">
            {rows.map((row) => (
              <tr
                key={row.code}
                className={`border-t border-neutral-200 dark:border-neutral-800 ${
                  row.akita ? 'font-semibold text-neutral-900 dark:text-neutral-100' : ''
                }`}
              >
                <td className="py-1 pr-3 text-right">{row.rank}</td>
                <th scope="row" className="py-1 pr-3 text-left font-normal">
                  {row.name}
                </th>
                <td className="py-1 text-right">{format(row.value)}</td>
              </tr>
            ))}
            <tr className="border-t border-neutral-300 dark:border-neutral-700">
              <td className="py-1 pr-3" />
              <th scope="row" className="py-1 pr-3 text-left font-normal">
                {FISCAL_AVERAGE_LABEL}
              </th>
              <td className="py-1 text-right">{format(average)}</td>
            </tr>
          </tbody>
        </DataTable>
      </TableDetails>
    </figure>
  );
}
