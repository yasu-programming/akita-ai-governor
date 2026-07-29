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
    try {
      cachedAck = window.localStorage.getItem(KEY) === '1';
    } catch {
      // localStorage が利用できない環境（Cookie/ストレージ拒否、sandboxed iframe 等）では
      // 未同意として扱う。ここで例外を投げるとルートレイアウトのハイドレーションが
      // 丸ごと失敗しアプリ全体が白紙になるため、フォールバックが必須。
      cachedAck = false;
    }
  }
  return cachedAck;
}

// 状態更新とリスナー通知は、永続化の成否に関わらず必ず行う。setItem が失敗しても
// モーダルは通常どおり閉じられなければならない（さもないと z-50 のオーバーレイに
// ユーザーが閉じ込められる）。永続化したくない呼び出し元（Escape）は persist=false を渡す。
function setAck(value: boolean, persist: boolean) {
  cachedAck = value;
  if (persist) {
    try {
      window.localStorage.setItem(KEY, value ? '1' : '0');
    } catch {
      // 永続化に失敗しても、以下の通知は必ず実行する。
    }
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// プリレンダー・初回サーバー出力では同意済み（モーダルを開かない = 素の HTML）とみなす。
// クライアント側で実際の値（未同意なら true から false へ）に同期し直される。
function getServerSnapshot(): boolean {
  return true;
}

export function DisclaimerModal() {
  const acknowledged = useSyncExternalStore(subscribe, readAck, getServerSnapshot);
  const open = !acknowledged;
  const acceptButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    acceptButtonRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Escape は今回の表示に限りモーダルを閉じるだけで、同意としては永続化しない。
        setAck(true, false);
        return;
      }
      if (e.key === 'Tab') {
        // 最小構成のフォーカストラップ：ダイアログ内のフォーカス可能要素だけを巡回させる。
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === first || !dialogRef.current?.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last || !dialogRef.current?.contains(active)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open) return null;

  const accept = () => setAck(true, true);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div ref={dialogRef} className="max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900">
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
