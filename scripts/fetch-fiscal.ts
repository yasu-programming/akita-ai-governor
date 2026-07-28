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
const OUT = path.resolve(process.cwd(), 'src/data/fiscal.json');

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
  // 実データ確認: 県名は行6の列0ではなく列15にある（ブリーフの記載を実測値で修正）
  const name = label(s0[6]?.[15]);
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
