import { Document } from '@langchain/core/documents';
import { config } from '../../config/index.js';
import { VectorStoreManager } from '../indexing/VectorStoreManager.js';
import { FormattedSearchResult } from './types.js';

export class DirectQueryService {
  private vectorStoreManager: VectorStoreManager;

  constructor(vectorStoreManager: VectorStoreManager) {
    if (!vectorStoreManager.isIndexLoaded()) {
        throw new Error("DirectQueryService requires a loaded VectorStoreManager index.");
    }
    this.vectorStoreManager = vectorStoreManager;
  }

  public async performSearch(
    query: string,
    limit: number = config.directQueryLimitDefault
  ): Promise<FormattedSearchResult[]> {
    try {
      const results: Document[] = await this.vectorStoreManager.search(query, limit);
      return this.formatResults(results);
    } catch (error) {
      console.error(`Direct search failed for query "${query}":`, error);
      return [];
    }
  }

  private formatResults(results: Document[]): FormattedSearchResult[] {
    return results.map((doc, index) => ({
      index: index + 1,
      source: doc.metadata.source || 'Unknown source',
      url: doc.metadata.url || 'URL not available',
      title: doc.metadata.title || 'No Title',
      content: doc.pageContent,
    }));
  }
}