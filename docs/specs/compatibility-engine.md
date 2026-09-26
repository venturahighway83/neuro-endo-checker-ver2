# Compatibility Engine Specification

**Package:** `packages/core/src/engine.ts`
**Status:** 実装済み（2026-09-24：1本挿入の近位・遠位径条件をともに `≤` に更新）

---

## 確定した決定事項

| 項目 | 決定内容 | 決定者 |
|------|----------|--------|
| 不等号（1本挿入） | **近位・遠位とも `≤`**（マージン適用後の一致も適合） | ユーザー指定（2026-09-24） |
| 不等号（2本同時挿入） | 合計外径を **strict `<`** で比較（近位・遠位とも既存条件を維持） | 医師確認済み |
| 比較単位 | **inch** (mm に変換せず inch のまま比較) | 医師確認済み |
| margin | **0.001 inch** を outer の有効 ID から差し引いて比較 | 医師確認済み |
| 比較部位 | **近位同士・遠位同士**で比較し、両方を満たす場合のみ径が適合 | ユーザー指定（2026-09-24） |
| category check | **engine が実施** (caller 責任ではない) | — |
| 2デバイスペア | **有効** (skip check はあるが可能) | — |

---

## 3 つのチェック

### 1. Diameter Check

比較は **inch 単位** で、近位同士・遠位同士の2回行う。それぞれの outer 内径から **0.001 inch** の margin を差し引き、近位・遠位とも `≤` で判定する。

```
MARGIN = 0.001  (inch, fixed)

近位: inner.proximal_od_inch ≤ outer.proximal_id_inch − MARGIN
遠位: inner.distal_od_inch   ≤ outer.distal_id_inch   − MARGIN

各部位:
  inner_od_inch           = inner[region + '_od_inch']
  effective_outer_id_inch = outer[region + '_id_inch'] − MARGIN

DIAMETER_OK:           inner_od_inch ≤ effective_outer_id_inch（近位・遠位共通）
DIAMETER_INCOMPATIBLE: inner_od_inch > effective_outer_id_inch（近位・遠位共通）
DIAMETER_UNKNOWN:      その部位の必要な内径・外径が正の有限数でない
```

両部位が `ok` の場合のみ径が適合。片方が `incompatible` なら径は不適合。
不適合がなく片方でも `unknown` なら判定不明。従来の `id_inch`・`od_fr` や反対側の値による補完は行わない。
近位外径と遠位内径など、異なる部位同士の比較は行わない。

近位・遠位とも入力数値の十進表記を整数化して差を計算し、追加の許容誤差は設けない。
例: `0.030 − 0.001 − 0.029 = 0` は適合、外径 `0.02900001` は不適合。
有効内径・余裕の表示用数値にも同じ十進計算を使用する。2本同時挿入の計算は従来どおり。

**mm 換算での等価表現（参考）:**
```
0.001 inch = 0.0254 mm
近位: inner_od_mm ≤ outer_id_mm − 0.0254
遠位: inner_od_mm ≤ outer_id_mm − 0.0254
```

この基準は margin なし (v1) より **厳しい**。
等径デバイス (inner_od = outer_id) は margin 分だけ追加で不合格になる。

### 2. Category Check

カテゴリ階層:

```
ガイディング = level 0  (最外層)
中間         = level 1
マイクロ     = level 2  (最内層)
```

delta = inner_level − outer_level

| delta | コード | status |
|-------|--------|--------|
| +1 | CATEGORY_ADJACENT | ok |
| ≥+2 | CATEGORY_SKIP | ok |
| 0 | CATEGORY_SAME | incompatible |
| <0 | CATEGORY_REVERSED | incompatible |
| どちらかが未知 | CATEGORY_UNKNOWN | unknown |

### 3. Length Check

```
delta_cm = inner.length_cm − outer.length_cm

LENGTH_SUFFICIENT:   delta_cm >= 0  (inner が outer 先端以上に到達できる)
LENGTH_INSUFFICIENT: delta_cm < 0   (inner が outer より短い) → incompatible
LENGTH_UNKNOWN:      どちらかの length_cm が正の有限数でない
```

---

## Aggregate Status Priority

```
incompatible (3) > unknown (2) > warning (1) > ok (0)
```

カテゴリ・近位径・遠位径・長さの4結果のうち最高優先度が全体の status になる。
既知の不適合がある場合は、別項目が不明でも全体は不適合。

## 2本同時挿入

近位・遠位それぞれで、2本の内側カテーテルの外径を合計して比較する。

```
clearance(region) = outer[region + '_id_inch'] − 0.001
                   − inner1[region + '_od_inch'] − inner2[region + '_od_inch']

clearance ≤ 0:         incompatible
0 < clearance ≤ 0.001: warning
clearance > 0.001:     ok
必要な部位別径が欠損: unknown
```

両部位の結果を同じ優先順位で集約する。`compatible=true` は両部位とも `ok` または `warning` の場合のみ。
同時挿入関数は径のみを判定し、カテゴリと長さは各カテーテルの個別判定で確認する。

---

## 返却型

```typescript
interface CompatibilityResult {
  compatible: boolean | null;  // true=ok/warning, false=incompatible, null=unknown
  status: 'ok' | 'warning' | 'incompatible' | 'unknown';
  reasons: CheckOutcome[];     // 4 要素 (category, diameter近位, diameter遠位, length)
  warnings: CheckOutcome[];    // reasons のうち status='warning' のサブセット
  derived_metrics: DerivedMetrics;
  evidence_state: EvidenceState;
}

interface RegionalDiameterMetrics {
  // --- 部位ごとに比較した値 ---
  outer_id_inch: number | null;          // 当該部位の外側内径
  inner_od_inch: number | null;          // 当該部位の内側外径
  effective_outer_id_inch: number | null; // 当該部位の外側内径 − 0.001
  clearance_inch: number | null;          // effective_outer_id_inch − inner_od_inch
  // --- mm 換算 (表示用参考値) ---
  outer_id_mm: number | null;      // outer_id_inch × 25.4
  inner_od_mm: number | null;      // inner_od_inch × 25.4
  clearance_mm: number | null;     // clearance_inch × 25.4
}

interface DerivedMetrics extends RegionalDiameterMetrics {
  proximal: RegionalDiameterMetrics;
  distal: RegionalDiameterMetrics;
  // トップレベルの径・余裕は余裕の小さい部位の値。
  // 片方でも判定不能ならトップレベルの径・余裕と limiting_region は null。
  limiting_region: 'proximal' | 'distal' | null;
  // --- その他 ---
  length_delta_cm: number | null;  // inner.length_cm − outer.length_cm
  category_delta: number | null;   // inner_level − outer_level
}

interface EvidenceState {
  outer_proximal_id_inch: 'present' | 'missing';
  outer_distal_id_inch:   'present' | 'missing';
  inner_proximal_od_inch: 'present' | 'missing';
  inner_distal_od_inch:   'present' | 'missing';
  outer_length_cm: 'present' | 'missing';
  inner_length_cm: 'present' | 'missing';
}
```

径の `CheckOutcome` には `region: 'proximal' | 'distal'` を付け、`evidence` にその部位の数値を返す。
2本同時挿入は `diameter_dual` を2要素返し、各部位の外径①・外径②・合計外径・余裕を記録する。
UIは近位径・遠位径を区別して表示する。適合性チェック欄は従来どおり不適合の結果のみを表示する。

### プルダウン候補の表示

適合性による候補の絞り込みは行わず、各プルダウンの対象カテゴリに含まれる全デバイスを表示する。
内腔カテーテル①・②および中間内のマイクロ①・②は、外側・もう1本の選択にかかわらず、
個別判定や2本同時挿入が `incompatible` となる候補も表示・選択できる。
名称・メーカーの検索は引き続き利用できる。選択した組み合わせが不適合の場合は、既存の適合性チェック欄に表示する。

### compatible の意味

| compatible | status | 意味 |
|---|---|---|
| `true` | `ok` | 全チェック通過 |
| `true` | `warning` | 通過できるが注意事項あり |
| `false` | `incompatible` | 物理的に通過不可、またはカテゴリ違反 |
| `null` | `unknown` | データ不足で判定不可 |

`true` は「推奨」を意味しない。warnings を UI で提示すること。

---

## ReasonCode 一覧

| コード | check | status | 条件 |
|--------|-------|--------|------|
| `DIAMETER_OK` | diameter | ok | 当該部位の内側外径 ≤ 外側内径 − 0.001 |
| `DIAMETER_INCOMPATIBLE` | diameter | incompatible | 当該部位の内側外径 > 外側内径 − 0.001 |
| `DIAMETER_UNKNOWN` | diameter | unknown | 当該部位の必要な内径・外径が欠損・無効 |
| `CATEGORY_ADJACENT` | category | ok | delta = +1 |
| `CATEGORY_SKIP` | category | ok | delta ≥ +2 |
| `CATEGORY_SAME` | category | incompatible | delta = 0 |
| `CATEGORY_REVERSED` | category | incompatible | delta < 0 |
| `CATEGORY_UNKNOWN` | category | unknown | 不明なカテゴリ文字列 |
| `LENGTH_SUFFICIENT` | length | ok | delta_cm ≥ 0 |
| `LENGTH_INSUFFICIENT` | length | incompatible | delta_cm < 0 |
| `LENGTH_UNKNOWN` | length | unknown | length_cm 欠損 |

---

## 設計上の制約

- **UI 文言はここで生成しない** — ReasonCode を受け取った UI 層が日本語/英語を選択する
- **unknown を warning に丸めない** — データ不足の項目は unknown。既知の不適合がなければ全体も unknown、compatible=null
- **notes フィールドを解釈しない** — notes は engine から見えない
- **margin 定数 `MARGIN_INCH = 0.001` はエンジン内部の定数** — UI 層や呼び出し元が変更できない。変更する場合はスキーマバージョンを上げる

---

## Decision Log

| 日付 | 項目 | 決定内容 |
|------|------|----------|
| 2026-03-21 | 不等号 | strict `<` (equal は INCOMPATIBLE) |
| 2026-03-21 | 比較単位 | inch のまま比較 (mm 変換しない) |
| 2026-03-21 | margin | 0.001 inch を outer の有効 ID から差し引く |
| 2026-03-21 | LENGTH_INSUFFICIENT | incompatible (warning ではない) |
| 2026-09-24 | 部位別径 | 近位同士・遠位同士を別々に比較し両方の通過を必須化。2本同時挿入にも適用 |
| 2026-09-24 | 近位の境界 | 1本挿入の近位条件を `≤` に変更し、0.001 inchのすき間ちょうどを適合とする。遠位の `<`、2本同時挿入、欠損・カテゴリ・長さの扱いは維持 |
| 2026-09-24 | 遠位の境界 | 追加指定により1本挿入の遠位条件も `≤` に変更。近位・遠位とも0.001 inchのすき間ちょうどを適合とする。2本同時挿入、欠損・カテゴリ・長さの扱いは維持 |

## Unresolved 論点

| 項目 | 状態 |
|------|------|
| length compatibility の臨床的意味 | **解決済み (2026-03-21)**: LENGTH_INSUFFICIENT は incompatible。delta_cm < 0 の場合、inner は outer の先端を超えられないため物理的に不可とみなす |
| 3デバイス全体の aggregate status | checkThreeWay は 2 つの CompatibilityResult を返す。3way 全体の集約ロジックは UI 層の責任 |
| CATEGORY_SKIP の実装 | ガイディング → マイクロ直接は ok。2026-09-24時点の既存実装に仕様書を同期 |

---

## 関連ファイル

- `packages/core/src/engine.ts` — 実装本体
- `packages/core/src/units.ts` — 単位変換 (inchToMm, frToMm)
- `packages/core/src/__tests__/engine.test.ts` — テスト
- `packages/core/src/__tests__/regional-compatibility.test.ts` — 部位別径・欠損・境界値・2本同時挿入のテスト
