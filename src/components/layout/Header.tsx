import Link from 'next/link';

const NAV = [
  { href: '/', label: 'シミュレーター' },
  { href: '/data/', label: '47都道府県データ' },
  { href: '/about/', label: 'このアプリについて' },
];

export function Header() {
  return (
    <header className="border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
      <div className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-x-6 gap-y-2">
        <Link href="/" className="text-lg font-semibold">
          AI Governor Lab 秋田
        </Link>
        <nav className="flex gap-4 text-sm">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:underline underline-offset-4">
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
