import { strategies } from '../strategies';
import type { StrategyResult } from '../types';

/**
 * Shared type guards used by both node versions (v5 body in
 * `ConvertFileToJson.node.ts` and `pipeline/v6.ts`) to check whether a file
 * extension has a registered strategy, and whether a strategy returned a
 * well-formed result.
 */
export function isSupportedFormat(extension: string): extension is keyof typeof strategies {
  return Object.prototype.hasOwnProperty.call(strategies, extension);
}

export function isStrategyResult(value: unknown): value is StrategyResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Record<string, unknown>;
  const hasText = typeof result.text === 'string';
  const hasSheets = Boolean(
    result.sheets && typeof result.sheets === 'object' && !Array.isArray(result.sheets),
  );
  const hasValidWarning = result.warning === undefined || typeof result.warning === 'string';
  return hasValidWarning && hasText !== hasSheets;
}
