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
  // src/components はコンポーネント実装のタスクで作られる。未作成の間は空として扱う。
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
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
