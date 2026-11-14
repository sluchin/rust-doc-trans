/**
 * Copyright (c) 2026 Tetsuya Higashi
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { SiteProfile } from "../shared/ts/lib/profile";
import type { VersionChoice } from "../shared/ts/lib/version";

/** ドキュメントのホストの URL. */
const ORIGIN = "https://doc.rust-lang.org";

/** 最初に開く版 (版を固定して読む. 版を上げるときは, 画面で版を選ぶ). */
const FIRST_VERSION = "1.99.1";

/** 版の選択肢に出す, 古い版の数 (今の安定版の, 1 つ前から). Rust は 6 週間ごとに版が上がる. */
const OLDER_VERSIONS = 20;

/**
 * 標準ライブラリのページ (rustdoc) から, 今の安定版を読み取って, 版の選択肢を作る.
 *
 * 選択肢は, 今の安定版と, その前の版 (`1.98.0` のように, 各版の最初のリリース) を新しい順に並べる.
 *
 * @param text 標準ライブラリのページの HTML
 * @returns 版の選択肢 (版が読めなければ空)
 */
export function rustVersions(text: string): VersionChoice[] {
  const match = /data-rustdoc-version="(\d+)\.(\d+)\.(\d+)/.exec(text);
  if (match === null) {
    return [];
  }
  const [, major, minor, patch] = match.map(Number);
  const choices: VersionChoice[] = [`${major}.${minor}.${patch}`].map((version) => ({
    version,
    label: version,
  }));
  for (let older = minor - 1; older >= Math.max(0, minor - OLDER_VERSIONS); older -= 1) {
    choices.push({ version: `${major}.${older}.0`, label: `${major}.${older}.0` });
  }
  return choices;
}

/**
 * Rust のドキュメント (doc.rust-lang.org. mdBook で作られている) の設定.
 *
 * The Book と Nomicon を, 画面の上のタブで切り替える. 版は, パスの先頭 (`/1.99.1/book/`) で, 画面で選ぶ
 * (翻訳のキャッシュも版ごとに分ける). 本文は `main`. 左のメニュー (目次) は, ページの中ではなく,
 * 各ドキュメントの `toc.html` にある (番号つきの一覧 `ol`).
 */
export const site: SiteProfile = {
  name: "Rust Doc Trans",
  host: "doc.rust-lang.org",
  pathPrefix: "/",
  homeUrl: `${ORIGIN}/${FIRST_VERSION}/book/index.html`,
  contentSelectors: ["main"],
  // 隠れた行 (コードの例の初めと終わりの補い), ボタン, 重ねて出す 2 枚目の画像の枠は, 本文ではない
  removeSelectors: [".boring", "button", "input", ".img-wrapper"],
  titleSuffix: / - (The Rust Programming Language|The Rustonomicon)$/,
  // 版は, パスの先頭. 版の一覧はページにないので, 標準ライブラリのページにある今の安定版から作る
  versions: {
    pattern: /^\/([^/]+)\//,
    list: { url: `${ORIGIN}/stable/std/index.html`, parse: rustVersions },
  },
  // タブのパスの先頭は, 版を除いたパス (`/1.99.1/book/` → `/book/`)
  tabs: [
    {
      label: "The Book",
      pathPrefix: "/book/",
      homeUrl: `${ORIGIN}/${FIRST_VERSION}/book/index.html`,
      menu: {
        type: "htmlFile",
        url: `${ORIGIN}/${FIRST_VERSION}/book/toc.html`,
        selector: "body",
        list: "ol",
      },
    },
    {
      label: "Nomicon",
      pathPrefix: "/nomicon/",
      homeUrl: `${ORIGIN}/${FIRST_VERSION}/nomicon/index.html`,
      menu: {
        type: "htmlFile",
        url: `${ORIGIN}/${FIRST_VERSION}/nomicon/toc.html`,
        selector: "body",
        list: "ol",
      },
    },
  ],
};
