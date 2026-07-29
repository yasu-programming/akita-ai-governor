'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';

const KEY = 'akita-ai-governor:disclaimer-ack';

/**
 * localStorage の同意フラグを外部ストアとして useSyncExternalStore に載せる。
 * これにより「マウント後に副作用内で setState する」必要がなくなり、
 * かつ静的書き出し（プリレンダー）時に localStorage へアクセスしない
 * （getServerSnapshot はブラウザ API に触れない）。
 */
let cachedAck: boolean | null = null;
const listeners = new Set<() => void>();

function readAck(): boolean {
  if (cachedAck === null) {
    cachedAck = window.localStorage.getItem(KEY) === '1';
  }
  return cachedAck;
}

function setAck(value: boolean) {
  cachedAck = value;
  window.localStorage.setItem(KEY, value ? '1' : '0');
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// プリレンダー・初回サーバー出力では未同意（モーダルを開かない = 素の HTML）とみなす。
// クライアント側で実際の値に同期し直される。
function getServerSnapshot(): boolean {
  return true;
}

export function DisclaimerModal() {
  const acknowledged = useSyncExternalStore(subscribe, readAck, getServerSnapshot);
  const open = !acknowledged;
  const acceptButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    acceptButtonRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAck(true);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open) return null;

  const accept = () => setAck(true);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900">
        <h2 id="disclaimer-title" className="text-lg font-semibold">
          はじめにお読みください
        </h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          <p>
            本アプリは「架空の AI が県政を担ったらどう判断するか」を、価値観の重み付けから
            機械的に導く思考実験です。現実の秋田県および県政、ならびに特定の個人・団体に対する
            評価や提言ではありません。
          </p>
          <p>
            財政・産業のデータは公的統計の実数です。一方、施策の効果として表示される数値は
            すべて本モデルが置いた仮定値であり、将来の予測ではありません。
          </p>
          <p>
            「政治的持続性」という軸は、公共選択論において政治家を「再選を目的関数に含む
            合理的主体」としてモデル化する枠組みに基づくものです。特定の人物の評価ではなく、
            制度設計を考えるための分析枠として扱っています。
          </p>
        </div>
        <button
          ref={acceptButtonRef}
          type="button"
          onClick={accept}
          className="mt-6 w-full rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          理解しました
        </button>
      </div>
    </div>
  );
}
