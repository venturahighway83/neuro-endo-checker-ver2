# ハブ長・ハブ側の非有効長の調査結果（2026-09-26）

資料に「ハブ長」と記載された値は25件。公開資料から算出したハブ側の非有効長は10件。
8件が重複するため、何らかの数値情報があるのは145件中27件、未確認は118件。
今回の公開資料調査で新たに数値情報を得たのはMarathonとCerulean DD6（113 cm）。
全製品・全公開資料を網羅した調査ではない。下記に確認できた範囲と未採用理由を記す。

## 公開資料からの算出

全長と有効長の差は、ハブに加えてストレインリリーフなどを含む場合がある。
そのため、資料記載の `hub_length_cm` とは別に `proximal_non_effective_length_cm` へ保存する。
いずれもカタログ・電子添文に記載された値の差であり、ハブ単体の実測値ではない。

| 対象 | 有効長 → 全長 (cm) | 算出値 (cm) | 測定範囲・出典 |
|---|---|---|---|
| Marathon | 165 → 170 | 5 | ストレインレリーフ、アウターストレインレリーフ、ハブを含む。図A/Bを確認。[PMDA電子添文、2021年4月第3版、p.1](https://www.info.pmda.go.jp/downfiles/md/PDF/530366/530366_21800BZY10005000_A_04_04.pdf) |
| TACTICS | 120 → 128、130 → 138、150 → 158 | 8 | ストレインリリーフとクリアハブを含む。[メーカーのカタログ、p.2](https://www.technocrat-corp.com/wp/wp-content/uploads/2025/08/catalog-TACTICS.pdf) |
| TACTICS Plus | 120 → 128、125 → 133、130 → 138、140 → 148、150 → 158 | 8 | ストレインリリーフとクリアハブを含む。[メーカーのカタログ REF No.24050300、p.2](https://technocrat-corp.com/wp/wp-content/themes/technocrat/pdf/catalog-TACTICS-PLUS.pdf) |
| Cerulean DD6（113 cm） | 113 → 118 | 5 | 図の有効長端より手元の透明カテーテルハブ側。ハブ単体寸法の明記なし。OB1108 / AO60BG0.17G (M)。[メディキットカタログ、2012年10月、p.2、学会サイト掲載](https://www.ec-pro.co.jp/23hokkaido-jsnet/exhibition/Medikit/CeruleanDD6.pdf) |

PDFを取得し寸法図と表を目視確認。資料の版・取得日・SHA-256・製品別の対応理由を出典記録に保存した。
Ceruleanは旧版資料による参考情報で、現行販売仕様の保証ではない旨をExcel・アプリの根拠欄にも記載した。
TACTICSの資料記載ハブ長8 cmと算出した非有効長8 cmは数値が一致するが、同じ寸法定義と断定しない。

## 公開資料で数値を採用しなかった例

| 対象 | 確認資料・未採用理由 |
|---|---|
| 通常TACTICS 125 / 140 cm | カタログは標準3長のみ。その他は受注生産との注記で、全長数値なし |
| Cerulean DD6 103 cm / 4F Cerulean 133 cm | DD6は113 cmのみ。掲載4Frは「DD6用」で既存4Fとの型式対応を確認できない |
| Phenom 17 / 21 / 27 | [メーカーのFamilyカタログ NV-653_1.0](https://www.medtronic.com/content/dam/medtronic-wide/public/asia-pacific/japan/products/neurological/neurovascular/phenom-family-brochure-ja.pdf)は有効長のみ。MAUDEにある単一返却品の測定値を一般仕様に転用しない |
| SOFIA / Headway / Scepter / VIA | [Terumo Access Products Portfolio 25T028](https://medical.terumo.co.jp/sites/default/files/assets/equipment/me361/pdf/25T028.pdf)の仕様表にハブ数値なし |
| Strykerアクセス製品 | [メーカー作成カタログAP004069 v3（代理店掲載）](https://www.biyotem.com.tr/stryker.pdf)の仕様表でハブ長を確認できず。先端柔軟長などを転用しない |
| Carnelian HF-S | [メーカーHFカタログ](https://products.tokaimedpro.co.jp/product/micro02)には105/125 cm品の全長112/132 cmがあるが、既存HF-Sとの同一性未確認。135 cmは未掲載 |
| Optimo | [メーカー現行資料](https://products.tokaimedpro.co.jp/product/guide02)ではEPD FLEXの手元部短縮の記載があり、既存Optimoの型式を同定できない |
| Navien | [メーカー仕様表](https://www.medtronic.com/me-en/healthcare-professionals/products/neurological/access-delivery-nv/navien.html)のTotal Lengthの測定範囲を確定できない。差0などと推測しない |

## ユーザー提供Excelの資料記載値

ユーザー提供の `アクセス製品スペック一覧（Stryker）.xlsx`、シート「スペック表」の
N列「ハブ長*」（N3の単位：cm）を使用。145件中25件を登録し、120件は未登録。
元資料にある「ハブ長は実測値を含む」「製品公差、特に長さの公差に留意」の注記を引き継ぐ。
この25件を最新メーカー公称値として扱わない。以下は元資料に記載されたハブ長の取り込み記録。

| 登録製品 | カテーテル長 (cm) | ハブ長 (cm) | 件数 | 元セル |
|---|---|---|---|---|
| Guider Softip 5F | 100 | 2 | 1 | N5 |
| Guider Softip 6F / 7F / 8F | 90 / 100 | 2 | 6 | N6:N8 |
| ACS Catalyst5 | 115 | 5 | 1 | N11 |
| ACS Vecta71 | 115 / 125 | 4 | 2 | N12 |
| Excelsior SL-10 / 1018 / XT-27 | 150 | 6.3 | 3 | N15:N16、N18 |
| TACTICS | 120 / 130 / 150 | 8 | 3 | N62 |
| TACTICS Plus | 120 / 125 / 130 / 140 / 150 | 8 | 5 | N63 |
| Guidepost | 120 / 130 | 10 | 2 | N70 |
| Defrictor Nano / BULL | 165 | 7 | 2 | N77:N78 |

メーカー名・製品名・サイズ・有効長を照合。Fr位置の違い、ACSやExcelsiorの接頭辞、
Tokai / Tokai Medical、Hirata / Medicos Hirataの表記差は個別に記録した。
新規デバイスの追加や、既存の径・カテーテル長の修正は行っていない。

## 保留した主な対応

| 既存デバイス | 保留理由 |
|---|---|
| TACTICS 125 / 140 cm | 通常TACTICSの資料掲載長にない。Plusの値を転用しない |
| Vecta74 | 資料はVecta71 |
| Cerulean / DD6 | 資料はCerulean G / DD6 PLUSで、型式の同一性未確認 |
| Neuro Compass | 資料の6F/7F/8Fで値が異なる。既存名はサイズ不明、80 cmは未掲載 |
| Optimo | 資料はOPTIMO EPD。型式の同一性未確認。7Fは長さも不一致 |
| TransForm C / SC | 資料にC/SC別の記載がない |
| Axcelguide Radix 5.5 | 資料のAxcelguide 4F/5F/6Fとは型式が異なる |

上記を含め、空欄・未掲載・型式不一致はCSV/Excelで空欄、JSONで `null` とした。
全登録先ID・参照セル・元ファイルSHA-256は
[出典記録](../../packages/device-master/evidence/hub-lengths.json) に保存。

`hub_length_cm` と `proximal_non_effective_length_cm` は独立した情報項目であり、
既存の適合性判定には加算しない。ExcelとWebには出典と算出根拠も表示する。

## 3Dへの反映

ユーザーの最新の追加依頼により、3Dでは資料記載のハブ長を使い、未登録なら5 cmの想定値で表示する。
算出した非有効長は参考情報として保持し、ハブ長の代用には使わない。
親側のハブ長が未登録の場合、先端突出長に「想定値」と明記し、計算に使用した長さも表示する。
仮値で出典データを埋めることはせず、未登録のCSV・JSON・Excelはそのまま保持する。
ハブに合わせてYコネクターの位置と内側カテーテルの経路も調整し、カテーテル本体の長さは維持する。
幅やテーパーは模式形状とする。詳細は [3Dのハブ表示](../specs/master-schema.md#3dのハブ表示2026-09-26) を参照。

## 検証

- 3D追加時：コアの221テストとWebの型検査に合格。ハブの寸法・既知値と仮値の選択・入れ子と側孔の経路を確認。
- Excelの145行でJ:Nの値がmaster.jsonと一致。既存A:Jの値・数値書式、表と固定表示を保持。
- Web / device-masterの型検査に合格。資料記載値・算出値・未登録の画面部品を描画して表示とリンクを確認。
- ハブ関連14テストに合格。デバイス情報全体は103件合格・1件失敗。
  失敗は変更前にも再現した既存のnotes前後空白処理で、今回のハブ情報追加とは別の問題。
