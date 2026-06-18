import type { PageTextBlock } from "../shared/types";

export interface ContentBlock extends PageTextBlock {
  element: HTMLElement;
}

export interface ExtractOptions {
  excludeSelectors: string[];
  includeSelectors: string[];
  atomicSelectors: string[];
  stayOriginalSelectors: string[];
  extraBlockSelectors: string[];
  extraInlineSelectors: string[];
  navigationSelectors: string[];
  translateNavigation: boolean;
  minTextLength: number;
}
