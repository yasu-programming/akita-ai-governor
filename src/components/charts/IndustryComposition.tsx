'use client';

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AKITA_CODE } from '@/lib/constants';
import { industryData } from '@/lib/industry';
import {
  formatPercent,
  formatPoint,
  INDUSTRY_AVERAGE_LABEL,
  industryYears,
  sectorDeviations,
  sectorTrend,
} from '@/lib/data-view';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend, DataTable, FilterRow, SelectField, SourceNote, TableDetails } from './parts';

const ROW_HEIGHT = 24;

/**
 * 秋田県の産業構成を全国と比べる。
 *
 * 上段は「全国との差」だけを描く発散棒。構成比そのものを 16 本並べても
 * 全国との違いは読み取れないため、差を主にしてある。基準線 0 が全国。
 * 下段は選んだ 1 業種の構成比の推移（県と全国の 2 系列）。
 *
 * 分母は sectorShares() と揃えてある（業種別県内総生産の合計）。
 * gdpTotal を分母にすると県と全国で構成比が突き合わなくなる。
 */
export function IndustryComposition() {
  const years = industryYears();
  const [year, setYear] = useState(industryData.latestYear);

  const deviations = useMemo(() => sectorDeviations(AKITA_CODE, year), [year]);
  const [sector, setSector] = useState('農林水産業');
  const trend = useMemo(() => sectorTrend(AKITA_CODE, sector), [sector]);

  const higher = deviations.filter((d) => d.diff > 0).length;
  // 並びは固定なので、その年度の最大・最小は値から取る
  const byDiff = useMemo(() => [...deviations].sort((a, b) => b.diff - a.diff), [deviations]);
  const widest = byDiff[0];
  const narrowest = byDiff[byDiff.length - 1];

  return (
    <figure className="viz-root">
      <figcaption className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        <span className="block text-base font-medium text-neutral-900 dark:text-neutral-100">
          秋田県の産業構成と全国との差
        </span>
        県内総生産に占める業種別の構成比を、{INDUSTRY_AVERAGE_LABEL}と比べた差（ポイント）です。
        右に伸びるほど全国より比重が大きく、左に伸びるほど小さい業種です。
        業種の並びは{industryData.latestYear}年度の差の大きい順で固定してあり、
        年度を変えても入れ替わりません。
      </figcaption>

      <FilterRow>
        <SelectField id="industry-year" label="年度" value={year} onChange={setYear}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}年度
            </option>
          ))}
        </SelectField>
      </FilterRow>

      <ChartLegend
        items={[
          { label: '全国より比重が大きい', color: 'var(--viz-positive)' },
          { label: '全国より比重が小さい', color: 'var(--viz-negative)' },
        ]}
      />

      <p className="mt-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        {year}年度は {deviations.length} 業種のうち {higher} 業種で全国を上回っています。
        最も差が大きいのは {widest.sector}（{formatPoint(widest.diff)}）、最も小さいのは
        {narrowest.sector}（{formatPoint(narrowest.diff)}）です。
      </p>

      <div
        className="mt-2 w-full overflow-x-auto"
        style={{ height: `${deviations.length * ROW_HEIGHT + 56}px` }}
        aria-hidden="true"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={deviations}
            layout="vertical"
            margin={{ top: 8, right: 16, bottom: 24, left: 0 }}
          >
            <CartesianGrid stroke="var(--viz-grid)" horizontal={false} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={{ stroke: 'var(--viz-axis)' }}
              tick={{ fill: 'var(--viz-muted)', fontSize: 11 }}
              label={{
                value: '全国との差（ポイント）',
                position: 'insideBottom',
                offset: -14,
                fill: 'var(--viz-ink-secondary)',
                fontSize: 11,
              }}
            />
            <YAxis
              type="category"
              dataKey="short"
              width={104}
              interval={0}
              tickLine={false}
              axisLine={{ stroke: 'var(--viz-axis)' }}
              tick={{ fill: 'var(--viz-muted)', fontSize: 10 }}
            />
            <ReferenceLine x={0} stroke="var(--viz-axis)" />
            <Tooltip
              cursor={false}
              content={
                <ChartTooltip labelKey="sector" format={(value) => formatPoint(value)} />
              }
            />
            <Bar dataKey="diff" name="全国との差" isAnimationActive={false}>
              {deviations.map((d) => (
                <Cell
                  key={d.sector}
                  fill={d.diff >= 0 ? 'var(--viz-positive)' : 'var(--viz-negative)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <SourceNote meta={industryData.meta} />

      <TableDetails minWidth="24rem">
        <DataTable>
          <caption className="sr-only">
            秋田県の業種別構成比と全国との差（{year}年度、{industryData.latestYear}
            年度の差の大きい順に固定）
          </caption>
          <thead className="text-neutral-500 dark:text-neutral-400">
            <tr>
              <th scope="col" className="py-1 pr-3 font-medium">
                業種
              </th>
              <th scope="col" className="py-1 pr-3 text-right font-medium">
                秋田県
              </th>
              <th scope="col" className="py-1 pr-3 text-right font-medium">
                全国
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                差
              </th>
            </tr>
          </thead>
          <tbody className="text-neutral-700 dark:text-neutral-300">
            {deviations.map((d) => (
              <tr key={d.sector} className="border-t border-neutral-200 dark:border-neutral-800">
                <th scope="row" className="py-1 pr-3 text-left font-normal">
                  {d.sector}
                </th>
                <td className="py-1 pr-3 text-right">{formatPercent(d.pref)}</td>
                <td className="py-1 pr-3 text-right">{formatPercent(d.national)}</td>
                <td className="py-1 text-right">{formatPoint(d.diff)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </TableDetails>

      <div className="mt-8 border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
          1 業種の構成比の推移
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          {years[0]}年度から {years[years.length - 1]}年度までの、秋田県と全国の構成比(%)です。
        </p>

        <FilterRow>
          <SelectField id="industry-sector" label="業種" value={sector} onChange={setSector}>
            {industryData.sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </SelectField>
        </FilterRow>

        <ChartLegend
          items={[
            { label: '秋田県', color: 'var(--viz-series-1)', shape: 'line' },
            { label: INDUSTRY_AVERAGE_LABEL, color: 'var(--viz-series-2)', shape: 'line' },
          ]}
        />

        <div className="mt-2 h-[18rem] w-full sm:h-[22rem]" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 12, right: 16, bottom: 24, left: 0 }}>
              <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
              <XAxis
                dataKey="year"
                tickLine={false}
                axisLine={{ stroke: 'var(--viz-axis)' }}
                tick={{ fill: 'var(--viz-muted)', fontSize: 11 }}
              />
              <YAxis
                width={44}
                unit="%"
                tickLine={false}
                axisLine={{ stroke: 'var(--viz-axis)' }}
                tick={{ fill: 'var(--viz-muted)', fontSize: 11 }}
              />
              <Tooltip cursor={false} content={<ChartTooltip format={(v) => formatPercent(v)} />} />
              <Line
                type="monotone"
                dataKey="pref"
                name="秋田県"
                stroke="var(--viz-series-1)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="national"
                name="全国"
                stroke="var(--viz-series-2)"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <SourceNote meta={industryData.meta} />

        <TableDetails minWidth="20rem">
          <DataTable>
            <caption className="sr-only">
              {sector}の構成比の推移（秋田県と全国）
            </caption>
            <thead className="text-neutral-500 dark:text-neutral-400">
              <tr>
                <th scope="col" className="py-1 pr-3 font-medium">
                  年度
                </th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">
                  秋田県
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  全国
                </th>
              </tr>
            </thead>
            <tbody className="text-neutral-700 dark:text-neutral-300">
              {trend.map((row) => (
                <tr key={row.year} className="border-t border-neutral-200 dark:border-neutral-800">
                  <th scope="row" className="py-1 pr-3 text-left font-normal">
                    {row.year}年度
                  </th>
                  <td className="py-1 pr-3 text-right">{formatPercent(row.pref)}</td>
                  <td className="py-1 text-right">{formatPercent(row.national)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableDetails>
      </div>
    </figure>
  );
}
