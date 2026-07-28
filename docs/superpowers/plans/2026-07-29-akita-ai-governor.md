# AI Governor Lab 秋田 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 価値観の重み付けから施策パッケージを生成するシミュレーターと、47都道府県の財政・産業構造の比較ビューを、単一の静的 Next.js アプリとして構築し Vercel にデプロイする。

**Architecture:** 公的統計 Excel を手動実行のスクリプトで JSON に変換してリポジトリにコミットする。アプリは実行時に外部 API を呼ばず、静的エクスポートされたページ内で決定論的なスコアリングを行う。施策の文面は全て事前執筆され、JSON に格納される。

**Tech Stack:** Next.js 15 (App Router, `output: 'export'`), TypeScript, Tailwind CSS v4, Recharts, SheetJS (`xlsx`, スクリプト専用), Vitest, GitHub Actions, Vercel

## Global Constraints

- 実行時に LLM API・外部 API・データベースを一切使用しない。全ページは静的エクスポート可能でなければならない
- `next.config.ts` は `output: 'export'` を設定する。Server Actions、Route Handlers、`dynamic = 'force-dynamic'` を使用しない
- 施策カード文面および全 UI 文言に、実在の人物名・政党名・企業名・団体名を含めない
- 指標の変化を「予測」と表現しない。「本モデルの仮定値」と明記する
- 選挙・候補者・投票・政党に関する示唆を一切含めない
- 全ページのフッターに免責文を表示する
- データ出典と政府標準利用規約に基づく利用である旨を `/about` に明記する
- `scripts/` 配下は Vercel のビルド時に実行しない。`package.json` の `build` スクリプトから呼ばない
- 秋田県の都道府県コードは `05`。総務省ファイル ID は `000999234`
- 通貨単位: 財政データは「人口1人当たり円」、産業データは「100万円」。混同しないこと

---

## File Structure

```
akita-ai-governor/
├─ next.config.ts                    静的エクスポート設定
├─ vitest.config.ts
├─ .github/workflows/ci.yml          lint / typecheck / test / build / 禁止語チェック
├─ scripts/
│  ├─ fetch-fiscal.ts                総務省47ファイル → src/data/fiscal.json
│  ├─ fetch-industry.ts              内閣府 syuyo1 → src/data/industry.json
│  └─ check-forbidden-words.ts       禁止語チェック（CI から実行）
├─ src/
│  ├─ data/
│  │  ├─ fiscal.json                 生成物・コミットする
│  │  ├─ industry.json               生成物・コミットする
│  │  └─ policies.json               手書き・施策カード
│  ├─ lib/
│  │  ├─ types.ts                    全ドメイン型
│  │  ├─ constants.ts                軸定義・プリセット・禁止語リスト
│  │  ├─ simulate.ts                 選定アルゴリズム（純粋関数）
│  │  ├─ fiscal.ts                   fiscal.json 読み出しヘルパ
│  │  └─ industry.ts                 industry.json 読み出しヘルパ
│  ├─ components/
│  │  ├─ layout/                     Header, Footer, DisclaimerModal
│  │  ├─ sim/                        AxisSliders, PresetButtons, ResultPanel,
│  │  │                              PolicyCard, RejectedPolicies, BudgetShift, TradeoffChart
│  │  └─ charts/                     RevenueScatter, ExpenseBars, IndustryComposition, PrefectureCompare
│  └─ app/
│     ├─ layout.tsx                  Header/Footer/DisclaimerModal を全ページに適用
│     ├─ page.tsx                    シミュレーター
│     ├─ data/page.tsx               47都道府県データ
│     └─ about/page.tsx              前提・免責・出典
└─ tests/
   ├─ simulate.test.ts
   ├─ data-integrity.test.ts
   └─ forbidden-words.test.ts
```

---

### Task 1: プロジェクト初期化と静的エクスポートの土台

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `vitest.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `tests/smoke.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `npm run build` が `out/` に静的ファイルを生成する。`npm test` が Vitest を実行する。

- [ ] **Step 1: Next.js プロジェクトを作成**

```bash
cd /home/yasu/akita-ai-governor
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir --import-alias "@/*" --no-turbopack --yes
```

既存の `docs/` と `.gitignore` は保持されること。`src/app/page.tsx` は後で上書きする。

- [ ] **Step 2: テスト環境を追加**

```bash
npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
npm i recharts
```

`vitest.config.ts` を作成:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});
```

`package.json` の `scripts` に追加:

```json
"test": "vitest run",
"test:watch": "vitest",
"typecheck": "tsc --noEmit",
"check:words": "tsx scripts/check-forbidden-words.ts"
```

- [ ] **Step 3: 静的エクスポートを設定**

`next.config.ts`:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
```

- [ ] **Step 4: スモークテストを書いて失敗を確認**

`tests/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import config from '../next.config';

describe('build configuration', () => {
  it('exports a fully static site', () => {
    expect(config.output).toBe('export');
  });

  it('disables image optimization so no runtime function is needed', () => {
    expect(config.images?.unoptimized).toBe(true);
  });
});
```

Run: `npm test`
Expected: PASS（設定済みのため）。FAIL する場合は Step 3 の設定漏れ。

- [ ] **Step 5: ビルドが静的出力を生むことを確認**

Run: `npm run build && ls out/index.html`
Expected: `out/index.html` が存在する

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: Next.js 静的エクスポートとテスト環境の土台を用意"
```

---

### Task 2: 財政データ取り込みスクリプト

**Files:**
- Create: `scripts/fetch-fiscal.ts`, `src/lib/types.ts`, `src/data/fiscal.json`
- Test: `tests/data-integrity.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `src/data/fiscal.json`（`FiscalDataset` 型）、`src/lib/types.ts` の `FiscalDataset` / `PrefectureFiscal` 型

**背景（検証済みの Excel 構造）**

総務省「令和5年度都道府県財政指数表」第7章。ファイル ID は `000999230`（北海道、都道府県コード01）から連番で `000999276`（沖縄県、コード47）まで。URL は `https://www.soumu.go.jp/main_content/<ID>.xlsx`。

各ファイルは 3 シート:

| シート index | 内容 | ラベル列 | 決算額列 | 構成比列 |
|---|---|---|---|---|
| 0 | 収入の状況 | 13 | 15 | 22 |
| 1 | 性質別歳出の状況 | 13 | 16 | 22 |
| 2 | 目的別、性質別歳出及び充当財源の状況 | 13 | — | — （歳出計は列 30） |

- シート0: 行6 の列0 に県名。行15〜41 が費目、行42 が「歳入合計」。行47 の列14 に住民基本台帳人口、列17 に面積、列21/23/25 に第1次/第2次/第3次産業の比率(%)
- シート1: 行15〜37 が費目、行38 が「歳出合計」
- シート2: 列13 が非数値文字列の行が大区分（総務費・民生費・衛生費・労働費・農林水産業費・商工費・土木費・警察費・消防費・教育費・災害復旧費・公債費など）。列30 が歳出計
- 数値セルに `"-"`（文字列ハイフン）が入ることがある。0 として扱う

- [ ] **Step 1: 型を定義**

`src/lib/types.ts`:

```ts
export type PrefectureFiscal = {
  code: string;   // "05"
  name: string;   // "秋田県"
  population: number;      // 人
  areaKm2: number;         // k㎡
  industryShare: { primary: number; secondary: number; tertiary: number }; // %
  /** 人口1人当たり円 */
  revenue: Record<string, number>;
  revenueShare: Record<string, number>;   // %
  revenueTotal: number;                   // 人口1人当たり円
  /** 人口1人当たり円 */
  expenseByNature: Record<string, number>;
  expenseByNatureShare: Record<string, number>;  // %
  expenseTotal: number;                   // 人口1人当たり円
  /** 人口1人当たり円 */
  expenseByPurpose: Record<string, number>;
};

export type FiscalDataset = {
  meta: {
    fiscalYear: string;
    source: string;
    sourceUrl: string;
    license: string;
    fetchedAt: string;
  };
  prefectures: PrefectureFiscal[];
};
```

- [ ] **Step 2: 整合性テストを書いて失敗を確認**

`tests/data-integrity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import fiscal from '../src/data/fiscal.json';
import type { FiscalDataset } from '../src/lib/types';

const data = fiscal as FiscalDataset;

describe('fiscal.json', () => {
  it('covers all 47 prefectures with unique sequential codes', () => {
    expect(data.prefectures).toHaveLength(47);
    const codes = data.prefectures.map((p) => p.code);
    expect(new Set(codes).size).toBe(47);
    expect(codes[0]).toBe('01');
    expect(codes[46]).toBe('47');
  });

  it('records Akita at code 05', () => {
    const akita = data.prefectures.find((p) => p.code === '05');
    expect(akita?.name).toBe('秋田県');
    expect(akita?.population).toBeGreaterThan(800_000);
    expect(akita?.population).toBeLessThan(1_100_000);
  });

  it('has revenue shares summing to about 100% for every prefecture', () => {
    for (const p of data.prefectures) {
      const sum = Object.values(p.revenueShare).reduce((a, b) => a + b, 0);
      expect(sum, p.name).toBeGreaterThan(97);
      expect(sum, p.name).toBeLessThan(103);
    }
  });

  it('has expense-by-nature shares summing to about 100% for every prefecture', () => {
    for (const p of data.prefectures) {
      const sum = Object.values(p.expenseByNatureShare).reduce((a, b) => a + b, 0);
      expect(sum, p.name).toBeGreaterThan(97);
      expect(sum, p.name).toBeLessThan(103);
    }
  });

  it('records positive totals and non-negative components', () => {
    for (const p of data.prefectures) {
      expect(p.revenueTotal, p.name).toBeGreaterThan(0);
      expect(p.expenseTotal, p.name).toBeGreaterThan(0);
      expect(Object.values(p.expenseByPurpose).every((v) => v >= 0), p.name).toBe(true);
    }
  });

  it('cites its source and license', () => {
    expect(data.meta.source).toContain('総務省');
    expect(data.meta.license).toContain('政府標準利用規約');
    expect(data.meta.sourceUrl).toMatch(/^https:\/\/www\.soumu\.go\.jp\//);
  });
});
```

Run: `npx vitest run tests/data-integrity.test.ts`
Expected: FAIL — `Cannot find module '../src/data/fiscal.json'`

- [ ] **Step 3: 取り込みスクリプトを実装**

```bash
npm i -D tsx xlsx
```

`scripts/fetch-fiscal.ts`:

```ts
/**
 * 総務省「令和5年度都道府県財政指数表」第7章 都道府県別資料を取得し
 * src/data/fiscal.json を生成する。
 *
 * 手動実行専用。Vercel のビルド時には実行しない。
 *   npx tsx scripts/fetch-fiscal.ts
 */
import * as XLSX from 'xlsx';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { FiscalDataset, PrefectureFiscal } from '../src/lib/types';

const FIRST_FILE_ID = 999230; // 北海道（都道府県コード 01）
const SOURCE_PAGE = 'https://www.soumu.go.jp/iken/ruiji/todohuken_r05.html';
const OUT = path.resolve(__dirname, '../src/data/fiscal.json');

/** 総務省ファイルの数値セルは "-" が入ることがある */
function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function label(v: unknown): string {
  return typeof v === 'string' ? v.replace(/[\s　]/g, '') : '';
}

type Grid = (unknown | null)[][];

function sheetGrid(wb: XLSX.WorkBook, index: number): Grid {
  const ws = wb.Sheets[wb.SheetNames[index]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as Grid;
}

/** 収入の状況（シート0） */
function parseRevenue(g: Grid) {
  const revenue: Record<string, number> = {};
  const revenueShare: Record<string, number> = {};
  let revenueTotal = 0;

  // 集計行・内訳行は除外し、大区分のみ取る
  const SKIP = new Set(['小計', '歳入合計', '決算額構成比(%)']);

  for (let r = 15; r <= 42; r++) {
    const row = g[r] ?? [];
    const name = label(row[13]);
    if (!name) continue;
    if (name === '歳入合計') {
      revenueTotal = num(row[15]);
      continue;
    }
    if (SKIP.has(name)) continue;
    // 内訳行は列12 が番号を持たない。大区分のみ列12 に番号がある
    const marker = row[12];
    const isTopLevel = marker != null && /^\d+$/.test(String(marker).trim());
    if (!isTopLevel) continue;
    revenue[name] = num(row[15]);
    revenueShare[name] = num(row[22]);
  }

  // 参考欄（行47）: 人口・面積・産業構造
  const ref = g[47] ?? [];
  const population = num(ref[14]);
  const areaKm2 = num(ref[17]);
  const industryShare = {
    primary: num(ref[21]),
    secondary: num(ref[23]),
    tertiary: num(ref[25]),
  };

  return { revenue, revenueShare, revenueTotal, population, areaKm2, industryShare };
}

/** 性質別歳出の状況（シート1） */
function parseExpenseByNature(g: Grid) {
  const expenseByNature: Record<string, number> = {};
  const expenseByNatureShare: Record<string, number> = {};
  let expenseTotal = 0;

  // 構成比の合計が 100 になる大区分のみを採る
  const TOP_LEVEL = [
    '人件費(ａ)', '物件費', '維持補修費', '扶助費', '補助費等', '公債費',
    '積立金', '投資及び出資金', '貸付金', '繰出金', '投資的経費', '前年度繰上充用金',
  ];
  const DISPLAY: Record<string, string> = { '人件費(ａ)': '人件費' };

  for (let r = 15; r <= 40; r++) {
    const row = g[r] ?? [];
    const name = label(row[13]);
    if (!name) continue;
    if (name === '歳出合計') {
      expenseTotal = num(row[16]);
      continue;
    }
    if (!TOP_LEVEL.includes(name)) continue;
    const key = DISPLAY[name] ?? name;
    expenseByNature[key] = num(row[16]);
    expenseByNatureShare[key] = num(row[22]);
  }

  return { expenseByNature, expenseByNatureShare, expenseTotal };
}

/** 目的別歳出（シート2）。列13 が非数値の行が大区分、列30 が歳出計 */
function parseExpenseByPurpose(g: Grid): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of g) {
    const name = label((row ?? [])[13]);
    if (!name) continue;
    if (!name.endsWith('費')) continue;
    if (/^\d/.test(name)) continue;
    if (name in out) continue;
    out[name] = num((row ?? [])[30]);
  }
  return out;
}

async function fetchPrefecture(code: number): Promise<PrefectureFiscal> {
  const id = FIRST_FILE_ID + (code - 1);
  const url = `https://www.soumu.go.jp/main_content/000${id}.xlsx`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const wb = XLSX.read(Buffer.from(await res.arrayBuffer()), { type: 'buffer' });

  const s0 = sheetGrid(wb, 0);
  const name = label(s0[6]?.[0]);
  if (!name.endsWith('都') && !name.endsWith('道') && !name.endsWith('府') && !name.endsWith('県')) {
    throw new Error(`prefecture name not found in ${url}: got "${name}"`);
  }

  const rev = parseRevenue(s0);
  const nat = parseExpenseByNature(sheetGrid(wb, 1));
  const pur = parseExpenseByPurpose(sheetGrid(wb, 2));

  return {
    code: String(code).padStart(2, '0'),
    name,
    population: rev.population,
    areaKm2: rev.areaKm2,
    industryShare: rev.industryShare,
    revenue: rev.revenue,
    revenueShare: rev.revenueShare,
    revenueTotal: rev.revenueTotal,
    expenseByNature: nat.expenseByNature,
    expenseByNatureShare: nat.expenseByNatureShare,
    expenseTotal: nat.expenseTotal,
    expenseByPurpose: pur,
  };
}

async function main() {
  const prefectures: PrefectureFiscal[] = [];
  for (let code = 1; code <= 47; code++) {
    const p = await fetchPrefecture(code);
    prefectures.push(p);
    console.log(`${p.code} ${p.name} 歳入計=${p.revenueTotal} 歳出計=${p.expenseTotal}`);
    await new Promise((r) => setTimeout(r, 300)); // 相手サーバへの配慮
  }

  const dataset: FiscalDataset = {
    meta: {
      fiscalYear: '令和5年度',
      source: '総務省「令和5年度都道府県財政指数表」第7章 都道府県別資料',
      sourceUrl: SOURCE_PAGE,
      license: '政府標準利用規約（第2.0版）',
      fetchedAt: new Date().toISOString().slice(0, 10),
    },
    prefectures,
  };

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(dataset, null, 2) + '\n', 'utf8');
  console.log(`wrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 4: スクリプトを実行してデータを生成**

Run: `npx tsx scripts/fetch-fiscal.ts`
Expected: 47 行のログが出て `05 秋田県 歳入計=637659 歳出計=618279` を含む。`src/data/fiscal.json` が生成される。

- [ ] **Step 5: 整合性テストが通ることを確認**

Run: `npx vitest run tests/data-integrity.test.ts`
Expected: PASS（6 テスト）

構成比の合計が範囲外になる県があれば、`parseRevenue` の大区分判定（列12 の番号有無）を実データで再確認して直す。

- [ ] **Step 6: Commit**

```bash
git add scripts/fetch-fiscal.ts src/lib/types.ts src/data/fiscal.json tests/data-integrity.test.ts package.json package-lock.json
git commit -m "feat: 総務省の都道府県財政データ取り込みスクリプトとデータセットを追加"
```

---

### Task 3: 産業データ取り込みスクリプト

**Files:**
- Create: `scripts/fetch-industry.ts`, `src/data/industry.json`
- Modify: `src/lib/types.ts`（`IndustryDataset` を追加）
- Test: `tests/data-integrity.test.ts`（産業データの describe ブロックを追加）

**Interfaces:**
- Consumes: `src/lib/types.ts`
- Produces: `src/data/industry.json`（`IndustryDataset` 型）

**背景（検証済みの Excel 構造）**

内閣府 経済社会総合研究所「県民経済計算」主要系列表1「経済活動別県内総生産（名目）」。
URL: `https://www.esri.cao.go.jp/jp/sna/data/data_list/kenmin/files/contents/tables/2022/syuyo1.xlsx`

12 シート（2011〜2022年度）。各シートは 4 ブロックが横に並ぶ構成。データ行は列0 に都道府県コード、列1 に県名。行8 から 47 行が都道府県データ。単位は 100万円。

大分類の列位置（行4 のヘッダ位置と一致）:

| 列 | 部門 |
|---|---|
| 3 | 農林水産業 |
| 7 | 鉱業 |
| 8 | 製造業 |
| 29 | 電気・ガス・水道・廃棄物処理業 |
| 32 | 建設業 |
| 33 | 卸売・小売業 |
| 41 | 運輸・郵便業 |
| 42 | 宿泊・飲食サービス業 |
| 43 | 情報通信業 |
| 46 | 金融・保険業 |
| 47 | 不動産業 |
| 50 | 専門・科学技術、業務支援サービス業 |
| 51 | 公務 |
| 52 | 教育 |
| 53 | 保健衛生・社会事業 |
| 54 | その他のサービス |
| 60 | 小計 |
| 63 | 県内総生産 |
| 64 / 65 / 66 | 第1次 / 第2次 / 第3次産業 |

- [ ] **Step 1: 型を追加**

`src/lib/types.ts` の末尾に追加:

```ts
export type PrefectureIndustry = {
  code: string;
  name: string;
  /** 単位: 100万円 */
  gdpBySector: Record<string, number>;
  gdpTotal: number;
  primary: number;
  secondary: number;
  tertiary: number;
};

export type IndustryDataset = {
  meta: {
    fiscalYear: string;
    source: string;
    sourceUrl: string;
    license: string;
    fetchedAt: string;
  };
  sectors: string[];
  /** キーは年度の西暦（"2022" など）。最新年度が `latestYear` */
  latestYear: string;
  years: Record<string, PrefectureIndustry[]>;
};
```

- [ ] **Step 2: 整合性テストを書いて失敗を確認**

`tests/data-integrity.test.ts` の末尾に追加:

```ts
import industry from '../src/data/industry.json';
import type { IndustryDataset } from '../src/lib/types';

const ind = industry as IndustryDataset;

describe('industry.json', () => {
  it('exposes 2022 as the latest year', () => {
    expect(ind.latestYear).toBe('2022');
    expect(Object.keys(ind.years)).toContain('2011');
    expect(Object.keys(ind.years)).toContain('2022');
  });

  it('covers all 47 prefectures in every year', () => {
    for (const [year, list] of Object.entries(ind.years)) {
      expect(list, year).toHaveLength(47);
    }
  });

  it('lists 16 sectors', () => {
    expect(ind.sectors).toHaveLength(16);
    expect(ind.sectors).toContain('農林水産業');
    expect(ind.sectors).toContain('製造業');
    expect(ind.sectors).toContain('保健衛生・社会事業');
  });

  it('records Akita 2022 with a plausible gross product', () => {
    const akita = ind.years['2022'].find((p) => p.code === '05');
    expect(akita?.name).toBe('秋田県');
    // 単位は100万円。秋田県の県内総生産はおよそ3.6兆円
    expect(akita!.gdpTotal).toBeGreaterThan(3_000_000);
    expect(akita!.gdpTotal).toBeLessThan(4_500_000);
  });

  it('has primary + secondary + tertiary close to the sector subtotal', () => {
    for (const p of ind.years['2022']) {
      const three = p.primary + p.secondary + p.tertiary;
      const sectors = Object.values(p.gdpBySector).reduce((a, b) => a + b, 0);
      expect(Math.abs(three - sectors) / sectors, p.name).toBeLessThan(0.02);
    }
  });

  it('cites its source and license', () => {
    expect(ind.meta.source).toContain('県民経済計算');
    expect(ind.meta.license).toContain('政府標準利用規約');
  });
});
```

Run: `npx vitest run tests/data-integrity.test.ts`
Expected: FAIL — `Cannot find module '../src/data/industry.json'`

- [ ] **Step 3: 取り込みスクリプトを実装**

`scripts/fetch-industry.ts`:

```ts
/**
 * 内閣府「県民経済計算」主要系列表1（経済活動別県内総生産・名目）を取得し
 * src/data/industry.json を生成する。
 *
 * 手動実行専用。
 *   npx tsx scripts/fetch-industry.ts
 */
import * as XLSX from 'xlsx';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { IndustryDataset, PrefectureIndustry } from '../src/lib/types';

const URL =
  'https://www.esri.cao.go.jp/jp/sna/data/data_list/kenmin/files/contents/tables/2022/syuyo1.xlsx';
const SOURCE_PAGE =
  'https://www.esri.cao.go.jp/jp/sna/data/data_list/kenmin/files/contents/main_2022.html';
const OUT = path.resolve(__dirname, '../src/data/industry.json');

/** 行4 のヘッダ位置に対応する大分類の列 */
const SECTOR_COLUMNS: [string, number][] = [
  ['農林水産業', 3],
  ['鉱業', 7],
  ['製造業', 8],
  ['電気・ガス・水道・廃棄物処理業', 29],
  ['建設業', 32],
  ['卸売・小売業', 33],
  ['運輸・郵便業', 41],
  ['宿泊・飲食サービス業', 42],
  ['情報通信業', 43],
  ['金融・保険業', 46],
  ['不動産業', 47],
  ['専門・科学技術、業務支援サービス業', 50],
  ['公務', 51],
  ['教育', 52],
  ['保健衛生・社会事業', 53],
  ['その他のサービス', 54],
];
const COL_TOTAL = 63;
const COL_PRIMARY = 64;
const COL_SECONDARY = 65;
const COL_TERTIARY = 66;

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** "2022（令和4）年度" -> "2022" */
function yearOf(sheetName: string): string {
  const m = sheetName.match(/^(\d{4})/);
  if (!m) throw new Error(`unexpected sheet name: ${sheetName}`);
  return m[1];
}

async function main() {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`${URL} -> HTTP ${res.status}`);
  const wb = XLSX.read(Buffer.from(await res.arrayBuffer()), { type: 'buffer' });

  const years: Record<string, PrefectureIndustry[]> = {};

  for (const sheetName of wb.SheetNames) {
    const year = yearOf(sheetName);
    const grid = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1,
      raw: true,
      defval: null,
    }) as (unknown | null)[][];

    const list: PrefectureIndustry[] = [];
    for (const row of grid) {
      const code = row?.[0];
      const name = row?.[1];
      if (typeof name !== 'string' || !/[都道府県]$/.test(name)) continue;
      const codeStr = String(code).padStart(2, '0');
      if (!/^\d{2}$/.test(codeStr)) continue;

      const gdpBySector: Record<string, number> = {};
      for (const [sector, col] of SECTOR_COLUMNS) {
        gdpBySector[sector] = num(row[col]);
      }

      list.push({
        code: codeStr,
        name,
        gdpBySector,
        gdpTotal: num(row[COL_TOTAL]),
        primary: num(row[COL_PRIMARY]),
        secondary: num(row[COL_SECONDARY]),
        tertiary: num(row[COL_TERTIARY]),
      });
    }

    if (list.length !== 47) {
      throw new Error(`sheet ${sheetName}: expected 47 prefectures, got ${list.length}`);
    }
    years[year] = list;
    console.log(`${year}: 47 prefectures`);
  }

  const sortedYears = Object.keys(years).sort();
  const dataset: IndustryDataset = {
    meta: {
      fiscalYear: '平成23年度〜令和4年度',
      source: '内閣府 経済社会総合研究所「県民経済計算」主要系列表1 経済活動別県内総生産（名目）',
      sourceUrl: SOURCE_PAGE,
      license: '政府標準利用規約（第2.0版）',
      fetchedAt: new Date().toISOString().slice(0, 10),
    },
    sectors: SECTOR_COLUMNS.map(([s]) => s),
    latestYear: sortedYears[sortedYears.length - 1],
    years,
  };

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(dataset, null, 2) + '\n', 'utf8');
  console.log(`wrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 4: スクリプトを実行**

Run: `npx tsx scripts/fetch-industry.ts`
Expected: `2011: 47 prefectures` から `2022: 47 prefectures` まで 12 行、続いて `wrote .../industry.json`

- [ ] **Step 5: テストが通ることを確認**

Run: `npx vitest run tests/data-integrity.test.ts`
Expected: PASS（12 テスト）

- [ ] **Step 6: Commit**

```bash
git add scripts/fetch-industry.ts src/lib/types.ts src/data/industry.json tests/data-integrity.test.ts
git commit -m "feat: 県民経済計算の産業別県内総生産データ取り込みを追加"
```

---

### Task 4: 施策カードと定数・禁止語チェック

**Files:**
- Create: `src/lib/constants.ts`, `src/data/policies.json`, `scripts/check-forbidden-words.ts`
- Modify: `src/lib/types.ts`（`Policy`, `AxisKey`, `Weights` を追加）
- Test: `tests/forbidden-words.test.ts`, `tests/data-integrity.test.ts`（policies の describe を追加）

**Interfaces:**
- Consumes: `src/lib/types.ts`
- Produces:
  - `AxisKey = 'population' | 'economy' | 'fiscal' | 'quality' | 'durability'`
  - `Weights = Record<AxisKey, number>`
  - `Policy` 型と `src/data/policies.json`（50 枚）
  - `AXES: { key: AxisKey; label: string; subtitle: string; tooltip?: string }[]`
  - `PRESETS: { id: string; label: string; description: string; weights: Weights }[]`
  - `FORBIDDEN_WORDS: string[]`
  - `DISCRETIONARY_RATIO = 0.05`

- [ ] **Step 1: 型を追加**

`src/lib/types.ts` の末尾に追加:

```ts
export type AxisKey = 'population' | 'economy' | 'fiscal' | 'quality' | 'durability';

export type Weights = Record<AxisKey, number>;

export type Policy = {
  id: string;
  name: string;
  summary: string;
  /** 年あたりの想定コスト（億円）。本モデルの仮定値 */
  costOku: number;
  /** 対応する目的別歳出区分。fiscal.json の expenseByPurpose のキーと一致させる */
  expenseCategory: string;
  /** -10〜+10。本モデルの仮定値 */
  scores: Record<AxisKey, number>;
  rationale: string;
  sideEffects: string[];
  evidence: { label: string; url: string }[];
  /** 同じ値を持つカードは同時に採択されない */
  exclusiveGroup?: string;
  horizon: 'short' | 'medium' | 'long';
};
```

- [ ] **Step 2: 定数を定義**

`src/lib/constants.ts`:

```ts
import type { AxisKey, Weights } from './types';

export const AXES: {
  key: AxisKey;
  label: string;
  subtitle: string;
  tooltip?: string;
}[] = [
  { key: 'population', label: '人口増加', subtitle: '社会増減・出生数を伸ばす' },
  { key: 'economy', label: '経済成長', subtitle: '県内総生産・所得を伸ばす' },
  { key: 'fiscal', label: '財政健全化', subtitle: '将来世代の負担を減らす' },
  { key: 'quality', label: '生活の質', subtitle: '医療・教育・安全を守る' },
  {
    key: 'durability',
    label: '政治的持続性',
    subtitle: '再選可能性をどれだけ重視するか',
    tooltip:
      '公共選択論では、政治家を「再選を目的関数に含む合理的主体」としてモデル化します。' +
      'これは特定の人物の評価ではなく、制度設計を考えるための分析枠です。',
  },
];

export const PRESETS: {
  id: string;
  label: string;
  description: string;
  weights: Weights;
}[] = [
  {
    id: 'population-first',
    label: '人口最優先型',
    description: '人口減少の緩和を最上位に置く',
    weights: { population: 95, economy: 55, fiscal: 25, quality: 60, durability: 30 },
  },
  {
    id: 'growth-first',
    label: '経済成長優先型',
    description: '産業の付加価値を伸ばすことを最上位に置く',
    weights: { population: 45, economy: 95, fiscal: 35, quality: 40, durability: 35 },
  },
  {
    id: 'fiscal-discipline',
    label: '財政規律型',
    description: '将来世代への負担移転を避けることを最上位に置く',
    weights: { population: 35, economy: 45, fiscal: 95, quality: 45, durability: 15 },
  },
  {
    id: 'quality-first',
    label: '生活の質優先型',
    description: '医療・教育・安全の水準維持を最上位に置く',
    weights: { population: 45, economy: 35, fiscal: 40, quality: 95, durability: 40 },
  },
  {
    id: 'durability-first',
    label: '政治的持続性重視型',
    description: '短期に成果が見える施策を選びやすくなる',
    weights: { population: 45, economy: 45, fiscal: 20, quality: 50, durability: 95 },
  },
  {
    id: 'balanced',
    label: 'バランス型',
    description: '全ての軸を等しく扱う',
    weights: { population: 60, economy: 60, fiscal: 60, quality: 60, durability: 60 },
  },
];

export const DEFAULT_WEIGHTS: Weights = {
  population: 60, economy: 60, fiscal: 60, quality: 60, durability: 60,
};

/**
 * 単年度で組み替え可能な裁量枠を歳出規模の何割とみなすか。
 * 地方財政では義務的経費の比率が高く、単年度で動かせる範囲は限られる。
 * この値は本モデルの仮定値であり、画面上でもそう明示する。
 */
export const DISCRETIONARY_RATIO = 0.05;

export const AKITA_CODE = '05';

/**
 * 施策カードおよび UI 文言に含めてはならない語。
 * 実在の人物・政党・団体を想起させる表現を排除するため。
 */
export const FORBIDDEN_WORDS: string[] = [
  '知事選', '選挙', '候補者', '投票', '得票', '公約', '与党', '野党', '政党',
  '自民', '立憲', '公明', '維新', '共産', '国民民主', '社民', 'れいわ', '参政',
  '首相', '総理', '大臣', '議員',
];
```

- [ ] **Step 3: 禁止語チェックのテストを書いて失敗を確認**

`tests/forbidden-words.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import policies from '../src/data/policies.json';
import { FORBIDDEN_WORDS } from '../src/lib/constants';
import type { Policy } from '../src/lib/types';

const list = policies as Policy[];

function textOf(p: Policy): string {
  return [p.name, p.summary, p.rationale, ...p.sideEffects, ...p.evidence.map((e) => e.label)].join(
    ' ',
  );
}

describe('policy copy', () => {
  it('contains no forbidden political terms', () => {
    for (const p of list) {
      const text = textOf(p);
      for (const word of FORBIDDEN_WORDS) {
        expect(text.includes(word), `${p.id} contains "${word}"`).toBe(false);
      }
    }
  });

  it('never presents model output as a prediction', () => {
    for (const p of list) {
      expect(textOf(p).includes('と予測されます'), p.id).toBe(false);
    }
  });
});
```

Run: `npx vitest run tests/forbidden-words.test.ts`
Expected: FAIL — `Cannot find module '../src/data/policies.json'`

- [ ] **Step 4: カードの構造テストを書く**

`tests/data-integrity.test.ts` の末尾に追加:

```ts
import policies from '../src/data/policies.json';
import { AXES } from '../src/lib/constants';
import type { Policy } from '../src/lib/types';

const cards = policies as Policy[];

describe('policies.json', () => {
  it('holds at least 50 cards with unique ids', () => {
    expect(cards.length).toBeGreaterThanOrEqual(50);
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
  });

  it('scores every axis within -10..10', () => {
    for (const c of cards) {
      for (const axis of AXES) {
        const v = c.scores[axis.key];
        expect(typeof v, `${c.id}.${axis.key}`).toBe('number');
        expect(v, `${c.id}.${axis.key}`).toBeGreaterThanOrEqual(-10);
        expect(v, `${c.id}.${axis.key}`).toBeLessThanOrEqual(10);
      }
    }
  });

  it('assigns a positive cost and a known expense category', () => {
    const known = new Set([
      '総務費', '民生費', '衛生費', '労働費', '農林水産業費', '商工費',
      '土木費', '警察費', '消防費', '教育費', '公債費',
    ]);
    for (const c of cards) {
      expect(c.costOku, c.id).toBeGreaterThan(0);
      expect(known.has(c.expenseCategory), `${c.id}: ${c.expenseCategory}`).toBe(true);
    }
  });

  it('cites at least one source per card', () => {
    for (const c of cards) {
      expect(c.evidence.length, c.id).toBeGreaterThanOrEqual(1);
      for (const e of c.evidence) expect(e.url, c.id).toMatch(/^https:\/\//);
    }
  });

  it('describes at least one side effect per card', () => {
    for (const c of cards) {
      expect(c.sideEffects.length, c.id).toBeGreaterThanOrEqual(1);
    }
  });

  it('covers every axis with both strongly positive and strongly negative cards', () => {
    for (const axis of AXES) {
      const values = cards.map((c) => c.scores[axis.key]);
      expect(Math.max(...values), `${axis.key} max`).toBeGreaterThanOrEqual(6);
      expect(Math.min(...values), `${axis.key} min`).toBeLessThanOrEqual(-4);
    }
  });
});
```

- [ ] **Step 5: 施策カード 50 枚を執筆**

`src/data/policies.json` に 50 枚を書く。以下は最初の 4 枚。残る 46 枚も同じ形式で、
下の「カードの網羅要件」を満たすように執筆する。

```json
[
  {
    "id": "childcare-cost-zero",
    "name": "第2子以降の保育料完全無償化",
    "summary": "所得制限を設けず、第2子以降の保育料を県費で全額補助する。",
    "costOku": 42,
    "expenseCategory": "民生費",
    "scores": { "population": 8, "economy": 2, "fiscal": -6, "quality": 6, "durability": 7 },
    "rationale": "秋田県は歳入に占める地方交付税の比率が35.1%と高く、税収の自然増に頼りにくい。人口面の施策は税収増を待たずに交付税の基準財政需要額に反映されうる領域から着手する構成にしている。保育料の負担軽減は世帯に届くまでの期間が短く、対象世帯にとって効果が見えやすい。",
    "sideEffects": [
      "民生費の恒常的な増加となり、単年度で撤回しにくい",
      "保育の受け皿が不足している地域では、無償化しても利用できない世帯が残る"
    ],
    "evidence": [
      { "label": "総務省 令和5年度都道府県財政指数表", "url": "https://www.soumu.go.jp/iken/ruiji/todohuken_r05.html" }
    ],
    "exclusiveGroup": "childcare-subsidy",
    "horizon": "short"
  },
  {
    "id": "childcare-cost-means-tested",
    "name": "低所得世帯に絞った保育料補助",
    "summary": "住民税非課税世帯を対象に保育料を全額補助する。対象を絞ることで費用を抑える。",
    "costOku": 9,
    "expenseCategory": "民生費",
    "scores": { "population": 4, "economy": 1, "fiscal": -1, "quality": 7, "durability": 2 },
    "rationale": "同じ目的に対して、対象を限定することで単年度の裁量枠の消費を抑える選択肢。財政健全化の重みが高いときに、無償化の全面実施に代えて選ばれる。",
    "sideEffects": [
      "対象外の中間所得層には効果が及ばない",
      "所得判定の事務コストが市町村側に発生する"
    ],
    "evidence": [
      { "label": "総務省 令和5年度都道府県財政指数表", "url": "https://www.soumu.go.jp/iken/ruiji/todohuken_r05.html" }
    ],
    "exclusiveGroup": "childcare-subsidy",
    "horizon": "short"
  },
  {
    "id": "agri-value-add",
    "name": "農産物の高付加価値化と輸出支援",
    "summary": "一次加工施設の整備と輸出手続の伴走支援を組み合わせ、農産物の単価引き上げを図る。",
    "costOku": 35,
    "expenseCategory": "農林水産業費",
    "scores": { "population": 3, "economy": 7, "fiscal": -3, "quality": 1, "durability": 3 },
    "rationale": "秋田県の農林水産業は県内総生産の構成比で全国平均を上回る一方、第1次産業の付加価値額そのものは県内総生産の3%未満にとどまる。産出量ではなく単価に働きかける構成にしている。",
    "sideEffects": [
      "効果が出るまでに複数年度を要し、任期内に数字として表れにくい",
      "為替と海外需要に左右され、県の裁量が及ばない要因が大きい"
    ],
    "evidence": [
      { "label": "内閣府 県民経済計算 主要系列表1", "url": "https://www.esri.cao.go.jp/jp/sna/data/data_list/kenmin/files/contents/main_2022.html" }
    ],
    "horizon": "long"
  },
  {
    "id": "school-consolidation",
    "name": "県立高校の再編と統合",
    "summary": "生徒数の減少に合わせて県立高校を再編し、教育費の構造を見直す。",
    "costOku": 12,
    "expenseCategory": "教育費",
    "scores": { "population": -2, "economy": 0, "fiscal": 8, "quality": -3, "durability": -8 },
    "rationale": "人件費は秋田県の性質別歳出の21.8%を占め、単年度の裁量枠だけでは動かせない規模にある。構造的な支出を見直す選択肢として置いているが、政治的持続性の重みが高い場合には選ばれにくい。",
    "sideEffects": [
      "通学距離が伸びる地域が生じ、当該地域からの転出を促す可能性がある",
      "統合対象地域の合意形成に時間を要し、再編中は教育環境が不安定になる"
    ],
    "evidence": [
      { "label": "総務省 令和5年度都道府県財政指数表", "url": "https://www.soumu.go.jp/iken/ruiji/todohuken_r05.html" }
    ],
    "horizon": "medium"
  }
]
```

**カードの網羅要件**（テストが検証する。執筆時に必ず満たすこと）

- 合計 50 枚以上、`id` は一意
- `expenseCategory` は fiscal.json の目的別歳出区分に存在するキーのみ（総務費・民生費・衛生費・労働費・農林水産業費・商工費・土木費・警察費・消防費・教育費・公債費）
- 5 軸それぞれについて、`+6` 以上のカードと `-4` 以下のカードが少なくとも 1 枚ずつ存在する
- `costOku` は 5〜80 の範囲に収める。裁量枠（後述の計算で約 286 億円）に対して 4〜8 枚が収まる分布にする
- `exclusiveGroup` を使って、同一目的に対する強度違いの選択肢を 8 組以上つくる
- 全カードに `sideEffects` を 1 つ以上、`evidence` を 1 つ以上
- `FORBIDDEN_WORDS` を一切含めない
- 「〜と予測されます」という断定表現を使わない

- [ ] **Step 6: CI 用の禁止語チェックスクリプトを実装**

`scripts/check-forbidden-words.ts`:

```ts
/**
 * 施策カードとページ文言に禁止語が混入していないか検査する。
 * CI から実行し、混入時は終了コード 1 で失敗させる。
 *   npx tsx scripts/check-forbidden-words.ts
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { FORBIDDEN_WORDS } from '../src/lib/constants';

const ROOTS = [
  path.resolve(__dirname, '../src/app'),
  path.resolve(__dirname, '../src/components'),
  path.resolve(__dirname, '../src/data'),
];

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/\.(tsx?|json)$/.test(e.name)) out.push(p);
  }
  return out;
}

async function main() {
  const violations: string[] = [];

  for (const root of ROOTS) {
    for (const file of await walk(root)) {
      const text = await readFile(file, 'utf8');
      const lines = text.split('\n');
      lines.forEach((line, i) => {
        for (const word of FORBIDDEN_WORDS) {
          if (line.includes(word)) {
            violations.push(`${path.relative(process.cwd(), file)}:${i + 1}  "${word}"`);
          }
        }
      });
    }
  }

  if (violations.length > 0) {
    console.error('禁止語が検出されました:');
    for (const v of violations) console.error('  ' + v);
    process.exit(1);
  }
  console.log('禁止語チェック: 問題なし');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 7: テストとチェックが通ることを確認**

Run: `npx vitest run && npx tsx scripts/check-forbidden-words.ts`
Expected: 全テスト PASS、`禁止語チェック: 問題なし`

`src/lib/constants.ts` 自身が `FORBIDDEN_WORDS` の定義として禁止語を含むが、
`ROOTS` に `src/lib` を含めていないため検出されない。この設計は意図的である。

- [ ] **Step 8: Commit**

```bash
git add src/lib/constants.ts src/lib/types.ts src/data/policies.json scripts/check-forbidden-words.ts tests/
git commit -m "feat: 施策カード50枚と軸定義・禁止語チェックを追加"
```

---

### Task 5: シミュレーションエンジン

**Files:**
- Create: `src/lib/simulate.ts`, `src/lib/fiscal.ts`
- Test: `tests/simulate.test.ts`

**Interfaces:**
- Consumes: `Policy`, `Weights`, `AxisKey`, `FiscalDataset`, `DISCRETIONARY_RATIO`, `AKITA_CODE`
- Produces:
  - `getPrefecture(code: string): PrefectureFiscal`
  - `getAkita(): PrefectureFiscal`
  - `discretionaryBudgetOku(p: PrefectureFiscal): number`
  - `simulate(weights: Weights, policies: Policy[], budgetOku: number): SimulationResult`
  - `SimulationResult` 型

**裁量枠の計算根拠（実データで確認済み）**

秋田県の歳出合計は 618,279 円/人、住民基本台帳人口は 924,620 人。
総額は 618,279 × 924,620 ≒ 5,716 億円。その 5%（`DISCRETIONARY_RATIO`）で約 286 億円。
`costOku` が 5〜80 のカードなら 4〜8 枚が収まる。

- [ ] **Step 1: fiscal ヘルパを実装**

`src/lib/fiscal.ts`:

```ts
import fiscalJson from '@/data/fiscal.json';
import { AKITA_CODE, DISCRETIONARY_RATIO } from './constants';
import type { FiscalDataset, PrefectureFiscal } from './types';

export const fiscalData = fiscalJson as FiscalDataset;

export function getPrefecture(code: string): PrefectureFiscal {
  const p = fiscalData.prefectures.find((x) => x.code === code);
  if (!p) throw new Error(`unknown prefecture code: ${code}`);
  return p;
}

export function getAkita(): PrefectureFiscal {
  return getPrefecture(AKITA_CODE);
}

/** 歳出総額（億円）。人口1人当たり円 × 人口 ÷ 1億 */
export function totalExpenseOku(p: PrefectureFiscal): number {
  return (p.expenseTotal * p.population) / 100_000_000;
}

/** 単年度で組み替え可能とみなす裁量枠（億円）。本モデルの仮定値 */
export function discretionaryBudgetOku(p: PrefectureFiscal): number {
  return totalExpenseOku(p) * DISCRETIONARY_RATIO;
}
```

- [ ] **Step 2: エンジンのテストを書いて失敗を確認**

`tests/simulate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { simulate } from '../src/lib/simulate';
import type { Policy, Weights } from '../src/lib/types';

const W = (over: Partial<Weights> = {}): Weights => ({
  population: 0, economy: 0, fiscal: 0, quality: 0, durability: 0, ...over,
});

const card = (over: Partial<Policy> & { id: string }): Policy => ({
  name: over.id,
  summary: '',
  costOku: 10,
  expenseCategory: '民生費',
  scores: { population: 0, economy: 0, fiscal: 0, quality: 0, durability: 0 },
  rationale: '',
  sideEffects: ['x'],
  evidence: [{ label: 'l', url: 'https://example.gov' }],
  horizon: 'short',
  ...over,
});

describe('simulate', () => {
  it('ranks cards by weighted score and adopts the best first', () => {
    const policies = [
      card({ id: 'low', scores: { population: 1, economy: 0, fiscal: 0, quality: 0, durability: 0 } }),
      card({ id: 'high', scores: { population: 9, economy: 0, fiscal: 0, quality: 0, durability: 0 } }),
    ];
    const r = simulate(W({ population: 100 }), policies, 10);
    expect(r.adopted.map((a) => a.policy.id)).toEqual(['high']);
    expect(r.rejected.map((a) => a.policy.id)).toEqual(['low']);
  });

  it('is deterministic: identical input yields identical output', () => {
    const policies = [
      card({ id: 'a', scores: { population: 5, economy: 3, fiscal: 0, quality: 0, durability: 0 } }),
      card({ id: 'b', scores: { population: 3, economy: 5, fiscal: 0, quality: 0, durability: 0 } }),
    ];
    const w = W({ population: 70, economy: 30 });
    expect(simulate(w, policies, 100)).toEqual(simulate(w, policies, 100));
  });

  it('never exceeds the discretionary budget', () => {
    const policies = [
      card({ id: 'a', costOku: 60, scores: { population: 9, economy: 0, fiscal: 0, quality: 0, durability: 0 } }),
      card({ id: 'b', costOku: 60, scores: { population: 8, economy: 0, fiscal: 0, quality: 0, durability: 0 } }),
      card({ id: 'c', costOku: 60, scores: { population: 7, economy: 0, fiscal: 0, quality: 0, durability: 0 } }),
    ];
    const r = simulate(W({ population: 100 }), policies, 100);
    expect(r.totalCostOku).toBeLessThanOrEqual(100);
    expect(r.adopted).toHaveLength(1);
  });

  it('adopts at most one card per exclusive group', () => {
    const policies = [
      card({ id: 'strong', exclusiveGroup: 'g', costOku: 5, scores: { population: 9, economy: 0, fiscal: 0, quality: 0, durability: 0 } }),
      card({ id: 'weak', exclusiveGroup: 'g', costOku: 5, scores: { population: 4, economy: 0, fiscal: 0, quality: 0, durability: 0 } }),
    ];
    const r = simulate(W({ population: 100 }), policies, 1000);
    expect(r.adopted.map((a) => a.policy.id)).toEqual(['strong']);
    expect(r.rejected.map((a) => a.policy.id)).toEqual(['weak']);
  });

  it('lets a lower-weighted axis flip which card in a group wins', () => {
    const policies = [
      card({ id: 'expensive', exclusiveGroup: 'g', costOku: 40, scores: { population: 8, economy: 0, fiscal: -8, quality: 0, durability: 0 } }),
      card({ id: 'cheap', exclusiveGroup: 'g', costOku: 8, scores: { population: 4, economy: 0, fiscal: 2, quality: 0, durability: 0 } }),
    ];
    expect(simulate(W({ population: 100 }), policies, 1000).adopted[0].policy.id).toBe('expensive');
    expect(simulate(W({ population: 30, fiscal: 100 }), policies, 1000).adopted[0].policy.id).toBe('cheap');
  });

  it('sums the effect vector across adopted cards', () => {
    const policies = [
      card({ id: 'a', costOku: 5, scores: { population: 4, economy: 2, fiscal: -3, quality: 1, durability: 0 } }),
      card({ id: 'b', costOku: 5, scores: { population: 2, economy: 3, fiscal: -1, quality: 0, durability: 2 } }),
    ];
    const r = simulate(W({ population: 50, economy: 50 }), policies, 1000);
    expect(r.effects.population).toBe(6);
    expect(r.effects.economy).toBe(5);
    expect(r.effects.fiscal).toBe(-4);
  });

  it('aggregates adopted cost per expense category', () => {
    const policies = [
      card({ id: 'a', costOku: 12, expenseCategory: '民生費', scores: { population: 9, economy: 0, fiscal: 0, quality: 0, durability: 0 } }),
      card({ id: 'b', costOku: 8, expenseCategory: '民生費', scores: { population: 8, economy: 0, fiscal: 0, quality: 0, durability: 0 } }),
      card({ id: 'c', costOku: 5, expenseCategory: '教育費', scores: { population: 7, economy: 0, fiscal: 0, quality: 0, durability: 0 } }),
    ];
    const r = simulate(W({ population: 100 }), policies, 1000);
    expect(r.costByCategory).toEqual({ 民生費: 20, 教育費: 5 });
  });

  it('breaks score ties by id so ordering is stable', () => {
    const policies = [
      card({ id: 'b', scores: { population: 5, economy: 0, fiscal: 0, quality: 0, durability: 0 } }),
      card({ id: 'a', scores: { population: 5, economy: 0, fiscal: 0, quality: 0, durability: 0 } }),
    ];
    const r = simulate(W({ population: 100 }), policies, 1000);
    expect(r.adopted.map((x) => x.policy.id)).toEqual(['a', 'b']);
  });

  it('returns an empty package when every weight is zero and no card scores', () => {
    const policies = [card({ id: 'a', scores: { population: 0, economy: 0, fiscal: 0, quality: 0, durability: 0 } })];
    const r = simulate(W(), policies, 1000);
    expect(r.adopted).toHaveLength(0);
    expect(r.totalCostOku).toBe(0);
  });
});
```

Run: `npx vitest run tests/simulate.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/simulate'`

- [ ] **Step 3: エンジンを実装**

`src/lib/simulate.ts`:

```ts
import type { AxisKey, Policy, Weights } from './types';
import { AXES } from './constants';

export type ScoredPolicy = { policy: Policy; score: number };

export type SimulationResult = {
  adopted: ScoredPolicy[];
  /** 採択されなかったカードをスコア降順で返す */
  rejected: ScoredPolicy[];
  totalCostOku: number;
  /** 目的別歳出区分ごとの採択コスト合計（億円） */
  costByCategory: Record<string, number>;
  /** 採択カードのスコアを軸ごとに合算した値。本モデルの仮定値 */
  effects: Record<AxisKey, number>;
};

function weightedScore(policy: Policy, weights: Weights): number {
  let total = 0;
  for (const axis of AXES) {
    total += (weights[axis.key] / 100) * policy.scores[axis.key];
  }
  return total;
}

/**
 * 価値観の重みから施策パッケージを組み立てる。
 *
 * 決定論的であること（同じ入力から常に同じ出力）を保証する。乱数を使わず、
 * スコアが同点の場合は id の辞書順で決める。
 *
 * @param weights  各軸 0〜100
 * @param policies 施策カードのプール
 * @param budgetOku 単年度の裁量枠（億円）
 */
export function simulate(
  weights: Weights,
  policies: Policy[],
  budgetOku: number,
): SimulationResult {
  const scored: ScoredPolicy[] = policies
    .map((policy) => ({ policy, score: weightedScore(policy, weights) }))
    .sort((a, b) => b.score - a.score || a.policy.id.localeCompare(b.policy.id));

  const adopted: ScoredPolicy[] = [];
  const rejected: ScoredPolicy[] = [];
  const usedGroups = new Set<string>();
  let totalCostOku = 0;

  for (const item of scored) {
    const { policy, score } = item;
    const group = policy.exclusiveGroup;

    // スコアが正でないカードは、その価値観では採る理由がない
    if (score <= 0) {
      rejected.push(item);
      continue;
    }
    if (group && usedGroups.has(group)) {
      rejected.push(item);
      continue;
    }
    if (totalCostOku + policy.costOku > budgetOku) {
      rejected.push(item);
      continue;
    }

    adopted.push(item);
    totalCostOku += policy.costOku;
    if (group) usedGroups.add(group);
  }

  const costByCategory: Record<string, number> = {};
  const effects = Object.fromEntries(AXES.map((a) => [a.key, 0])) as Record<AxisKey, number>;

  for (const { policy } of adopted) {
    costByCategory[policy.expenseCategory] =
      (costByCategory[policy.expenseCategory] ?? 0) + policy.costOku;
    for (const axis of AXES) {
      effects[axis.key] += policy.scores[axis.key];
    }
  }

  return { adopted, rejected, totalCostOku, costByCategory, effects };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run tests/simulate.test.ts`
Expected: PASS（9 テスト）

- [ ] **Step 5: 実データで裁量枠を確認**

Run:
```bash
npx tsx -e "
import { getAkita, totalExpenseOku, discretionaryBudgetOku } from './src/lib/fiscal';
const a = getAkita();
console.log(a.name, '人口', a.population, '歳出総額(億円)', Math.round(totalExpenseOku(a)), '裁量枠(億円)', Math.round(discretionaryBudgetOku(a)));
"
```
Expected: `秋田県 人口 924620 歳出総額(億円) 5716 裁量枠(億円) 286`

値が大きく外れる場合は Task 2 のパースを疑うこと。

- [ ] **Step 6: Commit**

```bash
git add src/lib/simulate.ts src/lib/fiscal.ts tests/simulate.test.ts
git commit -m "feat: 決定論的な施策選定エンジンを実装"
```

---

### Task 6: 共通レイアウトと免責・出典ページ

**Files:**
- Create: `src/lib/industry.ts`, `src/components/layout/Header.tsx`, `src/components/layout/Footer.tsx`, `src/components/layout/DisclaimerModal.tsx`, `src/app/about/page.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `fiscalData.meta`, `IndustryDataset`
- Produces:
  - `industryData: IndustryDataset`、`getIndustry(code, year?)`、`sectorShares(p)`（`src/lib/industry.ts`。Task 8 が使う）
  - `<Header />`, `<Footer />`, `<DisclaimerModal />`。全ページで `layout.tsx` から適用される

`/about` の出典セクションが `industryData.meta` を必要とするため、`src/lib/industry.ts` は
Task 8 ではなく本タスクで作る。

- [ ] **Step 1: industry ヘルパを実装**

`src/lib/industry.ts`:

```ts
import industryJson from '@/data/industry.json';
import type { IndustryDataset, PrefectureIndustry } from './types';

export const industryData = industryJson as IndustryDataset;

export function getIndustry(code: string, year = industryData.latestYear): PrefectureIndustry {
  const list = industryData.years[year];
  if (!list) throw new Error(`unknown year: ${year}`);
  const p = list.find((x) => x.code === code);
  if (!p) throw new Error(`unknown prefecture code: ${code}`);
  return p;
}

/** 業種別の構成比(%) に変換する */
export function sectorShares(p: PrefectureIndustry): Record<string, number> {
  const total = Object.values(p.gdpBySector).reduce((a, b) => a + b, 0);
  return Object.fromEntries(
    Object.entries(p.gdpBySector).map(([k, v]) => [k, (v / total) * 100]),
  );
}
```

- [ ] **Step 2: Footer を実装**

`src/components/layout/Footer.tsx`:

```tsx
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
```

- [ ] **Step 3: Header を実装**

`src/components/layout/Header.tsx`:

```tsx
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
```

- [ ] **Step 4: 初回訪問モーダルを実装**

`src/components/layout/DisclaimerModal.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';

const KEY = 'akita-ai-governor:disclaimer-ack';

export function DisclaimerModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(KEY) !== '1') setOpen(true);
  }, []);

  if (!open) return null;

  const accept = () => {
    localStorage.setItem(KEY, '1');
    setOpen(false);
  };

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
```

- [ ] **Step 5: layout.tsx に組み込む**

`src/app/layout.tsx` を編集し、`<body>` の中身を次の構成にする:

```tsx
<body className={...}>
  <DisclaimerModal />
  <Header />
  <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
  <Footer />
</body>
```

`metadata` を設定:

```ts
export const metadata: Metadata = {
  title: 'AI Governor Lab 秋田',
  description:
    '価値観の重み付けから施策パッケージを導く思考実験と、47都道府県の財政・産業構造の比較。公的統計に基づく非公式の教育用アプリです。',
};
```

- [ ] **Step 6: /about を実装**

`src/app/about/page.tsx` に以下を含める:

1. このアプリは何か（思考実験である旨）
2. 免責 — 現実の秋田県・県政・特定の個人団体とは無関係
3. 数値の扱い — 公的統計の実数と、本モデルの仮定値の区別
4. 選定アルゴリズムの説明（重み付き和 → 排他グループ → 裁量枠で打ち切り）と、裁量枠を歳出の 5% とした根拠
5. 「政治的持続性」軸の公共選択論に基づく説明
6. データ出典 — `fiscalData.meta` と `industryData.meta` から出典名・URL・年度・ライセンスを表示

出典セクションはハードコードせず、メタデータから描画すること:

```tsx
import { fiscalData } from '@/lib/fiscal';
import { industryData } from '@/lib/industry';

const sources = [fiscalData.meta, industryData.meta];
// sources.map(...) で 出典名 / 年度 / URL / ライセンス を列挙する
```

- [ ] **Step 7: ビルドと禁止語チェックを確認**

Run: `npm run build && npx tsx scripts/check-forbidden-words.ts`
Expected: ビルド成功、`out/about/index.html` が生成される。禁止語なし

- [ ] **Step 8: Commit**

```bash
git add src/lib/industry.ts src/components/layout src/app/layout.tsx src/app/about
git commit -m "feat: 共通レイアウトと免責・データ出典ページを追加"
```

---

### Task 7: シミュレーター画面

**Files:**
- Create: `src/components/sim/AxisSliders.tsx`, `src/components/sim/PresetButtons.tsx`, `src/components/sim/PolicyCard.tsx`, `src/components/sim/ResultPanel.tsx`, `src/components/sim/BudgetShift.tsx`, `src/components/sim/TradeoffChart.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `simulate`, `SimulationResult`, `AXES`, `PRESETS`, `DEFAULT_WEIGHTS`, `getAkita`, `discretionaryBudgetOku`, `policies.json`
- Produces: なし（画面の終端）

**チャートを書く前に必須:** `dataviz` スキルを読み込むこと。配色・軸・凡例・ライト/ダーク両対応の規約はそこに定義されている。本タスクのチャートはすべてその規約に従う。

- [ ] **Step 1: `src/app/page.tsx` を Client Component として実装**

状態は `weights: Weights` ひとつ。`useMemo` で `simulate` を呼ぶ。

```tsx
'use client';

import { useMemo, useState } from 'react';
import policiesJson from '@/data/policies.json';
import { simulate } from '@/lib/simulate';
import { getAkita, discretionaryBudgetOku } from '@/lib/fiscal';
import { DEFAULT_WEIGHTS } from '@/lib/constants';
import type { Policy, Weights } from '@/lib/types';
// components...

const POLICIES = policiesJson as Policy[];

export default function Page() {
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const akita = getAkita();
  const budgetOku = useMemo(() => discretionaryBudgetOku(akita), [akita]);
  const result = useMemo(() => simulate(weights, POLICIES, budgetOku), [weights, budgetOku]);
  // ...
}
```

- [ ] **Step 2: AxisSliders を実装**

- `AXES` を map して `<input type="range" min={0} max={100} step={5}>` を描く
- 各スライダーに `label` と `subtitle` を表示、現在値を数値でも表示
- `tooltip` があるものは `<abbr>` またはボタン付きポップオーバーで常設表示する。`durability` は必ず説明が読める状態にする
- `aria-label` に軸名を設定する

- [ ] **Step 3: PresetButtons を実装**

`PRESETS` を map してボタンを描く。押すと `setWeights(preset.weights)`。
現在の `weights` がいずれかのプリセットと完全一致する場合はそのボタンを選択状態にする。

- [ ] **Step 4: ResultPanel を実装**

上から順に:

1. **施政方針文** — 採択カードから組み立てる。テンプレートは固定文＋カード名の列挙にとどめ、
   効果の断定表現を含めない。例:
   `「この価値観のもとでは、${topAxisLabel}を最上位に置き、${adopted.length}件の施策を選びました。」`
   に続けて、`horizon` ごとに「短期」「中期」「長期」で分けたカード名の列挙
2. **採択された施策** — `PolicyCard` を並べる。各カードに name / summary / costOku / rationale /
   sideEffects / evidence リンクを表示
3. **切られた施策** — `rejected` の上位 6 件。落選理由を判定して表示する:
   - `score <= 0` → 「この価値観では優先度が立たない」
   - `exclusiveGroup` が採択済み → 「同じ目的でより優先度の高い施策を選んだため」
   - それ以外 → 「裁量枠を使い切ったため」
4. **予算** — `totalCostOku` / `budgetOku` と使用率
5. `<BudgetShift />` と `<TradeoffChart />`

- [ ] **Step 5: BudgetShift を実装**

秋田県の目的別歳出構成（`akita.expenseByPurpose`）を億円換算し、
`result.costByCategory` を上乗せした「シミュレーション後」と並べる横棒グラフ。

億円換算: `(perCapitaYen * akita.population) / 100_000_000`

グラフの直下に「裁量枠 5% は本モデルの仮定値です」と明記する。

- [ ] **Step 6: TradeoffChart を実装**

`result.effects` の 5 軸をレーダーチャートまたは横棒で描く。

軸ラベルの下に必ず次を表示する:
`これらの数値は本モデルが各施策に割り当てた仮定値の合計であり、将来の予測ではありません。`

- [ ] **Step 7: 手動で動作を確認**

Run: `npm run dev`
確認項目:
- 「政治的持続性」を 0 → 100 に動かすと採択カードが入れ替わる
- 「財政健全化」を最大にすると `costOku` の小さいカードが選ばれやすくなる
- 予算使用率が 100% を超えない
- プリセットを押すとスライダーと結果が同時に変わる

- [ ] **Step 8: ビルドと全チェック**

Run: `npm run build && npm test && npx tsx scripts/check-forbidden-words.ts`
Expected: すべて成功

- [ ] **Step 9: Commit**

```bash
git add src/components/sim src/app/page.tsx
git commit -m "feat: 価値観スライダーと施策パッケージ結果画面を実装"
```

---

### Task 8: 47都道府県データ画面

**Files:**
- Create: `src/components/charts/RevenueScatter.tsx`, `src/components/charts/ExpenseBars.tsx`, `src/components/charts/IndustryComposition.tsx`, `src/components/charts/PrefectureCompare.tsx`, `src/app/data/page.tsx`

**Interfaces:**
- Consumes: `fiscalData`, `industryData`, `getIndustry`, `sectorShares`（Task 6 で作成済み）, `AKITA_CODE`
- Produces: なし（画面の終端）

**チャートを書く前に必須:** `dataviz` スキルを読み込むこと。

- [ ] **Step 1: RevenueScatter を実装**

47 県の散布図。横軸「道府県税の構成比(%)」、縦軸「地方交付税の構成比(%)」。
`p.revenueShare['道府県税']` と `p.revenueShare['地方交付税']` を使う。
秋田を強調表示し、常にラベルを出す。他県はホバーで県名を出す。

グラフ下に短い読み取りを添える。例:
`地方交付税への依存度が高い県ほど、県内の税収変動から相対的に切り離される一方、国の算定に左右される割合が大きくなります。`

- [ ] **Step 2: ExpenseBars を実装**

目的別歳出（`expenseByPurpose`）と性質別歳出（`expenseByNatureShare`）の 2 モードを切り替えられる横棒グラフ。
47 県をソート可能にし、秋田を強調。全国平均（47 県の単純平均）を基準線として引く。

- [ ] **Step 3: IndustryComposition を実装**

`sectorShares` を使った 16 業種の構成比。秋田と全国平均の乖離を表示。
年度セレクタ（2011〜2022）で `getIndustry(code, year)` を切り替え、推移も見られるようにする。

- [ ] **Step 4: PrefectureCompare を実装**

`<select>` で任意の 1 県を選び、秋田と並べて次を比較する:
歳入構成 / 目的別歳出構成 / 第1次・第2次・第3次産業比率 / 人口・面積。

- [ ] **Step 5: /data ページを組み立てる**

Server Component でよい（データは静的 import のため）。ただし年度セレクタや県セレクタを持つ
コンポーネントは `'use client'` にする。

各セクションに見出しと 1〜2 文の説明を添える。ページ末尾に出典を再掲する。

- [ ] **Step 6: ビルドと全チェック**

Run: `npm run build && npm test && npx tsx scripts/check-forbidden-words.ts`
Expected: すべて成功。`out/data/index.html` が生成される

- [ ] **Step 7: Commit**

```bash
git add src/components/charts src/app/data
git commit -m "feat: 47都道府県の財政・産業構造の比較画面を実装"
```

---

### Task 9: CI と GitHub 公開

**Files:**
- Create: `.github/workflows/ci.yml`, `README.md`, `LICENSE`

**Interfaces:**
- Consumes: `package.json` の scripts
- Produces: GitHub 上のリポジトリ `yasu-programming/akita-ai-governor`（Public）

- [ ] **Step 1: CI ワークフローを作成**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run check:words
      - run: npm run build
```

- [ ] **Step 2: README を書く**

含める内容:
- アプリの説明と免責（冒頭に置く）
- 開発手順（`npm install` / `npm run dev` / `npm test` / `npm run build`）
- データ更新手順（`npx tsx scripts/fetch-fiscal.ts` / `npx tsx scripts/fetch-industry.ts`）と、
  それがビルド時には実行されないこと
- データ出典とライセンス（政府標準利用規約 第2.0版）
- コード自体のライセンス（MIT）

- [ ] **Step 3: ローカルで CI と同じ検証を実行**

Run: `npm run lint && npm run typecheck && npm test && npm run check:words && npm run build`
Expected: 全て成功。1 つでも失敗したら push しない

- [ ] **Step 4: GitHub にリポジトリを作成して push**

```bash
gh repo create yasu-programming/akita-ai-governor \
  --public \
  --source=. \
  --description "AIが県知事だったら何をするか — 価値観の重み付けから施策を導く思考実験と、47都道府県の財政・産業構造の比較（公的統計に基づく非公式アプリ）" \
  --push
```

- [ ] **Step 5: CI の結果を確認**

Run: `gh run watch`
Expected: `verify` ジョブが成功する。失敗したら修正して push し直す

- [ ] **Step 6: Commit**

```bash
git add .github README.md LICENSE
git commit -m "chore: CI ワークフローと README を追加"
git push
```

---

### Task 10: Vercel デプロイ

**Files:**
- Modify: なし（Vercel 側の設定のみ）

**Interfaces:**
- Consumes: GitHub リポジトリ、`next.config.ts` の `output: 'export'`
- Produces: 本番 URL

- [ ] **Step 1: Vercel にログイン**

Vercel CLI はログインしていないため、次のいずれかで認証する:
- Vercel MCP プラグインの `authenticate` ツール
- ユーザーに `! npx vercel login` の実行を依頼する

Run: `npx vercel whoami`
Expected: アカウント名が表示される

- [ ] **Step 2: プロジェクトをリンクしてプレビューにデプロイ**

```bash
npx vercel link --yes --project akita-ai-governor
npx vercel --yes
```

Expected: プレビュー URL が出力される

- [ ] **Step 3: プレビューを検証**

プレビュー URL に対して確認する:
- トップで免責モーダルが出る
- スライダーを動かすと結果が変わる
- `/data/` のチャートが描画される
- `/about/` に出典が表示される
- ブラウザのネットワークタブに外部 API 呼び出しがない

- [ ] **Step 4: 本番にデプロイ**

```bash
npx vercel --prod --yes
```

Expected: 本番 URL が出力される

- [ ] **Step 5: 本番を検証してユーザーに報告**

本番 URL で Step 3 と同じ項目を確認し、URL をユーザーに伝える。

---

## Self-Review

**1. Spec coverage**

| 仕様セクション | 対応タスク |
|---|---|
| §3 技術スタック | Task 1 |
| §4.1 出典 | Task 2, 3（メタデータに記録）、Task 6（/about で表示） |
| §4.2 取り込みパイプライン | Task 2, 3 |
| §4.3 データ形状 | Task 2（Fiscal）、Task 3（Industry）、Task 4（Policy） |
| §5.1 価値観の軸 | Task 4（`AXES`）、Task 7（`AxisSliders`） |
| §5.2 選定アルゴリズム | Task 5 |
| §5.3 人格プリセット | Task 4（`PRESETS`）、Task 7（`PresetButtons`） |
| §5.4 結果画面 | Task 7 |
| §6 データセクション | Task 8 |
| §7.1 免責の常設 | Task 6（Footer, DisclaimerModal） |
| §7.2 固有名詞の排除 | Task 4（チェックスクリプト）、Task 9（CI） |
| §7.3 断定の回避 | Task 4（テスト）、Task 7 Step 6（明示文） |
| §7.4 政治的持続性のフレーミング | Task 4（tooltip）、Task 6（モーダル・about） |
| §7.5 選挙関連の除外 | Task 4（`FORBIDDEN_WORDS`） |
| §7.6 出典とライセンス | Task 6 Step 5 |
| §8 リポジトリとデプロイ | Task 9, 10 |
| §9 テスト方針 | Task 2, 3, 4, 5 |

仕様の全項目に対応タスクがある。

**2. Placeholder scan**

Task 7 Step 2〜6 と Task 8 Step 2〜6 は、完全なコードではなく要件記述になっている。
これは意図的である。UI コンポーネントの実装は `dataviz` スキルの規約に従う必要があり、
その規約はスキル読み込み時に確定するため、計画側で配色や軸の実装を固定すると矛盾する。
代わりに、各ステップで「何を表示するか」「どの値を使うか」「どの文言を必ず出すか」を
曖昧さなく指定している。データアクセスのキー名（`revenueShare['道府県税']` など）と
億円換算式は明示済みで、実装者が推測する余地はない。

**3. Type consistency**

- `AxisKey` は Task 4 で定義し、Task 5・7 で一貫して使用
- `Weights = Record<AxisKey, number>` は Task 4 で定義、Task 5 の `simulate` 引数と Task 7 の state で一致
- `SimulationResult` のフィールド名（`adopted` / `rejected` / `totalCostOku` / `costByCategory` / `effects`）は
  Task 5 の実装・テストと Task 7 の利用で一致
- `PrefectureFiscal.expenseByNatureShare` は Task 2 で定義、Task 8 Step 3 で使用
- `PrefectureFiscal.revenueShare` は Task 2 で定義、Task 8 Step 2 で使用
- `getPrefecture` / `getAkita` / `discretionaryBudgetOku` / `totalExpenseOku` は Task 5 で定義、Task 7・8 で使用
- `getIndustry` / `sectorShares` / `industryData` は Task 6 Step 1 で定義し、Task 6 の `/about` と
  Task 8 のチャートの両方で使用する（`/about` が `industryData.meta` を必要とするため、
  産業ヘルパの作成を Task 8 から Task 6 に前倒ししている）
- `Policy.scores` は `Record<AxisKey, number>`。Task 4 のテストと Task 5 の `weightedScore` で一致

**修正済み:**
- `src/lib/constants.ts` の `PRESETS` に混入していた非日本語文字を除去した
- `src/lib/industry.ts` の作成を Task 8 から Task 6 に移し、`/about` が未作成のモジュールを
  参照する順序不整合を解消した
