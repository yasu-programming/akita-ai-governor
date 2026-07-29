'use client';

import { AXES } from '@/lib/constants';
import type { AxisKey, Weights } from '@/lib/types';

type Props = {
  weights: Weights;
  onChange: (key: AxisKey, value: number) => void;
};

/**
 * 5 つの価値観の重みを 0〜100 で入力するスライダー群。
 *
 * tooltip を持つ軸は、その説明を常時表示する。ホバーでしか読めない実装
 * （title 属性など）は、指で操作する端末で読めなくなるため採らない。
 */
export function AxisSliders({ weights, onChange }: Props) {
  return (
    <div className="space-y-3">
      {AXES.map((axis) => {
        const value = weights[axis.key];
        const noteId = `${axis.key}-note`;
        return (
          <div
            key={axis.key}
            className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <div>
                <label
                  htmlFor={`axis-${axis.key}`}
                  className="text-base font-medium text-neutral-900 dark:text-neutral-100"
                >
                  {axis.label}
                </label>
                <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                  {axis.subtitle}
                </p>
              </div>
              <output
                htmlFor={`axis-${axis.key}`}
                className="text-2xl font-semibold text-neutral-900 tabular-nums dark:text-neutral-100"
              >
                {value}
              </output>
            </div>

            <input
              id={`axis-${axis.key}`}
              type="range"
              min={0}
              max={100}
              step={5}
              value={value}
              aria-label={axis.label}
              aria-describedby={axis.tooltip ? noteId : undefined}
              onChange={(e) => onChange(axis.key, Number(e.target.value))}
              className="mt-3 w-full cursor-pointer"
              style={{ accentColor: 'var(--viz-series-1)' }}
            />
            <div className="flex justify-between text-[11px] text-neutral-500 dark:text-neutral-500">
              <span>0（重視しない）</span>
              <span>100（最重視）</span>
            </div>

            {axis.tooltip ? (
              <p
                id={noteId}
                className="mt-3 rounded-md bg-neutral-100 px-3 py-2 text-xs leading-relaxed text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
              >
                {axis.tooltip}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
