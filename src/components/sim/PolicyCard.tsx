import { HORIZON_LABELS, formatOku } from '@/lib/sim-view';
import type { Policy } from '@/lib/types';

type Props = {
  policy: Policy;
  /** 見送りカードで表示する理由。選定エンジンが返した reason をそのまま文言化したもの */
  note?: string;
  /** 見送りカード用の簡略表示 */
  compact?: boolean;
};

/**
 * 施策カード 1 枚の表示。
 * 想定コストは常に正の値で表示する。歳出を抑える施策も実施コストは発生し、
 * 財政面の効果は「効果の相対指標」側にのみ現れる（枠が戻るわけではない）。
 */
export function PolicyCard({ policy, note, compact = false }: Props) {
  return (
    <article
      className={
        'rounded-lg border p-4 ' +
        (compact
          ? 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/40'
          : 'border-neutral-200 dark:border-neutral-800')
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
          {policy.name}
        </h3>
        <div className="flex shrink-0 items-baseline gap-2 text-xs">
          <span className="rounded border border-neutral-300 px-1.5 py-0.5 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
            {HORIZON_LABELS[policy.horizon]}
          </span>
          <span className="text-neutral-700 tabular-nums dark:text-neutral-300">
            想定コスト {formatOku(policy.costOku)} 億円
          </span>
        </div>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        {policy.summary}
      </p>

      {note ? (
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">見送りの理由：{note}</p>
      ) : null}

      {compact ? null : (
        <div className="mt-3 space-y-3 border-t border-neutral-200 pt-3 text-sm dark:border-neutral-800">
          <div>
            <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              このカードが用意された理由
            </h4>
            <p className="mt-1 leading-relaxed text-neutral-700 dark:text-neutral-300">
              {policy.rationale}
            </p>
          </div>

          {policy.sideEffects.length > 0 ? (
            <div>
              <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                留意点
              </h4>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-neutral-700 dark:text-neutral-300">
                {policy.sideEffects.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {policy.evidence.length > 0 ? (
            <div>
              <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">出典</h4>
              <ul className="mt-1 space-y-0.5">
                {policy.evidence.map((e) => (
                  <li key={e.url}>
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-700 underline underline-offset-2 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
                    >
                      {e.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </article>
  );
}
