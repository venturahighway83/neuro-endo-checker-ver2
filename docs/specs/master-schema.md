# Master Device Schema

**File:** `packages/device-master/master.json`
**Schema version:** 0.1.0

---

## Data Provenance

```
Google Sheets (upstream — canonical source of truth)
    │
    │  手動エクスポート (CSV, UTF-8)
    ▼
packages/device-master/raw/<date>.csv
    │
    │  pnpm --filter @neuro-endo/device-master validate -- --input raw/<file>.csv
    │  (エラーが出たら修正して再実行)
    ▼
packages/device-master/raw/<file>.csv  (エラーゼロ)
    │
    │  pnpm --filter @neuro-endo/device-master normalize -- --input raw/<file>.csv
    ▼
packages/device-master/master.json   ← アプリが読む唯一のファイル
```

`master.json` はリポジトリにコミットされます。
アプリは master.json だけを読みます。raw CSV もシートも直接参照しません。

---

## Raw Schema (Google Sheets 列定義)

### 列インベントリ

| 列名 | 必須 | 型 | 状態 | 説明 |
|------|------|---|------|------|
| `name` | ✅ | string | 確定 | デバイス表示名。サイズ・長さのバリアントを含む |
| `category` | ✅ | string enum | 確定 | `ガイディング` / `中間` / `マイクロ` のいずれか |
| `maker` | ✅ | string | 確定 | メーカー名 |
| `length_cm` | ✅ | number (>0) | 確定 | 全長 (cm) |
| `id_inch` | ✅ | number (>0) | 確定 | 内径 (inch) |
| `od_fr` | ✅ | number (>0) | 確定 | 外径 (French) |
| `notes` | — | string | 確定 | 備考 (空可) |
| `id_mm` | — | string | **UNRESOLVED** | 常に空。将来のデータ変更を検知するために列は保持 |
| `od_mm` | — | string | **UNRESOLVED** | 常に空。同上 |

### UNRESOLVED 列について

`id_mm` と `od_mm` は upstream で**常に空**です。
- 正規化後の master.json には含まれません
- もし値が入っていた場合、validate が `UNEXPECTED_VALUE (warning)` を報告します
- アプリは diameter 計算に `id_inch` / `od_fr` のみを使います

---

## Normalized Schema (master.json)

### トップレベル

```jsonc
{
  "schema_version": "0.1.0",       // このスキーマのバージョン（デバイスデータのバージョンではない）
  "generated_at": "<ISO 8601>",    // normalize 実行時刻 (UTC)
  "source_url": "<Google Sheets URL>",
  "devices": [/* Device[] */]
}
```

### Device オブジェクト

| フィールド | 型 | 制約 | 説明 |
|-----------|---|------|------|
| `id` | string | 非空、ユニーク | スラグ。`generateSlug(name)` で生成 |
| `name` | string | 非空 | 表示名（空白トリム済み） |
| `category` | `"ガイディング"` \| `"中間"` \| `"マイクロ"` | enum | カテゴリ |
| `maker` | string | 非空 | メーカー名（空白トリム済み） |
| `id_inch` | number | > 0 | 内径 (inch) |
| `od_fr` | number | > 0 | 外径 (French) |
| `length_cm` | number | > 0 | 全長 (cm) |
| `notes` | string | — | 備考（空文字列可） |

### カテゴリ階層（ネスト順）

```
ガイディング  (guiding)      — 最外層
    └─ 中間         (intermediate / distal access)
           └─ マイクロ  (micro)  — 最内層
```

### 単位変換（アプリがクエリ時に実行）

```
内径 (mm) = id_inch × 25.4        // NIST 定義 (exact)
外径 (mm) = od_fr   × (1/3)       // ISO 10555 French convention
```

実装: `packages/core/src/units.ts`

---

## Slug 生成規則

```
1. lowercase
2. " cm" (スペース + 単位) を "cm" に置換
3. 英数字以外の連続を "-" 1つに置換
4. 先頭・末尾の "-" を除去
```

例:
| name | id |
|---|---|
| `6F Roadmaster (90 cm)` | `6f-roadmaster-90cm` |
| `TACTICS Plus (120 cm)` | `tactics-plus-120cm` |
| `Carnelian MARVEL Non Taper` | `carnelian-marvel-non-taper` |
| `4.2F Fubuki` | `4-2f-fubuki` |

同一スラグが衝突した場合は `-2`, `-3` を付与（validate の重複エラーが先に検出するはず）。

---

## Validation ルール

| コード | 重大度 | 条件 |
|--------|--------|------|
| `MISSING_REQUIRED` | error | 必須フィールドが空 |
| `INVALID_NUMERIC` | error | 数値フィールドが数値として解釈不可 |
| `NOT_POSITIVE` | error | 数値フィールドが ≤ 0 |
| `INVALID_CATEGORY` | error | category が有効値以外 |
| `DUPLICATE_NAME` | error | 同一 name が複数行に存在 |
| `UNEXPECTED_VALUE` | warning | UNRESOLVED 列 (id_mm, od_mm) に値がある |

---

## 過去のデータ不整合（解決済み）

| 行 | デバイス名 | 問題 | 状態 |
|---|---|---|---|
| 46 | `6F Guider Softip (90 cm)` | name="90 cm" だが length_cm=100 | ✅ 修正済み |
| 107 | `Phenom 27 (160 cm)` | name="27" だが id_inch=0.021 | ✅ 修正済み |

---

## UNRESOLVED 論点

| 項目 | 詳細 |
|------|------|
| `id_mm` / `od_mm` 列の将来 | upstream が値を入れ始めた場合の扱いを決める必要あり |
| デバイスリストの完全性 | 120 件が網羅的かどうか未確認 |
| 更新頻度・運用フロー | 手動 CSV エクスポートのみ。GitHub Actions 自動化は検討事項 |
