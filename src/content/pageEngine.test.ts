import { PageEngine } from "./pageEngine";

describe("PageEngine", () => {
  it("tracks block entities from discovery to translated", () => {
    document.body.innerHTML = `
      <main>
        <p>This paragraph should become a stateful block.</p>
      </main>
    `;
    const engine = new PageEngine(document);
    const blocks = engine.scanBlocks();
    const paragraph = document.querySelector("p");

    expect(blocks).toHaveLength(1);
    expect(paragraph).toBeInstanceOf(HTMLElement);
    expect((paragraph as HTMLElement).dataset.brxBlockId).toBe(blocks[0]?.id);
    expect((paragraph as HTMLElement).dataset.brxWalked).toBe("1");

    engine.markQueued(blocks);
    expect((paragraph as HTMLElement).dataset.brxState).toBe("queued");

    engine.renderPending(blocks, "dual");
    expect((paragraph as HTMLElement).dataset.brxState).toBe("pending");
    expect(document.querySelector(".brx-translation-pending")).toHaveTextContent("正在翻译...");

    const rendered = engine.renderResults(blocks, [{ id: blocks[0]!.id, text: "这是一段译文。", error: "", cached: false }], "dual");

    expect(rendered).toBe(1);
    expect((paragraph as HTMLElement).dataset.brxState).toBe("translated");
    expect(document.querySelector(".brx-translation")).toHaveTextContent("这是一段译文。");
    expect(engine.snapshot()).toMatchObject({
      totalBlocks: 1,
      pendingBlocks: 0,
      translatedBlocks: 1,
      errorBlocks: 0,
    });
  });

  it("tracks provider errors on block entities", () => {
    document.body.innerHTML = `
      <main>
        <p>This paragraph will fail translation.</p>
      </main>
    `;
    const engine = new PageEngine(document);
    const blocks = engine.scanBlocks();

    const rendered = engine.renderResults(blocks, [{ id: blocks[0]!.id, text: "", error: "timeout", cached: false }], "dual");

    expect(rendered).toBe(0);
    expect((document.querySelector("p") as HTMLElement).dataset.brxState).toBe("error");
    expect((document.querySelector("p") as HTMLElement).dataset.brxError).toBe("timeout");
    expect(engine.snapshot()).toMatchObject({
      errorBlocks: 1,
      translatedBlocks: 0,
    });
  });

  it("scans only new blocks after translated content has been marked", () => {
    document.body.innerHTML = `
      <main>
        <p>First article paragraph.</p>
      </main>
    `;
    const engine = new PageEngine(document);
    const firstBlocks = engine.scanBlocks();
    engine.renderResults(firstBlocks, [{ id: firstBlocks[0]!.id, text: "第一段译文。", error: "", cached: false }], "dual");

    document.querySelector("main")?.insertAdjacentHTML("beforeend", "<p>Second article paragraph.</p>");

    const nextBlocks = engine.scanBlocks({}, { onlyNew: true });

    expect(nextBlocks.map((block) => block.text)).toEqual(["Second article paragraph."]);
  });

  it("skips blocks that already look like the target language", () => {
    document.body.innerHTML = `
      <main>
        <p>これは日本語の本文です。</p>
        <p>This English sentence should enter the queue.</p>
      </main>
    `;
    const engine = new PageEngine(document);
    const blocks = engine.scanBlocks({}, { targetLang: "ja" });

    expect(blocks.map((block) => block.text)).toEqual(["This English sentence should enter the queue."]);
    const firstParagraph = document.querySelector("p") as HTMLElement;
    expect(firstParagraph.dataset.brxState).toBe("skipped");
    expect(firstParagraph.dataset.brxSkipReason).toBe("already-target-language");
  });

  it("restores translation nodes and engine DOM markers", () => {
    document.body.innerHTML = `
      <main>
        <p>This paragraph will be restored.</p>
      </main>
    `;
    const engine = new PageEngine(document);
    const blocks = engine.scanBlocks();
    engine.renderResults(blocks, [{ id: blocks[0]!.id, text: "恢复前的译文。", error: "", cached: false }], "dual");

    engine.restore();

    const paragraph = document.querySelector("p") as HTMLElement;
    expect(document.querySelector(".brx-translation")).toBeNull();
    expect(paragraph.dataset.brxState).toBeUndefined();
    expect(paragraph.dataset.brxBlockId).toBeUndefined();
    expect(paragraph.dataset.brxWalked).toBeUndefined();
    expect(engine.snapshot()).toMatchObject({
      pageStatus: "original",
      totalBlocks: 0,
    });
  });

  it("does not return skipped atomic blocks for translation", () => {
    document.body.innerHTML = `
      <main>
        <div class="chart-panel">
          <p>Chart label that should not enter the queue.</p>
        </div>
        <p>Readable article text.</p>
      </main>
    `;
    const engine = new PageEngine(document);
    const blocks = engine.scanBlocks({ atomicSelectors: [".chart-panel"] });

    expect(blocks.map((block) => block.text)).toEqual(["Readable article text."]);
  });
});
