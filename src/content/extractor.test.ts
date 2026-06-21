import { extractNavigationBlocks, extractPageBlocks } from "./extractor";

describe("extractPageBlocks", () => {
  it("extracts paragraph-like blocks and skips code/input", () => {
    document.body.innerHTML = `
      <main>
        <h1>Hello Title</h1>
        <p>This is a paragraph worth translating.</p>
        <pre>const x = 1</pre>
        <input value="secret" />
      </main>
    `;
    const blocks = extractPageBlocks(document);
    expect(blocks.map((block) => block.text)).toEqual([
      "Hello Title",
      "This is a paragraph worth translating.",
    ]);
  });

  it("respects exclude selectors", () => {
    document.body.innerHTML = `
      <article>
        <p>Keep me.</p>
        <p class="no-translate">Skip me.</p>
      </article>
    `;
    const blocks = extractPageBlocks(document, { excludeSelectors: [".no-translate"] });
    expect(blocks.map((block) => block.text)).toEqual(["Keep me."]);
  });

  it("respects atomic and stay-original selectors", () => {
    document.body.innerHTML = `
      <article>
        <p>Keep this normal paragraph.</p>
        <section class="interactive-widget">
          <p>Do not translate widget internals.</p>
        </section>
        <p class="source-only">Keep this source only.</p>
      </article>
    `;

    const blocks = extractPageBlocks(document, {
      atomicSelectors: [".interactive-widget"],
      stayOriginalSelectors: [".source-only"],
    });

    expect(blocks.map((block) => block.text)).toEqual(["Keep this normal paragraph."]);
  });

  it("skips url-only blocks", () => {
    document.body.innerHTML = `
      <article>
        <p>https://kakuyomu.jp/users/hanedausa/news/2912051599672446500</p>
        <p>Readable prose should still be translated.</p>
      </article>
    `;

    const blocks = extractPageBlocks(document);

    expect(blocks.map((block) => block.text)).toEqual(["Readable prose should still be translated."]);
  });

  it("builds rich text metadata for inline links", () => {
    document.body.innerHTML = `
      <article>
        <p>Go to <a href="https://example.com">Codex</a> and read <em>carefully</em>.</p>
      </article>
    `;

    const [block] = extractPageBlocks(document);

    expect(block?.richText?.source).toBe(
      "Go to __BRX_INLINE_0__Codex__BRX_INLINE_0_END__ and read __BRX_INLINE_1__carefully__BRX_INLINE_1_END__.",
    );
    expect(block?.richText?.placeholders[0]).toMatchObject({
      tagName: "a",
      text: "Codex",
      attributes: { href: "https://example.com" },
    });
  });

  it("uses extra block and inline selectors from rules", () => {
    document.body.innerHTML = `
      <article>
        <section class="abstract">This abstract is a custom block.</section>
        <span class="paper-keyword">Formal methods</span>
      </article>
    `;

    const blocks = extractPageBlocks(document, {
      extraBlockSelectors: [".abstract"],
      extraInlineSelectors: [".paper-keyword"],
    });

    expect(blocks.map((block) => ({ text: block.text, layout: block.layout, classification: block.classification }))).toEqual([
      { text: "This abstract is a custom block.", layout: "block", classification: "block" },
      { text: "Formal methods", layout: "inline", classification: "inline" },
    ]);
  });

  it("scans every article inside a multi-card page", () => {
    document.body.innerHTML = `
      <main>
        <article>
          <h2>First post</h2>
          <p>First summary.</p>
        </article>
        <article>
          <h2>Second post</h2>
          <p>Second summary.</p>
        </article>
      </main>
    `;

    const blocks = extractPageBlocks(document);

    expect(blocks.map((block) => block.text)).toEqual([
      "First post",
      "First summary.",
      "Second post",
      "Second summary.",
    ]);
  });

  it("prefers content containers over navigation and extracts leaf div text", () => {
    document.body.innerHTML = `
      <div class="header">
        <ul class="wp-menu">
          <li>Home</li>
          <li>About US</li>
          <li>Research</li>
        </ul>
      </div>
      <div id="l-container">
        <div class="col_menu"><a>Return</a></div>
        <div class="col_news">
          <div class="article">
            <div class="entry">
              <div class="fr_name" type="Professors">Yuqi Chen</div>
              <div class="fr_position">Assistant Professor</div>
              <div class="school">Graduated School: <span>Singapore University of Technology and Design, Singapore</span></div>
              <div class="person person_area">Research Area: <span>Cyber-physical systems, Machine learning, Artificial intelligence</span></div>
            </div>
          </div>
        </div>
      </div>
      <div class="footer"><p>Copyright notice</p></div>
    `;

    const blocks = extractPageBlocks(document);

    expect(blocks.map((block) => block.text)).toEqual([
      "Yuqi Chen",
      "Assistant Professor",
      "Graduated School: Singapore University of Technology and Design, Singapore",
      "Research Area: Cyber-physical systems, Machine learning, Artificial intelligence",
    ]);
  });

  it("uses readability-like scoring to avoid link-heavy navigation roots", () => {
    document.body.innerHTML = `
      <div id="content">
        <nav class="menu">
          <a>Home</a><a>Archive</a><a>Tags</a><a>About</a><a>Links</a>
        </nav>
      </div>
      <section class="post-content">
        <h1>Research Note</h1>
        <p>This article paragraph contains the useful body text that should be translated.</p>
        <p>Another paragraph gives enough content for the lightweight article scorer.</p>
      </section>
    `;

    const blocks = extractPageBlocks(document);

    expect(blocks.map((block) => block.text)).toEqual([
      "Research Note",
      "This article paragraph contains the useful body text that should be translated.",
      "Another paragraph gives enough content for the lightweight article scorer.",
    ]);
  });

  it("keeps WordPress post titles and summaries but skips post metadata", () => {
    document.body.innerHTML = `
      <main>
        <article class="post hentry category-uncategorized">
          <div class="entry-container">
            <header class="entry-header">
              <h2 class="entry-title">
                <a href="/hello-world/" rel="bookmark">Hello world!</a>
              </h2>
            </header>
            <div class="entry-summary">
              <p>
                Welcome to WordPress. This is your first post.
                <span class="more-button">
                  <a href="/hello-world/" class="more-link">
                    Continue reading
                    <span class="screen-reader-text">Hello world!</span>
                  </a>
                </span>
              </p>
            </div>
            <div class="entry-footer">
              <div class="entry-meta entry-meta-left">
                <span class="byline">
                  <span class="author-label screen-reader-text">By </span>
                  <span class="author vcard"><a class="url fn n" href="/author/admin/">admin</a></span>
                </span>
              </div>
              <div class="entry-meta entry-meta-right">
                <span class="cat-links">
                  <span class="cat-text screen-reader-text">Categories</span>
                  <a href="/category/uncategorized/" rel="category tag">Uncategorized</a>
                </span>
                <span class="posted-on">
                  <a href="/hello-world/" rel="bookmark">
                    <time class="entry-date published" datetime="2022-12-28T15:01:07+08:00">December 28, 2022</time>
                  </a>
                </span>
              </div>
            </div>
          </div>
        </article>
      </main>
    `;

    const blocks = extractPageBlocks(document);

    expect(blocks.map((block) => block.text)).toEqual([
      "Hello world!",
      "Welcome to WordPress. This is your first post.",
    ]);
  });

  it("extracts Google Scholar publication rows inside forms", () => {
    document.body.innerHTML = `
      <div id="gsc_prf">
        <div id="gsc_prf_in">Sun Jun</div>
        <div class="gsc_prf_il">Professor of SCIS, SMU</div>
        <div id="gsc_prf_int">
          <a>Formal Methods</a>
          <a>AI Safety</a>
          <a>Software Engineering</a>
        </div>
      </div>
      <form id="gsc_a_form">
        <table>
          <tbody id="gsc_a_b">
            <tr class="gsc_a_tr">
              <td class="gsc_a_t">
                <a class="gsc_a_at">Correct-by-Construction Design of Timed Systems in Event-B</a>
                <div class="gs_gray">G Dupont, J Sun</div>
                <div class="gs_gray">arXiv preprint arXiv:2606.05939</div>
              </td>
              <td class="gsc_a_c">0</td>
              <td class="gsc_a_y">2026</td>
            </tr>
            <tr class="gsc_a_tr">
              <td class="gsc_a_t">
                <a class="gsc_a_at">DDOR: Delta Debugging for Explainable Overrefusal Testing and Repair</a>
                <div class="gs_gray">Q Zhou, P Zhang, J Sun, H Zhang, D Wang</div>
                <div class="gs_gray">arXiv preprint arXiv:2606.03601</div>
              </td>
              <td class="gsc_a_c">0</td>
              <td class="gsc_a_y">2026</td>
            </tr>
          </tbody>
        </table>
      </form>
    `;

    const blocks = extractPageBlocks(document);

    expect(blocks.map((block) => block.text)).toEqual([
      "Sun Jun",
      "Professor of SCIS, SMU",
      "Formal Methods AI Safety Software Engineering",
      "Correct-by-Construction Design of Timed Systems in Event-B",
      "G Dupont, J Sun",
      "arXiv preprint arXiv:2606.05939",
      "DDOR: Delta Debugging for Explainable Overrefusal Testing and Repair",
      "Q Zhou, P Zhang, J Sun, H Zhang, D Wang",
      "arXiv preprint arXiv:2606.03601",
    ]);
  });

  it("skips chart internals while keeping article body links", () => {
    document.body.innerHTML = `
      <main class="article-page">
        <article class="article-shell">
          <h1>MTG Bench: Testing how well LLMs can play magic</h1>
          <section class="benchmark-chart-section">
            <h2 class="benchmark-chart-heading">Overall Score <span>(higher is better)</span></h2>
            <div class="benchmark-chart-viewport" data-mtg-bench-chart-viewport>
              <div class="benchmark-score-chart" role="group">
                <a class="benchmark-score-column" href="/benchmarks/1">
                  <div class="benchmark-score-bar">95.4</div>
                  <div class="benchmark-score-label">
                    <span>gpt-5.5</span>
                    <span>medium</span>
                  </div>
                </a>
              </div>
              <div class="benchmark-scatter-chart">
                <span class="benchmark-scatter-axis-title benchmark-scatter-y-title">Score</span>
                <a class="benchmark-scatter-point" href="/benchmarks/2">
                  <span class="benchmark-scatter-point-label-model">claude-fable-5</span>
                  <span class="benchmark-scatter-tooltip">Score 90.3</span>
                </a>
              </div>
            </div>
          </section>
          <div class="article-body">
            <section class="article-body-section">
              <h2>Results</h2>
              <p>Click on the charts above to view each benchmark's simulations.</p>
              <h3>Example successes</h3>
              <ol>
                <li>
                  <a href="/benchmarks/success">Fable 5 plays a scry land and looks at the top card of the deck</a>
                </li>
              </ol>
            </section>
          </div>
        </article>
      </main>
    `;

    const blocks = extractPageBlocks(document);
    const texts = blocks.map((block) => block.text);

    expect(texts).toEqual([
      "MTG Bench: Testing how well LLMs can play magic",
      "Results",
      "Click on the charts above to view each benchmark's simulations.",
      "Example successes",
      "Fable 5 plays a scry land and looks at the top card of the deck",
    ]);
    expect(texts).not.toContain("gpt-5.5");
    expect(texts).not.toContain("claude-fable-5");
    expect(texts).not.toContain("Score");
  });

  it("extracts compact navigation blocks", () => {
    document.body.innerHTML = `
      <header>
        <nav>
          <a href="/api">API</a>
          <a href="/chatgpt">ChatGPT</a>
        </nav>
      </header>
      <aside class="sidebar">
        <button aria-expanded="true">Getting Started</button>
        <h3>Desktop Heading</h3>
        <a href="#overview">Overview</a>
        <a href="#quickstart">Quickstart</a>
        <button aria-expanded="false">Using Codex</button>
        <details>
          <summary><span>App</span></summary>
        </details>
        <a href="/login">Log in</a>
      </aside>
      <div data-nav-id="/codex">
        <h3>Configuration</h3>
      </div>
      <div data-left-nav-container>
        <nav data-left-nav data-left-nav-id="/codex">
          <h3>OpenAI Docs</h3>
          <a href="/codex/cloud"><span>Codex web</span></a>
        </nav>
      </div>
      <aside class="vector-toc">
        <a href="#history">History</a>
      </aside>
      <div data-content-page-toc-rail>
        <nav>
          <ul>
            <li><a href="#work">Work with Codex web</a></li>
          </ul>
        </nav>
        <button data-page-copy-action>Copy Page</button>
      </div>
      <div class="on-this-page">
        <a href="#setup">Codex web setup</a>
      </div>
    `;

    const blocks = extractNavigationBlocks(document);

    expect(blocks.map((block) => ({ text: block.text, classification: block.classification }))).toEqual([
      { text: "Getting Started", classification: "navigation" },
      { text: "Desktop Heading", classification: "navigation" },
      { text: "Overview", classification: "navigation" },
      { text: "Quickstart", classification: "navigation" },
      { text: "Using Codex", classification: "navigation" },
      { text: "App", classification: "navigation" },
      { text: "Configuration", classification: "navigation" },
      { text: "OpenAI Docs", classification: "navigation" },
      { text: "Codex web", classification: "navigation" },
      { text: "History", classification: "navigation" },
      { text: "Work with Codex web", classification: "navigation" },
      { text: "Codex web setup", classification: "navigation" },
    ]);
  });

  it("does not extract both a disclosure control and its text label", () => {
    document.body.innerHTML = `
      <aside class="sidebar">
        <details>
          <summary class="flex">
            <span class="flex-1">Concepts</span>
            <svg aria-hidden="true"></svg>
          </summary>
        </details>
        <button aria-expanded="false">
          <span>Using Codex</span>
          <svg aria-hidden="true"></svg>
        </button>
      </aside>
    `;

    const blocks = extractNavigationBlocks(document);

    expect(blocks.map((block) => block.text)).toEqual(["Concepts", "Using Codex"]);
    expect(blocks.every((block) => block.element.tagName.toLowerCase() === "span")).toBe(true);
  });

  it("does not re-extract a child label from an already translated disclosure control", () => {
    document.body.innerHTML = `
      <aside class="sidebar">
        <details>
          <summary class="flex" data-brx-state="translated">
            <span class="flex-1">Concepts</span>
            <svg aria-hidden="true"></svg>
            <span class="brx-nav-translation" data-brx-for="old">概念</span>
          </summary>
        </details>
      </aside>
    `;

    const blocks = extractNavigationBlocks(document);

    expect(blocks.map((block) => block.text)).toEqual([]);
  });

  it("extracts visible side rail navigation when site-specific selectors are missing", () => {
    Object.defineProperty(window, "innerWidth", { value: 1440, configurable: true });
    document.body.innerHTML = `
      <header>
        <nav>
          <a id="top-api" href="/api">API</a>
        </nav>
      </header>
      <main>
        <a id="body-link" href="#codex-web-setup">Codex web setup</a>
      </main>
      <div>
        <h3 id="side-heading">Getting Started</h3>
        <a id="side-link" href="/codex">Overview</a>
      </div>
      <div>
        <a id="right-toc" href="#work-with-codex-web">Work with Codex web</a>
      </div>
    `;
    const rects: Record<string, Partial<DOMRect>> = {
      "top-api": { left: 680, right: 720, top: 20, width: 40, height: 20 },
      "body-link": { left: 520, right: 700, top: 260, width: 180, height: 24 },
      "side-heading": { left: 32, right: 168, top: 120, width: 136, height: 24 },
      "side-link": { left: 32, right: 120, top: 156, width: 88, height: 24 },
      "right-toc": { left: 1210, right: 1380, top: 120, width: 170, height: 24 },
    };
    for (const [id, rect] of Object.entries(rects)) {
      const element = document.getElementById(id);
      if (!element) continue;
      element.getBoundingClientRect = () =>
        ({
          x: rect.left ?? 0,
          y: rect.top ?? 0,
          left: rect.left ?? 0,
          right: rect.right ?? 0,
          top: rect.top ?? 0,
          bottom: (rect.top ?? 0) + (rect.height ?? 0),
          width: rect.width ?? 0,
          height: rect.height ?? 0,
          toJSON: () => ({}),
        }) as DOMRect;
    }

    const blocks = extractNavigationBlocks(document);

    expect(blocks.map((block) => block.text)).toEqual([
      "Getting Started",
      "Overview",
      "Work with Codex web",
    ]);
  });
});
