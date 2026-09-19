# Master Device Schema

**File:** `packages/device-master/master.json`
**Schema version:** 0.2.0

## 近位・遠位の寸法（0.2.0）

| CSV / JSON フィールド | 意味 | 単位 |
|---|---|---|
| `proximal_id_inch` | 近位内径 | inch |
| `proximal_od_inch` | 近位外径 | inch |
| `distal_id_inch` | 遠位内径 | inch |
| `distal_od_inch` | 遠位外径 | inch |

CSV は空欄・列省略を許容し、JSON は必ず4項目を出力して未登録を `null` とする。
入力値は有限の正の数値のみ（単位文字列なし）。一部の項目だけ登録することも可能。
既存の `id_inch` / `od_fr` は従来値として保持する。部位未区別の一般外径は近位外径、一般内径は遠位内径へ登録する（2026-09-18ユーザー指定）。明示部位の値を優先し、型式不一致・寸法種別不明の値は保留する。
割当は出典確認とともに編集CSVに記録し、汎用の正規化処理では無条件補完しない。各補完値は出典記録の `assignment: "user_convention"` で識別する。
既存コードとの互換性のため TypeScript の Device 型では4項目の省略も許容する。

現在の145件を編集するCSVは `packages/device-master/raw/devices.csv`。
既存 master.json から作成した編集用コピーであり、新たにシートから取得したものではない。
確認済み値を入力した後、以下のコマンドで再生成する。

```bash
pnpm --filter @neuro-endo/device-master validate --input raw/devices.csv
pnpm --filter @neuro-endo/device-master normalize --input raw/devices.csv
```

Google Sheets を使う場合も同じ4列を追加してエクスポートする。シート自体は今回変更していない。
部位別データ登録後に旧形式CSVを取り込むと4項目は `null` に戻るため、最新のCSVを使用すること。
`source_url` は従来のシートURLを保持し、各部位の寸法の個別出典を保証するものではない。
3D表示は内径・外径それぞれの両端が揃う場合に近位から遠位へ線形補間する。片端が欠ける径は従来のid_inch / od_frによる一定径を使用する。適合性判定は引き続き従来の寸法を使用する。
テーパーの長さや形状は本スキーマでは定義しない。

### 公開資料による補完（2026-09-18）

部位別4項目には、ユーザーの依頼に基づきメーカー資料・規制当局公開資料・原著論文から確認した値を登録した。
各値の出典・原単位・inch換算・製品対応・保留理由は
`packages/device-master/evidence/regional-diameters.json` に保存する。
集計と全製品の調査状況は [調査結果](../research/regional-diameters-2026-09-18.md) を参照。
論文でのみ確認した値や元一覧の一般径をメーカー確認済みと扱わない。部位不明の一般径は上記ルールで割り当て、型式不一致やワイヤー径との区別がつかない値は未登録のままにする。
編集時はCSV・出典記録・master.jsonを一致させ、`regional-evidence.test.ts` と既存のCSV再生成テストを実行する。

---

## Data Provenance

```
Google Sheets (legacy fields の上流データ。部位別4項目の補完出典は上記記録)
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
  "schema_version": "0.2.0",       // このスキーマのバージョン（デバイスデータのバージョンではない）
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

## 既存データの不整合

| 行 | デバイス名 | 問題 | 状態 |
|---|---|---|---|
| 46 | `6F Guider Softip (90 cm)` | name="90 cm" だが length_cm=100 | ✅ 修正済み |
| 107 | `Phenom 27 (160 cm)` | name="27" だが id_inch=0.021。2026-09-18の実データでも残存 | 要確認。公式160 cm品の単一IDは0.027。今回旧値は未変更 |

---

## UNRESOLVED 論点

| 項目 | 詳細 |
|------|------|
| `id_mm` / `od_mm` 列の将来 | upstream が値を入れ始めた場合の扱いを決める必要あり |
| デバイスリストの完全性 | 120 件が網羅的かどうか未確認 |
| 更新頻度・運用フロー | 手動 CSV エクスポートのみ。GitHub Actions 自動化は検討事項 |
