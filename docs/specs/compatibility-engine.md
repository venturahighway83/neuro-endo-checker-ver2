# Compatibility Engine Specification

**Package:** `packages/core/src/engine.ts`
**Status:** 仕様確定・実装更新待ち（diameter check を要変更）

---

## 確定した決定事項

| 項目 | 決定内容 | 決定者 |
|------|----------|--------|
| 不等号 | **strict `<`** (equal は INCOMPATIBLE) | 医師確認済み |
| 比較単位 | **inch** (mm に変換せず inch のまま比較) | 医師確認済み |
| margin | **0.001 inch** を outer の有効 ID から差し引いて比較 | 医師確認済み |
| category check | **engine が実施** (caller 責任ではない) | — |
| 2デバイスペア | **有効** (skip check はあるが可能) | — |

---

## 3 つのチェック

### 1. Diameter Check

比較は **inch 単位** で行う。outer の有効 ID から **0.001 inch** の margin を差し引いてから strict `<` で判定する。

```
MARGIN = 0.001  (inch, fixed)

inner_od_inch          = inner.od_fr / 76.2
  ↑ 1 French = 1/3 mm = 1/76.2 inch (exact: 25.4 × 3 = 76.2)

effective_outer_id_inch = outer.id_inch − MARGIN

DIAMETER_OK:           inner_od_inch < effective_outer_id_inch   (strict <)
DIAMETER_INCOMPATIBLE: inner_od_inch ≥ effective_outer_id_inch
DIAMETER_UNKNOWN:      outer.id_inch または inner.od_fr が正の有限数でない
```

**mm 換算での等価表現（参考）:**
```
0.001 inch = 0.0254 mm
inner_od_mm < outer_id_mm − 0.0254
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
| ≥+2 | CATEGORY_SKIP | warning |
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

3 つのチェック結果のうち最高優先度が全体の status になる。

---

## 返却型

```typescript
interface CompatibilityResult {
  compatible: boolean | null;  // true=ok/warning, false=incompatible, null=unknown
  status: 'ok' | 'warning' | 'incompatible' | 'unknown';
  reasons: CheckOutcome[];     // 3 要素 (category, diameter, length)
  warnings: CheckOutcome[];    // reasons のうち status='warning' のサブセット
  derived_metrics: DerivedMetrics;
  evidence_state: EvidenceState;
}

interface DerivedMetrics {
  // --- Inch-based (比較に使用した値) ---
  inner_od_inch: number | null;           // inner.od_fr / 76.2
  effective_outer_id_inch: number | null; // outer.id_inch − 0.001 (margin 適用後)
  clearance_inch: number | null;          // effective_outer_id_inch − inner_od_inch
  // --- mm 換算 (表示用参考値) ---
  outer_id_mm: number | null;      // outer.id_inch × 25.4
  inner_od_mm: number | null;      // inner.od_fr × (1/3)
  clearance_mm: number | null;     // (outer.id_inch − 0.001) × 25.4 − inner_od_mm
  // --- その他 ---
  length_delta_cm: number | null;  // inner.length_cm − outer.length_cm
  category_delta: number | null;   // inner_level − outer_level
}

interface EvidenceState {
  outer_id_inch:   'present' | 'missing';
  inner_od_fr:     'present' | 'missing';
  outer_length_cm: 'present' | 'missing';
  inner_length_cm: 'present' | 'missing';
}
```

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
| `DIAMETER_OK` | diameter | ok | inner_od_inch < outer.id_inch − 0.001 |
| `DIAMETER_INCOMPATIBLE` | diameter | incompatible | inner_od_inch ≥ outer.id_inch − 0.001 |
| `DIAMETER_UNKNOWN` | diameter | unknown | id_inch or od_fr 欠損 |
| `CATEGORY_ADJACENT` | category | ok | delta = +1 |
| `CATEGORY_SKIP` | category | warning | delta ≥ +2 |
| `CATEGORY_SAME` | category | incompatible | delta = 0 |
| `CATEGORY_REVERSED` | category | incompatible | delta < 0 |
| `CATEGORY_UNKNOWN` | category | unknown | 不明なカテゴリ文字列 |
| `LENGTH_SUFFICIENT` | length | ok | delta_cm ≥ 0 |
| `LENGTH_INSUFFICIENT` | length | incompatible | delta_cm < 0 |
| `LENGTH_UNKNOWN` | length | unknown | length_cm 欠損 |

---

## 設計上の制約

- **UI 文言はここで生成しない** — ReasonCode を受け取った UI 層が日本語/英語を選択する
- **unknown を warning に丸めない** — データが不足している場合は必ず `null` を返す
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

## Unresolved 論点

| 項目 | 状態 |
|------|------|
| length compatibility の臨床的意味 | **解決済み (2026-03-21)**: LENGTH_INSUFFICIENT は incompatible。delta_cm < 0 の場合、inner は outer の先端を超えられないため物理的に不可とみなす |
| 3デバイス全体の aggregate status | checkThreeWay は 2 つの CompatibilityResult を返す。3way 全体の集約ロジックは UI 層の責任 |
| CATEGORY_SKIP の臨床的可否 | ガイディング → マイクロ直接は warning (compatible=true) だが、実臨床での妥当性は未確認 |

---

## 関連ファイル

- `packages/core/src/engine.ts` — 実装本体
- `packages/core/src/units.ts` — 単位変換 (inchToMm, frToMm)
- `packages/core/src/__tests__/engine.test.ts` — テスト
