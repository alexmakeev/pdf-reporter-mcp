// =============================================================================
// config-loader.ts -- Resolve PDF Options with Defaults
// =============================================================================

import {
  DEFAULT_MARGINS,
  DEFAULT_PAGE_SIZE,
  type GeneratePdfInput,
  type ResolvedPdfOptions,
} from './types.js';

/**
 * Merge user-provided options with defaults.
 * @param input - User input from MCP tool call
 * @returns Resolved options with all defaults applied
 */
export function resolveOptions(input: GeneratePdfInput): ResolvedPdfOptions {
  const userOptions = input.options || {};

  return {
    pageSize: userOptions.pageSize || DEFAULT_PAGE_SIZE,
    toc: userOptions.toc ?? false,
    headerTemplate: userOptions.headerTemplate ?? false,
    footerTemplate: userOptions.footerTemplate ?? false,
    margins: {
      top: userOptions.margins?.top || DEFAULT_MARGINS.top,
      bottom: userOptions.margins?.bottom || DEFAULT_MARGINS.bottom,
      left: userOptions.margins?.left || DEFAULT_MARGINS.left,
      right: userOptions.margins?.right || DEFAULT_MARGINS.right,
    },
  };
}
