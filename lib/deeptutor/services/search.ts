/**
 * Search Service — Web search provider aggregation
 * Phase 2a: Reuse SmartLearn's Tavily integration
 */

export interface SearchService {
  // TODO: Phase 2a implementation
  search(query: string, provider?: string): Promise<Record<string, unknown>[]>;
}
