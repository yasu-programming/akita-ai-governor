/**
 * 内閣府「県民経済計算」主要系列表1（経済活動別県内総生産・名目）を取得し
 * src/data/industry.json を生成する。
 *
 * 手動実行専用。Vercel のビルド時には実行しない。
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
const OUT = path.resolve(process.cwd(), 'src/data/industry.json');

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
