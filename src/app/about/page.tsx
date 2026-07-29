import type { Metadata } from 'next';
import { fiscalData, discretionaryBudgetOku, totalExpenseOku, getAkita } from '@/lib/fiscal';
import { industryData } from '@/lib/industry';

export const metadata: Metadata = {
  title: 'このアプリについて | AI Governor Lab 秋田',
  description: '前提・免責・データ出典。本アプリの位置づけと、選定アルゴリズム・裁量枠の考え方を説明します。',
};

const sources = [fiscalData.meta, industryData.meta];

const akita = getAkita();
const totalOku = Math.round(totalExpenseOku(akita));
const budgetOku = Math.round(discretionaryBudgetOku(akita));

export default function AboutPage() {
  return (
    <article className="max-w-3xl text-neutral-800 dark:text-neutral-200">
      <h1 className="text-2xl font-bold">このアプリについて</h1>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">1. このアプリは何か</h2>
        <p className="mt-2 leading-relaxed">
          AI Governor Lab 秋田は、「架空の AI が県政運営を担ったら、価値観の重み付けから
          どのような施策の組み合わせを導くか」を確かめるための思考実験です。5 つの軸
          （人口増加・経済成長・財政健全化・生活の質・政治的持続性）に対する重みを利用者が
          設定すると、あらかじめ用意された施策カードの束から、機械的な計算だけで
          パッケージが組み立てられます。人間の判断や外部の AI モデルによる推論は一切
          介在しません。すべての計算はブラウザ内で完結する決定論的なロジックであり、
          同じ入力からは常に同じ出力が得られます。
        </p>
        <p className="mt-2 leading-relaxed">
          あわせて、47 都道府県の財政・産業構造を比較できるデータ集も提供しています。
          こちらは公的統計をそのまま可視化したものであり、モデルによる仮定は含まれません。
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">2. 免責</h2>
        <p className="mt-2 leading-relaxed">
          本アプリは架空の AI モデルによる思考実験であり、現実の秋田県および県政、
          ならびに特定の個人・団体を評価・批評・提言するものではありません。施策カードの
          文面や採否は、実在の人物・団体を想起させないよう機械的なルールに基づいて構成
          しています。本アプリの内容を、現実の政策判断の根拠として用いないでください。
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">3. 数値の扱い</h2>
        <p className="mt-2 leading-relaxed">
          このアプリで表示される数値には、性質の異なる 2 種類があります。
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-6">
          <li>
            <strong>公的統計の実数</strong>
            ：財政データ（歳入・歳出の内訳など）と産業データ（業種別の県内総生産など）は、
            下記「6. データ出典」に示す公的統計をもとにした実際の数値です。
          </li>
          <li>
            <strong>本モデルの仮定値</strong>
            ：各施策カードのスコア（軸ごとの効果の大きさ）、想定コスト、およびシミュレーター
            が示す「効果」は、すべて本モデルが便宜的に置いた仮定値です。将来の予測では
            ありません。
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">4. 選定アルゴリズム</h2>
        <p className="mt-2 leading-relaxed">
          各施策カードのスコアは、5 つの軸それぞれについて「重み（0〜100）÷ 100 ×
          そのカードの軸別スコア」を計算し、5 軸分を合計して求めます。全カードをこの
          合計スコアの降順に並べ、スコアが同点の場合はカード ID の昇順で順序を確定します
          （乱数は使いません）。
        </p>
        <p className="mt-2 leading-relaxed">
          並べたカードを先頭から順に走査し、次のいずれかに該当するカードは採用せず、
          理由とともに見送ります。
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-6">
          <li>合計スコアが 0 以下（その重み付けでは採用する理由がない）</li>
          <li>同じ排他グループの先行カードが既に採用済み（同じ課題への別解が重複する）</li>
          <li>採用すると単年度の裁量枠を超える（財源が足りない）</li>
        </ul>
        <p className="mt-2 leading-relaxed">
          裁量枠を理由に見送られたカードがあっても走査はそこで止まりません。より
          想定コストの小さい後続カードが枠に収まるかどうかを、最後まで順に確認します。
        </p>
        <p className="mt-2 leading-relaxed">
          単年度で組み替え可能とみなす裁量枠は、歳出総額の 5%（
          <code>DISCRETIONARY_RATIO = 0.05</code>）としています。秋田県の実際の歳出総額
          （人口 1 人当たり歳出額 × 人口）は約 {totalOku.toLocaleString('ja-JP')} 億円で、
          その 5% にあたる約 {budgetOku.toLocaleString('ja-JP')} 億円を裁量枠として
          扱っています。この 5% という割合は、統計や条例など何らかの出典に基づく数値では
          なく、地方財政では人件費・扶助費・公債費といった義務的経費の比率が高く、
          単年度で自由に組み替えられる範囲がごく限られているという実務上の一般的傾向を
          反映した、本モデルの仮定値です。
        </p>
        <p className="mt-2 leading-relaxed">
          歳出を抑える方向の施策カードにも、実施のための想定コスト（正の値）が設定されて
          います。これらのカードがもたらす財政上の効果は、財政健全化の軸のスコアとして
          のみ反映され、採用時に裁量枠へ費用として計上される想定コストを相殺したり、
          枠を押し戻したりすることはありません。数値の整合性を確認する際はこの点に
          ご留意ください。
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">5. 「政治的持続性」という軸について</h2>
        <p className="mt-2 leading-relaxed">
          5 つの軸のうち「政治的持続性」は、公共選択論において政治的な意思決定の担い手を
          「再選を目的関数に含む合理的主体」としてモデル化する考え方に基づいています。
          これは特定の人物や集団の判断を評価・示唆するものではなく、制度設計を考えるための
          抽象的な分析枠として採用しているものです。この軸の重みを高くすると、短期間で
          成果が見えやすい施策が選ばれやすくなるという、モデル内部の傾向を表しています。
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">6. データ出典</h2>
        <p className="mt-2 leading-relaxed">
          財政・産業データはいずれも政府統計を、政府標準利用規約に基づいて利用しています。
        </p>
        <div className="mt-4 space-y-4">
          {sources.map((meta) => (
            <div
              key={meta.sourceUrl}
              className="rounded-md border border-neutral-200 p-4 text-sm dark:border-neutral-800"
            >
              <p className="font-medium">{meta.source}</p>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-neutral-600 dark:text-neutral-400">
                <dt>対象年度</dt>
                <dd>{meta.fiscalYear}</dd>
                <dt>URL</dt>
                <dd className="break-all">
                  <a href={meta.sourceUrl} className="underline underline-offset-2">
                    {meta.sourceUrl}
                  </a>
                </dd>
                <dt>利用規約</dt>
                <dd>{meta.license}</dd>
                <dt>取得日</dt>
                <dd>{meta.fetchedAt}</dd>
              </dl>
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}
