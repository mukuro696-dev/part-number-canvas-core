# フォントソース（ビルド成果物）

図版の本文（見出し・説明）で選べる3書体（ゴシック・明朝・デザイン）と、
型番行で選べる3書体（Roboto Condensed・Barlow Condensed・IBM Plex Sans Condensed）の元データ。
すべて SIL Open Font License 1.1 で再配布可能な Google Fonts。取得元は
[Fontsource](https://fontsource.org/)（`@fontsource/*` パッケージ、devDependencies）。

`source/*.woff2` が取得直後の原本、`source/*.ttf` は
`scripts/prepare-font-sources.mjs` で SFNT に変換したもの
（ブラウザ側の subsetter は SFNT だけを扱うため）。

| カテゴリ | 文字体系 | ファミリー | 取得元パッケージ |
|---|---|---|---|
| ゴシック | 欧文 | Noto Sans | `@fontsource/noto-sans` |
| ゴシック | 日本語 | Noto Sans JP | `@fontsource/noto-sans-jp` |
| ゴシック | 日本語（記号・[113]スライス） | Noto Sans JP | `@fontsource/noto-sans-jp` |
| 明朝 | 欧文 | Noto Serif | `@fontsource/noto-serif` |
| 明朝 | 日本語 | Noto Serif JP | `@fontsource/noto-serif-jp` |
| 明朝 | 日本語（記号・[113]スライス） | Noto Serif JP | `@fontsource/noto-serif-jp` |
| デザイン | 欧文 | BIZ UDPGothic | `@fontsource/biz-udpgothic` |
| デザイン | 日本語 | BIZ UDPGothic | `@fontsource/biz-udpgothic` |
| デザイン | 日本語（記号・[113]スライス） | BIZ UDPGothic | `@fontsource/biz-udpgothic` |
| 型番行(ゴシック) | 欧文 | Roboto Condensed | `@fontsource/roboto-condensed` |
| 型番行(コンデンス) | 欧文 | Barlow Condensed | `@fontsource/barlow-condensed` |
| 型番行(プレックス) | 欧文 | IBM Plex Sans Condensed | `@fontsource/ibm-plex-sans-condensed` |

再取得・更新する場合:

```bash
npm install  # devDependencies の @fontsource/* を取得
node scripts/prepare-font-sources.mjs
```


★ `*-japanese-113-400` は Google Fonts のスライス [113]。`※`（U+203B）は「japanese」スライスに**無く**、
このスライスにだけある。ツール自身が注記の印として描く文字なので、無いと書き出しの `※` が
受け手の環境の代替書体になる（無ければ豆腐）。2026-09-17 に書き出しの埋め込み検査が発見。

## sha256（source/*.woff2、取得直後）

```
7ae37b23925b35ee56bdb3d988db7f538a2c54b9b0b3412cc2fff5c29bd711f5  biz-udpgothic-japanese-400.woff2
33b8ed4766d0d6f9ed99675b72e4e6d1dd266c34a1049504004d7f33475b2d4e  biz-udpgothic-latin-400.woff2
4a7b928d4d75e7fc0bace614030664a7ea7eb7d2f754fd2b2da9c3c0ed350570  noto-sans-jp-japanese-400.woff2
09aee8065d25508f23a4c3d92cd777ac869c52d93fd868a88f025d888a7937d6  noto-sans-latin-400.woff2
5c362f64a309bbb21164ac1c4cb452c41869b476aee754add8e2da19c4e79464  noto-serif-jp-japanese-400.woff2
4c0cbe3eec50d260754d681c17ee2af49a43d7fd93ce42877f665fcb1a889b87  noto-serif-latin-400.woff2
543c03fff71d1b39590af102e0852c2dbce46f4dbe4faaebafbef6edc82e78f5  roboto-condensed-latin-400.woff2
7fff1bb22e5773f0d1a55d3093068b6dac4539e8bb3ac23fb9f0a729df2c7bb4  barlow-condensed-latin-400.woff2
456bf5cda9c0b1f1ead43f01b80df5ba5af7cb41d7cbc0543091537c39fb4c89  ibm-plex-sans-condensed-latin-400.woff2
5b7ccd4a6fd4318841b21279c6ed9b520465ad75de39b2aa24c766cddb8ca46b  biz-udpgothic-japanese-113-400.woff2
329c7390208a6522086fad7f375dd7548f03ead69398bcb79dfbc5b673406899  noto-sans-jp-japanese-113-400.woff2
1192010576d12dd78979d0c9b281b684723a877519268af017e060d1bc5dc60a  noto-serif-jp-japanese-113-400.woff2
```

## ライセンス

各ファミリーとも SIL Open Font License, Version 1.1。フォントファイルと同梱の
ライセンス全文は `@fontsource/<family>/LICENSE`（devDependencies インストール後）。
公開サイトの `/licenses/` ページに転記する（Phase 5 以降）。

## サブセット用WASM

`../wasm/hb-subset.wasm` は HarfBuzz の `hb-subset`（MIT License、
`../wasm/harfbuzzjs-LICENSE.txt`）。`harfbuzzjs` npm パッケージ（devDependencies）の
同梱バイナリを取得元とする。ブラウザではこの1ファイルだけを fetch し、
フォント形式変換（WOFF2⇄SFNT）は行わない — 変換は本スクリプトで事前に
すませてあるため、実行時の依存はこの WASM 単体で完結する。
