# Master Device Schema

**File:** `packages/device-master/master.json`
**Schema version:** 0.4.0

## 3Dのハブ表示（2026-09-26）

カテーテル本体の手元端に中空のハブを追加し、その後方にYコネクターを配置する。
表示長は、資料記載の `hub_length_cm` を使用し、未登録の場合は5 cmの想定値とする。
最新のユーザー指定により、算出した `proximal_non_effective_length_cm` はハブ長の代用にしない。
登録値には有限かつ正の値のみ使用する。
上段のデバイス情報はカテーテル長を「有効長」と表示し、独立した「3Dハブ表示」の行は設けない。
3D内の注記とデバイスラベルの補足に、未登録時の想定値の扱いを示す。
デバイス名は3Dパネル右上（コネクター表示切替の下）に色付きの一覧として固定する。
回転・ズームに追従させず、モデルへの引き出し線は表示しない。長い名称は折り返し、多数選択時は一覧内をスクロールできる。

ハブ・カテーテル本体・コネクターの長さは同じ縮尺を使用する。
ハブの幅・テーパー・カラー部は模式形状であり、製品固有の形状を再現するものではない。
Y／トリコネクターの幅をハブ側に合わせ、接続部分の外径をハブの手元端と一致させる。
側孔の入口位置にも同じ幅を反映する。
内側カテーテルはコネクター入口から5 cm露出し、ハブを通って本体内へ入る。
経路全体を元のカテーテル長に収めるため、ハブを通る分だけ先端側への到達距離が短くなる。
コネクターを非表示にしてもハブは表示する。

5 cmは表示上の仮値であり、CSV・JSON・Excelの未登録値は補完しない。
既存の適合性判定にはハブ長を加算しない。

### 3D内の先端突出長

3Dパネル左上に、内側カテーテルが直近の親カテーテル先端から最大で出る長さを表示する。
パネル用には手元露出を0 cmにして経路を計算し、親のコネクター・ハブ・曲がりを通って親の先端へ至る距離を求め、
内側カテーテルの有効長から引く。表示用の長さ縮尺を戻し、小数1桁のcmで表示する。
3Dモデルは手元露出5 cmの配置を維持する。最大値の計算では、その5 cmを差し引かない。
例：RIST079 95 cm（ハブ未登録）とGuidepost 120 cmは、120 − 95 − Yコネ5 − ハブ5 = 最大15 cm。
正は「出る」、負は「手前」、小数1桁に丸めて0なら「先端と同じ位置」とする。
最大突出長が5 cm以下の行は数値を赤色にし、「注意：最大でも5 cm以下です」を赤字の太字・赤枠・赤みのある背景で目立たせる。
5 cmちょうど・先端一致・未到達も含め、5 cmを超える行には表示しない。
判定は小数1桁の表示丸め前の値を用い、経路計算の数値誤差のみ小数9桁で丸めて除く。
複数本はそれぞれの親とポートを区別し、親が未選択の場合は表示しない。
各行に計算で使用した親側のY／トリコネクター長とハブ長を表示する。
親のハブ長が未登録なら5 cmを使い、結果に「想定値」、根拠行に「ハブ 5 cm（想定値）」と明記する。
内側カテーテル自身のハブは、そのカテーテルの親からの突出長には差し引かない。
見出しは「先端からどれくらい出るか」とし、「最大挿入時」を添える。「3D上の目安」の文言は表示しない。
適合性判定の計算値ではなく、コネクターを非表示にしても最大挿入時の同じ値を表示する。

## ハブ情報の出典・算出値（0.4.0）

| CSV / JSON フィールド | 意味 | 未登録 |
|---|---|---|
| `hub_length_source` | 資料記載のハブ長の出典。実測値を含む資料はその旨も明示 | 空文字 |
| `proximal_non_effective_length_cm` | ハブ側の非有効長（cm）：同一型式の全長 − 有効長 | CSV空欄 / JSON null |
| `proximal_length_source` | 算出に用いた公開資料のURL | 空文字 |
| `proximal_length_note` | 資料名・版・ページ・計算式・測定範囲 | 空文字 |

算出値はハブ単体の寸法を保証しないため、`hub_length_cm` に代入しない。
図で有効長の端点とハブ側の構造を確認し、ストレインリリーフ等を含む範囲を注記する。
算出値の登録時は出典URLと測定範囲の説明を必須とする。数値は有限かつ正のみ。
汎用の正規化処理は入力済みの値を変換するだけで、未確認の製品や別型式を自動補完しない。
旧CSVでは数値null、出典・注記は空文字に正規化する。Device型は省略も許容する。

Webは「ハブ長」と「ハブ側の非有効長（算出）」を分けて表示する。
上段のハブ長に「（資料記載）」は付けず、出典・算出根拠の詳細欄も表示しない。出典データは保持する。
Excelにも上記4列を追加する。双方とも既存の適合性計算には使用しない。
公開資料の個別出典、SHA-256、照合記録は `evidence/hub-lengths.json` の
`public_sources` / `derived_records` に保存。10件の算出値を登録（既存25件との重複8件）。
ハブに関する何らかの数値情報は145件中27件、未確認は118件。

## ハブ長（0.3.0）

`hub_length_cm` をCSV・JSONに追加。ハブ部分の長さ（cm）を格納する。
CSVは空欄・列省略を許容し、JSONは必ず出力して未登録を `null` とする。
入力は有限の正の数値のみ。既存の `length_cm` とは別項目として保持する。
TypeScriptのDevice型では旧データとの互換性のため省略も許容する。

2026-09-26に、ユーザー提供の `アクセス製品スペック一覧（Stryker）.xlsx` の
「スペック表」N列（ハブ長、cm）から、製品・サイズ・有効長が対応する25件を登録した。
資料には「ハブ長は実測値を含む」「製品公差、特に長さの公差に留意」と記載されている。
元ファイルのハッシュ、参照セル、照合理由、保留対象は
`packages/device-master/evidence/hub-lengths.json` に記録する。
取り込み範囲と未登録理由は [ハブ長の取り込み結果](../research/hub-lengths-2026-09-26.md) を参照。

Webのデバイス情報にハブ長を表示し、未登録は「—」とする。
当初の項目追加では、既存のカテーテル長・適合性計算・3D形状を変更していない。
その後の3D反映は上記「3Dのハブ表示」に従う。
`device_info.xlsx` にも同じ `hub_length_cm` 列を追加する。
旧形式CSVで再生成するとハブ長が `null` に戻るため、最新の編集CSVを使用すること。

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
| `hub_length_cm` | — | number (>0) | 任意 | ハブ部分の長さ (cm)。空欄は未登録 |
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
  "schema_version": "0.4.0",       // このスキーマのバージョン（デバイスデータのバージョンではない）
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
| `hub_length_cm` | number \| null | 有限かつ > 0、またはnull | ハブ部分の長さ (cm)。未登録はnull |
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
