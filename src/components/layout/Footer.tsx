export function Footer() {
  return (
    <footer className="mt-16 border-t border-neutral-200 bg-neutral-50 px-6 py-8 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
      <p className="mx-auto max-w-4xl leading-relaxed">
        本アプリは架空の AI モデルによる思考実験であり、現実の秋田県および県政、
        ならびに特定の個人・団体とは一切関係がありません。
        表示される数値はすべて本モデルの仮定値であり、将来の予測ではありません。
      </p>
      <p className="mx-auto mt-3 max-w-4xl">
        <a href="/about/" className="underline underline-offset-2">
          前提・免責・データ出典
        </a>
      </p>
    </footer>
  );
}
