import type { LocalContextWindow, PageTextBlock } from "../shared/types";

const TARGET_BATCH_CHARS = 3200;
const MAX_BATCH_BLOCKS = 16;

export function chunkBlocksForConsistency<T extends PageTextBlock>(
  blocks: T[],
  targetChars = TARGET_BATCH_CHARS,
  maxBlocks = MAX_BATCH_BLOCKS,
): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let currentChars = 0;

  const flush = () => {
    if (!current.length) return;
    batches.push(current);
    current = [];
    currentChars = 0;
  };

  for (const block of blocks) {
    const blockChars = block.text.length;
    if (!current.length && blockChars >= targetChars) {
      batches.push([block]);
      continue;
    }
    if (current.length && (current.length >= maxBlocks || currentChars + blockChars > targetChars)) {
      flush();
    }
    current.push(block);
    currentChars += blockChars;
  }

  flush();
  return batches;
}

export function localContextForBatch<T extends PageTextBlock>(
  allBlocks: T[],
  batch: T[],
  windowSize = 2,
): LocalContextWindow {
  const indexes = batch
    .map((block) => allBlocks.findIndex((candidate) => candidate.id === block.id))
    .filter((index) => index >= 0);
  if (!indexes.length) return { before: [], after: [] };
  const first = Math.min(...indexes);
  const last = Math.max(...indexes);
  return {
    before: allBlocks.slice(Math.max(0, first - windowSize), first),
    after: allBlocks.slice(last + 1, last + 1 + windowSize),
  };
}
