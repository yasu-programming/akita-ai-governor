import { sourceLine, type DatasetMeta } from '@/lib/data-view';

/**
 * チャートを組み立てる小さな部品。
 * フックを持たないので、Server Component からも Client Component からも使える。
 */

/**
 * 凡例。2 系列以上のチャートには必ず置く（色だけに識別を頼らせない）。
 * 棒・面は四角、線は短い線、点は丸でマークの形をそのまま写す。
 */
export type LegendItem = {
  label: string;
  color: string;
  shape?: 'rect' | 'line' | 'dot';
};

export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-700 dark:text-neutral-300">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={
              item.shape === 'line'
                ? 'inline-block h-0.5 w-3.5 rounded-full'
                : item.shape === 'dot'
                  ? 'inline-block h-2.5 w-2.5 rounded-full'
                  : 'inline-block h-2.5 w-2.5 rounded-[2px]'
            }
            style={{ background: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * 出典表記。必ず meta から組み立てる（文字列の直書きは禁止）。
 * 公的統計を使った系列には、そのチャートのすぐ脇にこれを置く。
 */
export function SourceNote({ meta, prefix = '出典：' }: { meta: DatasetMeta; prefix?: string }) {
  return (
    <p className="mt-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
      {prefix}
      {sourceLine(meta)}
    </p>
  );
}

/**
 * チャートと同じ数値を読める表。チャート本体は aria-hidden にしてあり、
 * 支援技術からはこちらが正規の経路になる。
 */
export function TableDetails({
  summary = '数値を表で見る',
  minWidth = '20rem',
  children,
}: {
  summary?: string;
  minWidth?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-neutral-600 underline underline-offset-2 dark:text-neutral-400">
        {summary}
      </summary>
      <div className="mt-2 overflow-x-auto">
        <div style={{ minWidth }}>{children}</div>
      </div>
    </details>
  );
}

/** 表の共通スタイル */
export function DataTable({ children }: { children: React.ReactNode }) {
  return <table className="w-full text-left text-xs tabular-nums">{children}</table>;
}

/** セレクタ類を 1 行にまとめる。チャートの上に置く */
export function FilterRow({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-3">{children}</div>;
}

/** ラベル付きの <select>。ホバーだけに頼る title は使わない */
export function SelectField({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-[15rem] rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      >
        {children}
      </select>
    </div>
  );
}
