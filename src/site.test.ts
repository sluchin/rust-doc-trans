/**
 * Copyright (c) 2026 Tetsuya Higashi
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";
import { isDocUrl, tabIndexOf } from "../shared/ts/lib/docUrl";
import { versionOf, withVersion } from "../shared/ts/lib/version";
import { extractPage } from "../shared/ts/lib/extract";
import { parseHtmlMenu } from "../shared/ts/lib/menu";
import { rustVersions, site } from "./site";

/** 作り物の mdBook 風のページ (ドキュメントの文章は使わない). */
const PAGE = `<html><head><title>Sample - The Rust Programming Language</title></head><body>
<nav id="mdbook-sidebar">Side menu</nav>
<div id="mdbook-content"><main><h1 id="sample"><a class="header" href="#sample">Sample</a></h1>
<p>Body text with <a href="other.html#part">a link</a>.</p>
<pre class="playground"><code class="language-rust"><span class="boring">fn main() {
</span>let x = 1;
<span class="boring">}</span></code></pre>
<p><label class="checkbox-label"><input class="checkbox-img" type="checkbox"><img src="img/pic.svg" alt="pic"><span class="img-wrapper"><img src="img/pic.svg" alt="pic"></span></label></p>
<button>Copy</button></main><nav class="nav-wrapper">Prev next</nav></div></body></html>`;

/** 作り物の mdBook 風の目次 (`toc.html`). */
const TOC = `<html><body class="sidebar-iframe-inner"><ol class="chapter">
<li class="chapter-item"><span class="chapter-link-wrapper"><a href="title-page.html">Title</a></span></li>
<li class="chapter-item"><span class="chapter-link-wrapper"><a href="ch01.html"><strong>1.</strong> First</a></span><ol class="section">
<li class="chapter-item"><span class="chapter-link-wrapper"><a href="ch01-01.html"><strong>1.1.</strong> Sub</a></span></li></ol>
<li class="part-title">Part</li><li class="spacer"></li>
<li class="chapter-item"><span class="chapter-link-wrapper"><a href="ch02.html">Second</a></span></li></ol></body></html>`;

describe("Rust site profile", () => {
  it("opens only the pages of the two documents of any version, starting from a fixed version", () => {
    const pattern = site.versions?.pattern as RegExp;
    expect(site.tabs).toHaveLength(2);
    expect(versionOf(site.homeUrl, pattern)).toBe("1.99.1");
    expect(isDocUrl(site.homeUrl, site)).toBe(true);
    for (const tab of site.tabs ?? []) {
      expect(isDocUrl(tab.homeUrl, site)).toBe(true);
      expect(versionOf(tab.homeUrl, pattern)).toBe("1.99.1");
    }
    expect(isDocUrl("https://doc.rust-lang.org/1.80.0/nomicon/data.html", site)).toBe(true);
    // 同じホストの, ほかのドキュメント (標準ライブラリのリファレンスなど) は, アプリでは開かない
    expect(isDocUrl("https://doc.rust-lang.org/1.99.1/std/index.html", site)).toBe(false);
    expect(isDocUrl("https://doc.rust-lang.org/reference/index.html", site)).toBe(false);
    expect(isDocUrl("https://example.com/1.99.1/book/", site)).toBe(false);
  });

  it("finds the tab of a page of any version", () => {
    const tabs = site.tabs ?? [];
    const pattern = site.versions?.pattern;
    expect(tabIndexOf("https://doc.rust-lang.org/1.80.0/book/ch01-00.html", tabs, pattern)).toBe(0);
    expect(tabIndexOf("https://doc.rust-lang.org/1.99.1/nomicon/data.html", tabs, pattern)).toBe(1);
    expect(
      withVersion("https://doc.rust-lang.org/1.99.1/nomicon/toc.html", pattern as RegExp, "1.80.0"),
    ).toBe("https://doc.rust-lang.org/1.80.0/nomicon/toc.html");
  });

  it("makes the version choices from the current stable version", () => {
    const choices = rustVersions(
      '<meta name="rustdoc-vars" data-rustdoc-version="1.99.1 (58cf8f9c3 2026-10-13)">',
    );
    expect(choices[0]).toEqual({ version: "1.99.1", label: "1.99.1" });
    expect(choices[1].version).toBe("1.98.0");
    expect(choices.at(-1)?.version).toBe("1.79.0");
    expect(choices).toHaveLength(21);
    // 古い版は, 1.0.0 より前に行かない
    expect(rustVersions('data-rustdoc-version="1.3.0"').map((c) => c.version)).toEqual([
      "1.3.0",
      "1.2.0",
      "1.1.0",
      "1.0.0",
    ]);
    expect(rustVersions("<p>no version</p>")).toEqual([]);
  });

  it("takes the main content, strips the site name and drops the hidden lines and buttons", () => {
    const page = extractPage(PAGE, "https://doc.rust-lang.org/1.99.1/book/sample.html", site);
    expect(page.title).toBe("Sample");
    expect(page.html).toContain("Body text");
    expect(page.html).toContain("let x = 1;");
    expect(page.html).not.toContain("fn main()");
    expect(page.html).not.toContain("Side menu");
    expect(page.html).not.toContain("Copy");
    expect(page.html).not.toContain("<input");
    expect(page.html.match(/<img/g)).toHaveLength(1);
    expect(page.html).toContain('href="https://doc.rust-lang.org/1.99.1/book/other.html#part"');
  });

  it("strips the name of the other document from the title too", () => {
    const page = extractPage(
      "<html><head><title>Data - The Rustonomicon</title></head><body><main><p>x</p></main></body></html>",
      "https://doc.rust-lang.org/1.99.1/nomicon/data.html",
      site,
    );
    expect(page.title).toBe("Data");
  });

  it("reads the menu of each document from its toc.html", () => {
    for (const tab of site.tabs ?? []) {
      expect(tab.menu?.type).toBe("htmlFile");
      if (tab.menu?.type === "htmlFile") {
        expect(tab.menu.url).toBe(`https://doc.rust-lang.org/1.99.1${tab.pathPrefix}toc.html`);
        const body = new DOMParser()
          .parseFromString(TOC, "text/html")
          .querySelector(tab.menu.selector);
        const items = parseHtmlMenu(body as Element, tab.menu.url, tab.menu.list);
        expect(items.map((item) => item.title)).toEqual(["Title", "1. First", "Part", "Second"]);
        expect(items[1].url).toBe(`https://doc.rust-lang.org/1.99.1${tab.pathPrefix}ch01.html`);
        expect(items[1].children.map((child) => child.title)).toEqual(["1.1. Sub"]);
      }
    }
  });
});
