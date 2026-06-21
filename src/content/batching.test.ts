import { chunkBlocksForConsistency, localContextForBatch } from "./batching";
import type { PageTextBlock } from "../shared/types";

function block(id: string, text: string): PageTextBlock {
  return {
    id,
    hash: id,
    text,
    kind: "paragraph",
    visibility: "visible",
  };
}

describe("consistency batching", () => {
  it("chunks by source character budget and max block count", () => {
    const blocks = [
      block("b1", "a".repeat(1000)),
      block("b2", "b".repeat(1000)),
      block("b3", "c".repeat(1000)),
      block("b4", "d".repeat(1000)),
    ];

    expect(chunkBlocksForConsistency(blocks, 2500, 16).map((batch) => batch.map((item) => item.id))).toEqual([
      ["b1", "b2"],
      ["b3", "b4"],
    ]);
  });

  it("keeps a single oversized block in its own batch", () => {
    const blocks = [block("long", "x".repeat(4000)), block("short", "ok")];

    expect(chunkBlocksForConsistency(blocks, 3200, 16).map((batch) => batch.map((item) => item.id))).toEqual([
      ["long"],
      ["short"],
    ]);
  });

  it("builds a two-block local context window around a batch", () => {
    const blocks = ["b1", "b2", "b3", "b4", "b5", "b6"].map((id) => block(id, id));

    expect(localContextForBatch(blocks, [blocks[2]!, blocks[3]!], 2)).toEqual({
      before: [blocks[0], blocks[1]],
      after: [blocks[4], blocks[5]],
    });
  });
});
