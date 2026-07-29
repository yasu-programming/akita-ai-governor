'use client';

/**
 * チャート共通のホバー表示。/ と /data の両方で使う共有部品。
 *
 * dataviz の規約に合わせてある:
 *  - 値を主、系列名を従にする（読み手は系列を知っていて数値を知りたい）
 *  - 系列の識別は短い線キーで示し、文字そのものには系列色を塗らない
 *  - ここに出る値は必ず表（表形式の内訳）からも読める。ホバーが唯一の経路にはしない
 *
 * Recharts の `content` は ReactElement を受け取り、内部で cloneElement して
 * active / payload / label を注入する。そのため下のプロパティはすべて任意にしてある。
 */
export type ChartTooltipEntry = {
  name?: number | string;
  value?: number | string | ReadonlyArray<number | string>;
  color?: string;
  fill?: string;
  /** その行の元データ。散布図など label を持たないチャートで見出しに使う */
  payload?: Record<string, unknown>;
};

type Props = {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<ChartTooltipEntry>;
  /** 値の書式。単位はここで付ける */
  format: (value: number) => string;
  /** 値が 0 の行を出さない（正負で系列を分けたチャート用） */
  hideZero?: boolean;
  /**
   * 見出しを元データのこのキーから取る。
   * 散布図（label を持たない）や、軸ラベルだけ短縮しているチャート
   * （軸は短縮名、ホバーと表は正式名称）で使う。
   */
  labelKey?: string;
};

function headingOf(
  label: string | number | undefined,
  payload: ReadonlyArray<ChartTooltipEntry>,
  labelKey?: string,
): string | undefined {
  if (labelKey) {
    const raw = payload[0]?.payload?.[labelKey];
    if (typeof raw === 'string' || typeof raw === 'number') return String(raw);
  }
  return label === undefined ? undefined : String(label);
}

export function ChartTooltip({ active, label, payload, format, hideZero = false, labelKey }: Props) {
  if (!active || !payload || payload.length === 0) return null;

  const heading = headingOf(label, payload, labelKey);

  const rows = payload
    .map((entry) => ({
      name: typeof entry.name === 'string' || typeof entry.name === 'number' ? String(entry.name) : '',
      value: Number(entry.value),
      color: entry.color ?? entry.fill ?? 'var(--viz-series-1)',
    }))
    .filter((row) => Number.isFinite(row.value) && (!hideZero || row.value !== 0));

  if (rows.length === 0) return null;

  return (
    <div
      className="rounded-md border px-3 py-2 text-xs shadow-sm"
      style={{
        background: 'var(--viz-surface)',
        borderColor: 'var(--viz-axis)',
        color: 'var(--viz-ink)',
      }}
    >
      {heading === undefined ? null : (
        <p className="mb-1 font-medium" style={{ color: 'var(--viz-ink-secondary)' }}>
          {heading}
        </p>
      )}
      <ul className="space-y-0.5">
        {rows.map((row, index) => (
          <li key={index} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-0.5 w-3 rounded-full"
              style={{ background: row.color }}
            />
            <span className="font-semibold tabular-nums" style={{ color: 'var(--viz-ink)' }}>
              {format(row.value)}
            </span>
            <span style={{ color: 'var(--viz-ink-secondary)' }}>{row.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
