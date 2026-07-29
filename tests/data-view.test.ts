import { describe, it, expect } from 'vitest';
import {
  axisMax,
  expenseCategories,
  expenseMean,
  expenseRanking,
  FISCAL_AVERAGE_LABEL,
  INDUSTRY_AVERAGE_LABEL,
  formatPercent,
  formatPoint,
  formatYen,
  industryStackRows,
  industryYears,
  mean,
  meanRevenueShare,
  nationalSectorShares,
  otherPrefectureOptions,
  purposeCompareRows,
  revenueCompareRows,
  revenueScatterPoints,
  scaleRows,
  sectorDeviations,
  sectorTrend,
  shortSector,
  sourceLine,
  REVENUE_X_KEY,
  REVENUE_Y_KEY,
} from '../src/lib/data-view';
import { fiscalData, getAkita, getPrefecture } from '../src/lib/fiscal';
import { industryData, sectorShares } from '../src/lib/industry';
import policies from '../src/data/policies.json';

describe('sourceLine', () => {
  it('is assembled from meta rather than hardcoded, so it tracks the dataset', () => {
    expect(sourceLine(fiscalData.meta)).toBe(
      `${fiscalData.meta.source}（${fiscalData.meta.fiscalYear}）／${fiscalData.meta.license}`,
    );
    expect(sourceLine(fiscalData.meta)).toContain('総務省');
    expect(sourceLine(industryData.meta)).toContain('県民経済計算');
  });
});

describe('mean / axisMax', () => {
  it('averages values and returns 0 for an empty list', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(mean([])).toBe(0);
  });

  it('rounds an axis maximum up to the next step and never returns less than one step', () => {
    expect(axisMax([12, 31.2, 4])).toBe(40);
    expect(axisMax([40])).toBe(40);
    expect(axisMax([])).toBe(10);
    expect(axisMax([3], 5)).toBe(5);
  });
});

describe('revenueScatterPoints', () => {
  const points = revenueScatterPoints();

  it('covers all 47 prefectures in code order with exactly one flagged as Akita', () => {
    expect(points).toHaveLength(47);
    expect(points.map((p) => p.code)).toEqual([...points.map((p) => p.code)].sort());
    expect(points.filter((p) => p.akita)).toHaveLength(1);
  });

  it('reads the real Akita revenue shares', () => {
    const akita = points.find((p) => p.akita)!;
    expect(akita.name).toBe('秋田県');
    expect(akita.tax).toBeCloseTo(17.1, 5);
    expect(akita.grant).toBeCloseTo(35.1, 5);
  });

  it('puts Akita above the national mean on grant dependence and below it on own tax', () => {
    const akita = points.find((p) => p.akita)!;
    expect(akita.grant).toBeGreaterThan(meanRevenueShare(REVENUE_Y_KEY));
    expect(akita.tax).toBeLessThan(meanRevenueShare(REVENUE_X_KEY));
  });

  it('computes the mean over all 47 prefectures, not a subset', () => {
    const manual =
      fiscalData.prefectures.reduce((sum, p) => sum + (p.revenueShare[REVENUE_X_KEY] ?? 0), 0) / 47;
    expect(meanRevenueShare(REVENUE_X_KEY)).toBeCloseTo(manual, 10);
  });
});

describe('expenseCategories', () => {
  it('drops only the categories that are zero for every prefecture', () => {
    const purpose = expenseCategories('purpose');
    // 47 県すべてで 0
    expect(purpose).not.toContain('普通財産取得費');
    // 秋田県では 0 だが、他県では 0 でないので残す
    // （消防費は東京都のみ、公営企業費は12県が計上している）
    expect(purpose).toContain('消防費');
    expect(purpose).toContain('公営企業費');
    expect(purpose).toContain('民生費');
    expect(purpose).toContain('教育費');
    expect(purpose).toContain('農林水産業費');
  });

  it('keeps every category that is non-zero somewhere', () => {
    for (const mode of ['purpose', 'nature'] as const) {
      const kept = new Set(expenseCategories(mode));
      const record = mode === 'purpose' ? 'expenseByPurpose' : 'expenseByNatureShare';
      for (const key of Object.keys(fiscalData.prefectures[0][record])) {
        const nonZeroSomewhere = fiscalData.prefectures.some(
          (p) => (p[record][key] ?? 0) !== 0,
        );
        expect(kept.has(key), `${mode}/${key}`).toBe(nonZeroSomewhere);
      }
    }
  });
});

describe('expenseRanking', () => {
  it('ranks by value descending regardless of the display order', () => {
    const desc = expenseRanking('purpose', '民生費', 'desc');
    const asc = expenseRanking('purpose', '民生費', 'asc');
    const byCode = expenseRanking('purpose', '民生費', 'code');

    expect(desc).toHaveLength(47);
    expect(desc[0].rank).toBe(1);
    expect(asc[0].rank).toBe(47);

    // 同じ県の順位は表示順を変えても動かない
    for (const row of byCode) {
      expect(desc.find((d) => d.code === row.code)!.rank).toBe(row.rank);
      expect(asc.find((d) => d.code === row.code)!.rank).toBe(row.rank);
    }
  });

  it('orders code view by prefecture code and value views monotonically', () => {
    const byCode = expenseRanking('purpose', '教育費', 'code');
    expect(byCode.map((r) => r.code)).toEqual([...byCode.map((r) => r.code)].sort());

    const desc = expenseRanking('purpose', '教育費', 'desc');
    for (let i = 1; i < desc.length; i++) {
      expect(desc[i - 1].value).toBeGreaterThanOrEqual(desc[i].value);
    }
  });

  it('breaks ties by prefecture code so equal values never depend on input order', () => {
    // 性質別の 0 が並ぶ区分を使う。同値が多数あっても並びはコード昇順で決まる
    const rows = expenseRanking('nature', '投資及び出資金', 'desc');
    const zeros = rows.filter((r) => r.value === 0);
    expect(zeros.length, '同値の行がないと同点処理を検証できない').toBeGreaterThan(1);
    expect(zeros.map((r) => r.code)).toEqual([...zeros.map((r) => r.code)].sort());
  });

  it('reads real Akita values and a mean consistent with them', () => {
    const rows = expenseRanking('purpose', '農林水産業費', 'desc');
    const akita = rows.find((r) => r.akita)!;
    expect(akita.value).toBe(75165);
    expect(akita.rank).toBeLessThanOrEqual(47);

    const manual = mean(fiscalData.prefectures.map((p) => p.expenseByPurpose['農林水産業費'] ?? 0));
    expect(expenseMean('purpose', '農林水産業費')).toBeCloseTo(manual, 10);
  });
});

describe('nationalSectorShares', () => {
  it('sums to 100% and uses the same denominator as sectorShares', () => {
    const shares = nationalSectorShares('2022');
    const total = Object.values(shares).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(100, 6);

    // 県側も同じ分母（業種別の合計）で 100% になること
    const akita = industryData.years['2022'].find((p) => p.code === '05')!;
    const prefTotal = Object.values(sectorShares(akita)).reduce((a, b) => a + b, 0);
    expect(prefTotal).toBeCloseTo(100, 6);
  });

  it('matches the national shares the app cites elsewhere', () => {
    const shares = nationalSectorShares('2022');
    expect(shares['製造業']).toBeCloseTo(21.2, 1);
    expect(shares['卸売・小売業']).toBeCloseTo(13.4, 1);
    expect(shares['農林水産業']).toBeCloseTo(0.9, 1);
  });

  /**
   * 施策カードの本文は全国シェアを地の文で引用している。分母を取り違えると
   * （業種別合計ではなく gdpTotal の合計で割ると）0.1 ポイントずれ、
   * 読み手が /data の表示とカードの記述を突き合わせたときに食い違う。
   * 実際に一度その取り違えが起きたので、ここで固定する。
   *
   * カード本文に出る「全国の X%」を全部拾い、どれかの業種の計算値と
   * 一致することを確かめる（引用のたびにこのテストを直さずに済むように、
   * 期待値を列挙するのではなく突き合わせる）。
   */
  it('quotes only national shares that the app itself computes', () => {
    const shares = nationalSectorShares('2022');
    const computed = new Set(
      Object.values(shares).map((v) => v.toFixed(1)),
    );

    const quoted = [...JSON.stringify(policies).matchAll(/全国の(\d+\.\d)%/g)].map((m) => m[1]);
    expect(quoted.length, 'カード本文に全国シェアの引用がない').toBeGreaterThan(0);

    for (const value of quoted) {
      expect(
        computed.has(value),
        `カードが引用する 全国の${value}% は、どの業種の計算値とも一致しない（計算値: ${[...computed].sort().join(', ')}）`,
      ).toBe(true);
    }
  });

  it('rejects an unknown year rather than returning empty data', () => {
    expect(() => nationalSectorShares('1999')).toThrow(/unknown year/);
  });
});

describe('sectorDeviations', () => {
  const dev = sectorDeviations('05', '2022');

  it('covers every sector', () => {
    expect(dev).toHaveLength(industryData.sectors.length);
    expect(new Set(dev.map((d) => d.sector)).size).toBe(industryData.sectors.length);
  });

  it('computes diff as prefecture minus national', () => {
    for (const row of dev) {
      expect(row.diff).toBeCloseTo(row.pref - row.national, 10);
    }
  });

  it('reproduces the known Akita over- and under-weights', () => {
    const by = Object.fromEntries(dev.map((d) => [d.sector, d]));
    expect(by['農林水産業'].pref).toBeCloseTo(2.6, 1);
    expect(by['建設業'].pref).toBeCloseTo(8.2, 1);
    expect(by['保健衛生・社会事業'].pref).toBeCloseTo(11.6, 1);
    expect(by['情報通信業'].pref).toBeCloseTo(2.1, 1);
    expect(by['情報通信業'].diff).toBeLessThan(0);
    expect(by['農林水産業'].diff).toBeGreaterThan(0);
  });

  /**
   * 年度セレクタを動かしたときに行が入れ替わると、値が変わったのか行が動いたのか
   * 見分けられなくなる。並びは最新年度で固定する。
   */
  it('keeps the sector order identical across every year', () => {
    const baseline = sectorDeviations('05', industryData.latestYear).map((d) => d.sector);
    for (const year of industryYears()) {
      expect(sectorDeviations('05', year).map((d) => d.sector), year).toEqual(baseline);
    }
    // 固定された並びは、最新年度では差の降順になっている
    const latest = sectorDeviations('05', industryData.latestYear);
    for (let i = 1; i < latest.length; i++) {
      expect(latest[i - 1].diff).toBeGreaterThanOrEqual(latest[i].diff);
    }
    // 過去の年度では降順とは限らない（＝並びが年度ごとに組み替えられていない証拠）
    const old2013 = sectorDeviations('05', '2013');
    const isDesc = old2013.every((d, i) => i === 0 || old2013[i - 1].diff >= d.diff);
    expect(isDesc, '2013年度が降順になっている＝年度ごとに並べ替えている').toBe(false);
  });

  it('rejects an unknown prefecture code', () => {
    expect(() => sectorDeviations('99', '2022')).toThrow(/unknown prefecture/);
  });
});

describe('sectorTrend', () => {
  it('returns one row per year in ascending order', () => {
    const years = industryYears();
    const trend = sectorTrend('05', '農林水産業');
    expect(trend).toHaveLength(years.length);
    expect(trend.map((r) => r.year)).toEqual(years);
    expect(years[0]).toBe('2011');
    expect(years[years.length - 1]).toBe('2022');
  });

  it('agrees with sectorDeviations for the latest year', () => {
    const trend = sectorTrend('05', '建設業');
    const latest = trend[trend.length - 1];
    const dev = sectorDeviations('05', '2022').find((d) => d.sector === '建設業')!;
    expect(latest.pref).toBeCloseTo(dev.pref, 10);
    expect(latest.national).toBeCloseTo(dev.national, 10);
  });
});

describe('shortSector', () => {
  it('shortens only the long names and leaves the rest untouched', () => {
    expect(shortSector('専門・科学技術、業務支援サービス業')).toBe('専門・業務支援');
    expect(shortSector('製造業')).toBe('製造業');
  });
});

describe('prefecture comparison', () => {
  const akita = getAkita();
  const aomori = getPrefecture('02');

  it('offers the other 46 prefectures, excluding Akita, in code order', () => {
    const options = otherPrefectureOptions();
    expect(options).toHaveLength(46);
    expect(options.some((o) => o.code === '05')).toBe(false);
    expect(options.map((o) => o.code)).toEqual([...options.map((o) => o.code)].sort());
  });

  it('holds row order fixed by Akita value so changing the other prefecture never reorders rows', () => {
    const baseline = revenueCompareRows(akita, aomori).map((r) => r.key);
    for (const code of ['01', '13', '27', '47']) {
      expect(revenueCompareRows(akita, getPrefecture(code)).map((r) => r.key)).toEqual(baseline);
    }
    for (let i = 1; i < baseline.length; i++) {
      const rows = revenueCompareRows(akita, aomori);
      expect(rows[i - 1].a).toBeGreaterThanOrEqual(rows[i].a);
    }
  });

  it('draws its row set from all 47 prefectures, not from the two being compared', () => {
    // 47 県すべてで 0 の区分だけを落とす。比較中の 2 県がたまたま 0 でも行は残す
    // （残さないと、比較先を変えたときに行が現れたり消えたりする）。
    const purpose = purposeCompareRows(akita, aomori);
    expect(purpose.some((r) => r.key === '普通財産取得費')).toBe(false);
    expect(purpose.some((r) => r.key === '教育費')).toBe(true);
    // 秋田県も青森県も 0 だが、東京都が計上しているので行としては残る
    expect(purpose.some((r) => r.key === '消防費')).toBe(true);

    const revenue = revenueCompareRows(akita, aomori);
    for (const row of revenue) {
      const nonZeroSomewhere = fiscalData.prefectures.some(
        (p) => (p.revenueShare[row.key] ?? 0) !== 0,
      );
      expect(nonZeroSomewhere, row.key).toBe(true);
    }

    // 秋田・青森ともに 0 でも、他県で 0 でなければ行として残っている
    const bothZero = revenue.filter((r) => r.a === 0 && r.b === 0);
    expect(bothZero.length).toBeGreaterThan(0);
  });

  it('reads the real Akita figures for the compared series', () => {
    const revenue = revenueCompareRows(akita, aomori);
    expect(revenue.find((r) => r.key === '地方交付税')!.a).toBeCloseTo(35.1, 5);

    const purpose = purposeCompareRows(akita, aomori);
    expect(purpose.find((r) => r.key === '教育費')!.a).toBe(107718);
  });

  it('reports the three industry sectors and the scale rows for both prefectures', () => {
    const stack = industryStackRows(akita, aomori);
    expect(stack).toHaveLength(2);
    expect(stack[0].name).toBe('秋田県');
    expect(stack[0].primary + stack[0].secondary + stack[0].tertiary).toBeCloseTo(100, 0);

    const scale = scaleRows(akita, aomori);
    expect(scale.map((r) => r.label)).toEqual(['人口', '面積', '人口密度']);
    expect(scale[0].a).toBe(924620);
    expect(scale[2].a).toBeCloseTo(akita.population / akita.areaKm2, 10);
  });
});

describe('number formatting', () => {
  it('formats percentages, points and yen with their units', () => {
    expect(formatPercent(35.06)).toBe('35.1%');
    expect(formatPercent(35.14)).toBe('35.1%');
    expect(formatPercent(35, 0)).toBe('35%');
    expect(formatYen(107718.4)).toBe('107,718 円');
  });

  it('signs deviations so the direction is readable without a chart', () => {
    expect(formatPoint(1.72)).toBe('+1.7 ポイント');
    expect(formatPoint(-2.64)).toBe('-2.6 ポイント');
    expect(formatPoint(0)).toBe('0.0 ポイント');
    // -0.04 は四捨五入で 0 になる。ここに負号を付けない
    expect(formatPoint(-0.04)).toBe('0.0 ポイント');
  });
});

describe('average labels', () => {
  /**
   * 財政と産業で「全国」の意味が違う（47県の単純平均 / 47県の合計から算出）。
   * ラベルが同じ文字列になると読み手が取り違えるので、別物であることを固定する。
   */
  it('gives the two different national definitions distinguishable labels', () => {
    expect(FISCAL_AVERAGE_LABEL).not.toBe(INDUSTRY_AVERAGE_LABEL);
    expect(FISCAL_AVERAGE_LABEL).toContain('単純平均');
    expect(INDUSTRY_AVERAGE_LABEL).toContain('合計');
    // どちらも裸の「全国平均」ではない（どちらの平均か分からなくなるため）
    expect(FISCAL_AVERAGE_LABEL).not.toBe('全国平均');
    expect(INDUSTRY_AVERAGE_LABEL).not.toBe('全国平均');
  });

  /** ラベルの定義と実際の計算が食い違わないこと */
  it('computes each average the way its label claims', () => {
    // 財政: 47 県の単純平均
    const simple =
      fiscalData.prefectures.reduce((sum, p) => sum + (p.revenueShare['地方交付税'] ?? 0), 0) / 47;
    expect(meanRevenueShare('地方交付税')).toBeCloseTo(simple, 10);

    // 産業: 47 県の合計から算出（各県シェアの単純平均ではない）
    const list = industryData.years['2022'];
    const naiveMean = mean(list.map((p) => sectorShares(p)['製造業'] ?? 0));
    const aggregate = nationalSectorShares('2022')['製造業'];
    expect(aggregate).not.toBeCloseTo(naiveMean, 2);
  });
});
