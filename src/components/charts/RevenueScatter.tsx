'use client';

import {
  CartesianGrid,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fiscalData } from '@/lib/fiscal';
import {
  axisMax,
  FISCAL_AVERAGE_LABEL,
  formatPercent,
  meanRevenueShare,
  REVENUE_X_KEY,
  REVENUE_Y_KEY,
  revenueScatterPoints,
} from '@/lib/data-view';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend, DataTable, SourceNote, TableDetails } from './parts';

/**
 * 点のかたち。
 *
 * dataviz の規約:
 *  - 点は面の色で 2px のリングを持つ（重なっても輪郭が残る）
 *  - 当たり判定はマークより大きく取る（透明な円 r=12 → 24px）。
 *    8px の点を狙わせない
 */
type DotProps = { cx?: number; cy?: number; fill?: string; radius?: number };

function dotShape({ cx, cy, fill, radius }: DotProps) {
  if (cx === undefined || cy === undefined) return <g />;
  return (
    <g>
      <circle cx={cx} cy={cy} r={12} fill="transparent" />
      <circle
        cx={cx}
        cy={cy}
        r={radius ?? 4.5}
        fill={fill}
        stroke="var(--viz-surface)"
        strokeWidth={2}
      />
    </g>
  );
}

/**
 * 47 都道府県の歳入構成。横軸は道府県税、縦軸は地方交付税の構成比。
 *
 * 主役は 1 県（秋田県）なので、カテゴリ配色ではなく「強調」の形にしてある
 * ＝ 秋田県だけ系列色、残り 46 県は退かせた灰色。散布図は任意の 2 点が
 * 隣り合うため、色数を増やすほど識別が壊れる。
 */
export function RevenueScatter() {
  const points = revenueScatterPoints();
  const akita = points.filter((p) => p.akita);
  const others = points.filter((p) => !p.akita);

  const meanTax = meanRevenueShare(REVENUE_X_KEY);
  const meanGrant = meanRevenueShare(REVENUE_Y_KEY);

  const xMax = axisMax(points.map((p) => p.tax));
  const yMax = axisMax(points.map((p) => p.grant));

  const tableRows = [...points].sort((a, b) => b.grant - a.grant || a.code.localeCompare(b.code));

  return (
    <figure className="viz-root">
      <figcaption className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        <span className="block text-base font-medium text-neutral-900 dark:text-neutral-100">
          自前の税収と地方交付税のバランス（47都道府県）
        </span>
        横軸は歳入に占める{REVENUE_X_KEY}の構成比、縦軸は{REVENUE_Y_KEY}の構成比（いずれも %）。
        破線ではなく実線の基準線は{FISCAL_AVERAGE_LABEL}です。
      </figcaption>

      <ChartLegend
        items={[
          { label: '秋田県', color: 'var(--viz-series-1)', shape: 'dot' },
          { label: 'その他の46都道府県', color: 'var(--viz-deemph)', shape: 'dot' },
        ]}
      />

      <div className="mt-2 h-[22rem] w-full sm:h-[26rem]" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 16, bottom: 28, left: 0 }}>
            <CartesianGrid stroke="var(--viz-grid)" />
            <XAxis
              type="number"
              dataKey="tax"
              name={REVENUE_X_KEY}
              unit="%"
              domain={[0, xMax]}
              tickLine={false}
              axisLine={{ stroke: 'var(--viz-axis)' }}
              tick={{ fill: 'var(--viz-muted)', fontSize: 11 }}
              label={{
                value: `${REVENUE_X_KEY}の構成比(%)`,
                position: 'insideBottom',
                offset: -18,
                fill: 'var(--viz-ink-secondary)',
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              dataKey="grant"
              name={REVENUE_Y_KEY}
              unit="%"
              domain={[0, yMax]}
              width={44}
              tickLine={false}
              axisLine={{ stroke: 'var(--viz-axis)' }}
              tick={{ fill: 'var(--viz-muted)', fontSize: 11 }}
              label={{
                value: `${REVENUE_Y_KEY}の構成比(%)`,
                angle: -90,
                position: 'insideLeft',
                offset: 14,
                style: { textAnchor: 'middle', fill: 'var(--viz-ink-secondary)', fontSize: 11 },
              }}
            />
            <ReferenceLine
              x={meanTax}
              stroke="var(--viz-axis)"
              label={{
                value: `平均 ${formatPercent(meanTax)}`,
                position: 'insideTopRight',
                fill: 'var(--viz-muted)',
                fontSize: 10,
              }}
            />
            <ReferenceLine
              y={meanGrant}
              stroke="var(--viz-axis)"
              label={{
                value: `平均 ${formatPercent(meanGrant)}`,
                position: 'insideBottomRight',
                fill: 'var(--viz-muted)',
                fontSize: 10,
              }}
            />
            <Tooltip
              cursor={false}
              content={<ChartTooltip labelKey="name" format={(value) => formatPercent(value)} />}
            />
            <Scatter
              name="その他の46都道府県"
              data={others}
              fill="var(--viz-deemph)"
              shape={dotShape}
              isAnimationActive={false}
            />
            <Scatter
              name="秋田県"
              data={akita}
              fill="var(--viz-series-1)"
              shape={(props: DotProps) => dotShape({ ...props, radius: 6 })}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="name"
                position="top"
                offset={12}
                fill="var(--viz-ink)"
                fontSize={12}
                fontWeight={600}
              />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        {REVENUE_Y_KEY}への依存度が高い県ほど、県内の税収変動から相対的に切り離される一方、
        国の算定に左右される割合が大きくなります。秋田県は{REVENUE_X_KEY}が
        {formatPercent(akita[0].tax)}（平均 {formatPercent(meanTax)}）、{REVENUE_Y_KEY}が
        {formatPercent(akita[0].grant)}（平均 {formatPercent(meanGrant)}）で、図の左上に位置します。
      </p>

      <SourceNote meta={fiscalData.meta} />

      <TableDetails minWidth="20rem">
        <DataTable>
          <caption className="sr-only">
            47都道府県の{REVENUE_X_KEY}と{REVENUE_Y_KEY}の構成比（{REVENUE_Y_KEY}の高い順）
          </caption>
          <thead className="text-neutral-500 dark:text-neutral-400">
            <tr>
              <th scope="col" className="py-1 pr-3 font-medium">
                都道府県
              </th>
              <th scope="col" className="py-1 pr-3 text-right font-medium">
                {REVENUE_X_KEY}
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                {REVENUE_Y_KEY}
              </th>
            </tr>
          </thead>
          <tbody className="text-neutral-700 dark:text-neutral-300">
            {tableRows.map((row) => (
              <tr
                key={row.code}
                className={`border-t border-neutral-200 dark:border-neutral-800 ${
                  row.akita ? 'font-semibold text-neutral-900 dark:text-neutral-100' : ''
                }`}
              >
                <th scope="row" className="py-1 pr-3 text-left font-normal">
                  {row.name}
                </th>
                <td className="py-1 pr-3 text-right">{formatPercent(row.tax)}</td>
                <td className="py-1 text-right">{formatPercent(row.grant)}</td>
              </tr>
            ))}
            <tr className="border-t border-neutral-300 dark:border-neutral-700">
              <th scope="row" className="py-1 pr-3 text-left font-normal">
                {FISCAL_AVERAGE_LABEL}
              </th>
              <td className="py-1 pr-3 text-right">{formatPercent(meanTax)}</td>
              <td className="py-1 text-right">{formatPercent(meanGrant)}</td>
            </tr>
          </tbody>
        </DataTable>
      </TableDetails>
    </figure>
  );
}
