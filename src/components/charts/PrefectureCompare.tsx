'use client';

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fiscalData, getAkita, getPrefecture } from '@/lib/fiscal';
import {
  formatNumber,
  formatPercent,
  formatYen,
  INDUSTRY_THREE_LABELS,
  industryStackRows,
  otherPrefectureOptions,
  purposeCompareRows,
  revenueCompareRows,
  scaleRows,
} from '@/lib/data-view';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend, DataTable, FilterRow, SelectField, SourceNote, TableDetails } from './parts';

const ROW_HEIGHT = 26;

/**
 * 秋田県ともう 1 県を並べる。
 *
 * 行の並びは常に秋田県の値の降順で固定してある（比較先を変えても行が
 * 入れ替わらない）。カテゴリ軸が動くと、値の変化と順序の変化が見分けられない。
 */
export function PrefectureCompare() {
  const akita = getAkita();
  const options = otherPrefectureOptions();
  const [code, setCode] = useState('02');
  const other = useMemo(() => getPrefecture(code), [code]);

  const revenue = useMemo(() => revenueCompareRows(akita, other), [akita, other]);
  const purpose = useMemo(() => purposeCompareRows(akita, other), [akita, other]);
  const industry = useMemo(() => industryStackRows(akita, other), [akita, other]);
  const scale = useMemo(() => scaleRows(akita, other), [akita, other]);

  const legend = [
    { label: akita.name, color: 'var(--viz-series-1)' },
    { label: other.name, color: 'var(--viz-series-2)' },
  ];

  return (
    <figure className="viz-root">
      <figcaption className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        <span className="block text-base font-medium text-neutral-900 dark:text-neutral-100">
          秋田県と 1 県を並べて見る
        </span>
        歳入構成比、目的別歳出、産業の 3 区分、規模を同じ尺度で並べます。
        行の並びは秋田県の値の降順で固定してあるので、比較先を変えても行は動きません。
      </figcaption>

      <FilterRow>
        <SelectField id="compare-prefecture" label="比較する県" value={code} onChange={setCode}>
          {options.map((o) => (
            <option key={o.code} value={o.code}>
              {o.name}
            </option>
          ))}
        </SelectField>
      </FilterRow>

      <ChartLegend items={legend} />

      {/* 歳入構成比 */}
      <p className="mt-6 text-sm font-medium text-neutral-900 dark:text-neutral-100">
        歳入の構成比（%）
      </p>
      <div
        className="mt-2 w-full overflow-x-auto"
        style={{ height: `${revenue.length * ROW_HEIGHT + 48}px` }}
        aria-hidden="true"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={revenue}
            layout="vertical"
            margin={{ top: 8, right: 16, bottom: 20, left: 0 }}
          >
            <CartesianGrid stroke="var(--viz-grid)" horizontal={false} />
            <XAxis
              type="number"
              unit="%"
              tickLine={false}
              axisLine={{ stroke: 'var(--viz-axis)' }}
              tick={{ fill: 'var(--viz-muted)', fontSize: 11 }}
            />
            <YAxis
              type="category"
              dataKey="short"
              width={120}
              interval={0}
              tickLine={false}
              axisLine={{ stroke: 'var(--viz-axis)' }}
              tick={{ fill: 'var(--viz-muted)', fontSize: 10 }}
            />
            <Tooltip
              cursor={false}
              content={<ChartTooltip labelKey="key" format={(v) => formatPercent(v)} />}
            />
            <Bar dataKey="a" name={akita.name} fill="var(--viz-series-1)" isAnimationActive={false} />
            <Bar dataKey="b" name={other.name} fill="var(--viz-series-2)" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableDetails minWidth="22rem" summary="歳入構成比を表で見る">
        <DataTable>
          <caption className="sr-only">
            {akita.name}と{other.name}の歳入構成比
          </caption>
          <thead className="text-neutral-500 dark:text-neutral-400">
            <tr>
              <th scope="col" className="py-1 pr-3 font-medium">
                区分
              </th>
              <th scope="col" className="py-1 pr-3 text-right font-medium">
                {akita.name}
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                {other.name}
              </th>
            </tr>
          </thead>
          <tbody className="text-neutral-700 dark:text-neutral-300">
            {revenue.map((row) => (
              <tr key={row.key} className="border-t border-neutral-200 dark:border-neutral-800">
                <th scope="row" className="py-1 pr-3 text-left font-normal">
                  {row.key}
                </th>
                <td className="py-1 pr-3 text-right">{formatPercent(row.a)}</td>
                <td className="py-1 text-right">{formatPercent(row.b)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </TableDetails>

      {/* 目的別歳出 */}
      <p className="mt-8 text-sm font-medium text-neutral-900 dark:text-neutral-100">
        目的別歳出（人口1人当たり円）
      </p>
      <div
        className="mt-2 w-full overflow-x-auto"
        style={{ height: `${purpose.length * ROW_HEIGHT + 48}px` }}
        aria-hidden="true"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={purpose}
            layout="vertical"
            margin={{ top: 8, right: 16, bottom: 20, left: 0 }}
          >
            <CartesianGrid stroke="var(--viz-grid)" horizontal={false} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={{ stroke: 'var(--viz-axis)' }}
              tick={{ fill: 'var(--viz-muted)', fontSize: 11 }}
            />
            <YAxis
              type="category"
              dataKey="short"
              width={92}
              interval={0}
              tickLine={false}
              axisLine={{ stroke: 'var(--viz-axis)' }}
              tick={{ fill: 'var(--viz-muted)', fontSize: 10 }}
            />
            <Tooltip
              cursor={false}
              content={<ChartTooltip labelKey="key" format={(v) => formatYen(v)} />}
            />
            <Bar dataKey="a" name={akita.name} fill="var(--viz-series-1)" isAnimationActive={false} />
            <Bar dataKey="b" name={other.name} fill="var(--viz-series-2)" isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableDetails minWidth="22rem" summary="目的別歳出を表で見る">
        <DataTable>
          <caption className="sr-only">
            {akita.name}と{other.name}の目的別歳出
          </caption>
          <thead className="text-neutral-500 dark:text-neutral-400">
            <tr>
              <th scope="col" className="py-1 pr-3 font-medium">
                区分
              </th>
              <th scope="col" className="py-1 pr-3 text-right font-medium">
                {akita.name}
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                {other.name}
              </th>
            </tr>
          </thead>
          <tbody className="text-neutral-700 dark:text-neutral-300">
            {purpose.map((row) => (
              <tr key={row.key} className="border-t border-neutral-200 dark:border-neutral-800">
                <th scope="row" className="py-1 pr-3 text-left font-normal">
                  {row.key}
                </th>
                <td className="py-1 pr-3 text-right">{formatYen(row.a)}</td>
                <td className="py-1 text-right">{formatYen(row.b)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </TableDetails>

      {/* 産業の 3 区分と規模は表で足りる。棒を足しても情報が増えない */}
      <p className="mt-8 text-sm font-medium text-neutral-900 dark:text-neutral-100">
        産業の 3 区分と規模
      </p>
      <div className="mt-2 overflow-x-auto">
        <DataTable>
          <caption className="sr-only">
            {akita.name}と{other.name}の産業3区分の比率と規模
          </caption>
          <thead className="text-neutral-500 dark:text-neutral-400">
            <tr>
              <th scope="col" className="py-1 pr-3 font-medium">
                項目
              </th>
              <th scope="col" className="py-1 pr-3 text-right font-medium">
                {akita.name}
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                {other.name}
              </th>
            </tr>
          </thead>
          <tbody className="text-neutral-700 dark:text-neutral-300">
            {INDUSTRY_THREE_LABELS.map(({ key, label }) => (
              <tr key={key} className="border-t border-neutral-200 dark:border-neutral-800">
                <th scope="row" className="py-1 pr-3 text-left font-normal">
                  {label}
                </th>
                <td className="py-1 pr-3 text-right">{formatPercent(industry[0][key])}</td>
                <td className="py-1 text-right">{formatPercent(industry[1][key])}</td>
              </tr>
            ))}
            {scale.map((row) => (
              <tr key={row.label} className="border-t border-neutral-200 dark:border-neutral-800">
                <th scope="row" className="py-1 pr-3 text-left font-normal">
                  {row.label}（{row.unit}）
                </th>
                <td className="py-1 pr-3 text-right">{formatNumber(row.a, row.digits)}</td>
                <td className="py-1 text-right">{formatNumber(row.b, row.digits)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
        産業の 3 区分は就業者ベースの比率です（県内総生産ベースの業種別構成比とは分母が異なります）。
      </p>

      <SourceNote meta={fiscalData.meta} />
    </figure>
  );
}
