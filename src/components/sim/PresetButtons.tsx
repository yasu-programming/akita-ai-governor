'use client';

import { PRESETS } from '@/lib/constants';
import { matchingPresetId } from '@/lib/sim-view';
import type { Weights } from '@/lib/types';

type Props = {
  weights: Weights;
  onSelect: (weights: Weights) => void;
};

/**
 * 代表的な価値観の組み合わせをワンタッチで入れるボタン群。
 * 現在の重みがいずれかのプリセットと完全一致していれば、そのボタンを選択状態にする。
 */
export function PresetButtons({ weights, onSelect }: Props) {
  const activeId = matchingPresetId(weights);

  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map((preset) => {
        const active = preset.id === activeId;
        return (
          <button
            key={preset.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(preset.weights)}
            className={
              'rounded-full border px-4 py-2 text-left text-sm transition-colors ' +
              (active
                ? 'border-transparent bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                : 'border-neutral-300 text-neutral-800 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900')
            }
          >
            <span className="font-medium">{preset.label}</span>
            <span
              className={
                'ml-2 text-xs ' +
                (active
                  ? 'text-neutral-300 dark:text-neutral-600'
                  : 'text-neutral-500 dark:text-neutral-400')
              }
            >
              {preset.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
