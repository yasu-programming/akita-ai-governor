import type { Metadata } from 'next';
import { ExpenseBars } from '@/components/charts/ExpenseBars';
import { IndustryComposition } from '@/components/charts/IndustryComposition';
import { PrefectureCompare } from '@/components/charts/PrefectureCompare';
import { RevenueScatter } from '@/components/charts/RevenueScatter';
import { fiscalData } from '@/lib/fiscal';
import { industryData } from '@/lib/industry';
import { FISCAL_AVERAGE_LABEL, INDUSTRY_AVERAGE_LABEL, sourceLine } from '@/lib/data-view';

export const metadata: Metadata = {
  title: '47都道府県データ｜AI Governor Lab 秋田',
  description:
    '47都道府県の歳入構成・歳出内訳・産業構成を公的統計で比較します。数値はすべて政府統計の実数です。',
};

const SECTIONS = [
  {
    id: 'revenue',
    title: '1. 歳入の構造',
    lead: '歳入のうち、自前の税収と国からの移転がそれぞれどれだけを占めるかを見ます。',
  },
  {
    id: 'expense',
    title: '2. 歳出の構造',
    lead: '同じ歳出区分について47都道府県を並べ、秋田県がどの位置にあるかを見ます。',
  },
  {
    id: 'industry',
    title: '3. 産業の構造',
    lead: '県内総生産に占める業種別の構成比を、全国と比べます。',
  },
  {
    id: 'compare',
    title: '4. 1県と並べて見る',
    lead: '秋田県と任意の1県を、同じ尺度で並べます。',
  },
] as const;

export default function DataPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          47都道府県データ
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          このページに出る数値は、すべて公的統計の実数です。シミュレーターの結果画面に出る
          仮定値とは性質が異なります。「全国」の意味はグラフごとに異なるため、
          財政のグラフでは{FISCAL_AVERAGE_LABEL}、産業のグラフでは{INDUSTRY_AVERAGE_LABEL}
          と明記しています。
        </p>
        <nav aria-label="このページの目次" className="mt-4">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="underline underline-offset-2">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <section id="revenue" className="scroll-mt-6 border-t border-neutral-200 pt-8 dark:border-neutral-800">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          {SECTIONS[0].title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          {SECTIONS[0].lead}
        </p>
        <div className="mt-6">
          <RevenueScatter />
        </div>
      </section>

      <section id="expense" className="scroll-mt-6 border-t border-neutral-200 pt-8 dark:border-neutral-800">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          {SECTIONS[1].title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          {SECTIONS[1].lead}
        </p>
        <div className="mt-6">
          <ExpenseBars />
        </div>
      </section>

      <section id="industry" className="scroll-mt-6 border-t border-neutral-200 pt-8 dark:border-neutral-800">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          {SECTIONS[2].title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          {SECTIONS[2].lead}
        </p>
        <div className="mt-6">
          <IndustryComposition />
        </div>
      </section>

      <section id="compare" className="scroll-mt-6 border-t border-neutral-200 pt-8 dark:border-neutral-800">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          {SECTIONS[3].title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          {SECTIONS[3].lead}
        </p>
        <div className="mt-6">
          <PrefectureCompare />
        </div>
      </section>

      <section className="border-t border-neutral-200 pt-8 dark:border-neutral-800">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">データ出典</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          {[fiscalData.meta, industryData.meta].map((meta) => (
            <li key={meta.sourceUrl}>
              {sourceLine(meta)}
              <br />
              <a
                href={meta.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all underline underline-offset-2"
              >
                {meta.sourceUrl}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          いずれも政府標準利用規約に基づき、出典を明記して利用しています。
          加工・整形は本アプリが行ったものであり、出典元が本アプリの内容を保証するものではありません。
        </p>
      </section>
    </div>
  );
}
