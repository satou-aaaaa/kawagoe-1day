# AGENTS.md

川越1日プランナー：朝9時〜翌朝の時間割に、見どころ・食事・体験・泊まりのカードを置いて川越の1日旅を組むゲーム。結果は「町にいた時間」「使ったお金の目安」「混雑（住む人の困りごと）」の3つの点と、ひとことの講評。`index.html` と `data.js`（カード・時間割・点のつけ方・最高点の計算・お客さんの作り方）を GitHub Pages で公開する。日本語・English・中文・한국어。川越創業スクールの発表用（2026-11-28 satou さんの依頼）。

## 準備（最初に一度）

```bash
bash scripts/setup.sh   # Node.js（版は .nvmrc）を確かめ、検査の依存とブラウザを入れる。何度実行してもよい
```

Claude Code のクラウドセッションでは `.claude/settings.json` のフックが自動で実行する。

## push する前の確認

```bash
node qa/run.mjs   # 点のつけ方・最高点（別に書いた総当たりと比べる）・お客さん3年分・4言語のことばの抜け・出典・数字は2つだけ・スマホ320px/PC幅・キーボード・PWA・引き継ぎ・見やすさ（CI の QA と同じ）
```

## このリポジトリの決まり

- 数字（統計）は川越市の資料の2つだけ：観光客 約736万人（「令和6年 川越市入込観光客数」7,358,000人）と、日帰り 93.8%（「観光アンケート調査報告書（2020年）」）。ほかの人数・割合・値段を足さない（QA が見る）。見どころの一言は川越市「川越百景」・河越館跡の計画書・市の広報（時の鐘）に書いてあることだけ。
- お金は「目安」と書く。カードのお金・中心の通りの混み方（昼ほど混む）は遊びの決まりで、本当の値段・人の数ではない。この言い方を「このゲームについて」・README に置く。
- 点：町にいた時間＝最初のカードから最後のカードまでの時間（24時間で100点）。お金の目安＝カードの合計（22で100点）。混雑＝100 − 中心の通りの混み×4 ＋ 中心の外のカード×8（2枚まで）。合計は3つの平均。夜と朝・中心の外・泊まりを入れると点が上がるようにしてある。
- 星は「その手札でいちばん高い点」との差（4点以内で★3、14点以内で★2）。いちばん高い点は `data.js` の `best()`（動的計画法）で出し、QA が総当たりで確かめる。
- 今日のお客さん（ふつう2・上級1）・上級（2組）は日本時間の日付の種で決まり、だれでも同じ。`Math.random()` は練習・とことんの種だけ。カード・`WHO`・`WISH` の並びを変えると過去の日のお客さんが変わる。変えるときは QA の `PINS` を作り直して理由を PR に書く。`data.js` を変える PR は自動ではマージされない（`hold_paths`）。
- ことば：`index.html` の `T`（ja・en・zh・ko）と `data.js` の `TXT`。日本語のほかは AI の訳で、人が確かめていない（「このゲームについて」に書く）。キーを足したら4言語とも足す（QA が見る）。カレンダー・実績・見やすさ・引き継ぎの窓は共通部品なので日本語のまま。
- 小江戸ゲーム部の名前・ロゴは入れない。お笑いを入れない。個人のデータをとらない（記録は遊ぶ人のブラウザだけ。名前・メールを聞かない）。
- 好きなだけ遊べる：チケット・ライフ・回数制限・🔒で開くモードを入れない（shared-workflows `routines/game-dev.md` F1〜F7）。
- 復習：★3に届かなかったお客さんは `depth.js` の復習にもどる。自信をかける（Depth.sure）は答えを選ぶ形でないので置かない（shared-workflows の drift-allow に理由）。記録 `kwd-v1`・文字 `kwd-fs`・言語 `kwd-lang`・復習 `kwd-depth`。
- 見やすさ（`<!-- a11y:begin -->`〜`end`）・game-core・kiroku・GameStore・`part:*`・`transfer.js`・`depth.js` は shared-workflows `template/` の写しで、ここでは直さない（`node scripts/sync-template.mjs` で写す）。
- PWA：画面のファイルを足したら `sw.js` の `SHELL` にも足し、中身を大きく変えたら `CACHE` の版を上げる。アイコンは `node tools/make-icons.cjs`、`og.png` は `node tools/make-og.cjs`。
- 公開リポジトリなので、個人情報・鍵を入れない。

## 公開

- GitHub Pages は `main` のルート（`/`）を公開する。PR の QA と Secret scan が ✅ になると `automerge.yml` が自動でマージする。止めたいときは下書きにするか、ラベル「自動マージしない」を付ける。
- `sw.js`・`manifest.webmanifest`・`data.js` を変える PR は自動ではマージされない（`hold_paths`）。CodeRabbit のレビューを読み、手でマージする。CodeRabbit は PR に `@coderabbitai review` とコメントして頼む。

## 共通のきまり

- PR の作り方・マージの仕方は satou-aaaaa/shared-workflows の `routines/pr.md`、全体のきまりは `routines/common.md` に従う。
- CI の部品は shared-workflows の共通部品を呼ぶ。リポジトリ側の .github/workflows には呼び出しと設定値だけを書く。
- Claude 以外の AI・人が作業するときは、shared-workflows の `routines/tool-map.md` と `routines/without-claude.md` を読む。
