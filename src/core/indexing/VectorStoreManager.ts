import * as path from 'path';
import { Document } from '@langchain/core/documents';
import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/hf_transformers';
import { FileUtils } from '../../utils/fileUtils.js';
import { config } from '../../config/index.js';
import { PageContent } from './types.js';

export class VectorStoreManager {
  private embeddings: HuggingFaceTransformersEmbeddings;
  private vectorStore: FaissStore | null = null;
  private readonly indexDirectory: string = config.indexDir;

  constructor() {
    this.embeddings = new HuggingFaceTransformersEmbeddings({
      modelName: config.embeddingModelName,
    });
  }

  public async loadJsonDocuments(directory: string): Promise<Document[]> {
    // Keep this as error as it's part of the indexing script run, not server runtime
    console.error(`Loading JSON documents from: ${directory}`);
    const jsonFiles = await FileUtils.listFiles(directory, '.json');
    const documents: Document[] = [];
    const filesToSkip = ['summary.json', 'lastmod_cache.json', 'sitemap-index.json'];

    for (const file of jsonFiles) {
      if (filesToSkip.includes(file)) {
        continue;
      }
      const filePath = path.join(directory, file);
      try {
        const fileContent = await FileUtils.readFile(filePath);
        const pageData = JSON.parse(fileContent) as PageContent;
        const contentParts = [
            pageData.title || '',
            pageData.description || '',
            pageData.content || ''
        ];
        const pageContent = contentParts.filter(part => part?.trim()).join('\n\n').trim();

        if (pageContent) {
             documents.push(
                new Document({
                    pageContent: pageContent,
                    metadata: {
                        source: path.basename(filePath),
                        url: pageData.url || 'URL not available',
                        title: pageData.title || 'No Title',
                        lastmod: pageData.lastmod || 'Unknown',
                    },
                })
            );
        } else {
            // Use warn for potentially problematic but non-fatal issues during indexing
            console.warn(`Skipping document ${file} due to empty content after processing.`);
        }
      } catch (error) {
        console.error(`Error processing JSON file ${filePath}:`, error);
      }
    }
     // Keep this as error as it's part of the indexing script run
    console.error(`Successfully loaded ${documents.length} documents for indexing.`);
    return documents;
  }

  public async createIndex(documents: Document[]): Promise<void> {
    if (documents.length === 0) {
        // Keep this as error as it's part of the indexing script run
        console.error("No documents provided to create index. Skipping index creation.");
        return;
    }
     // Keep this as error as it's part of the indexing script run
    console.error(`Creating FAISS index for ${documents.length} documents...`);
    try {
      await FileUtils.ensureDirectoryExists(this.indexDirectory);
      await FaissStore.importFaiss();

      this.vectorStore = await FaissStore.fromDocuments(
        documents,
        this.embeddings
      );
      await this.vectorStore.save(this.indexDirectory);
       // Keep this as error as it's part of the indexing script run
      console.error(`FAISS index successfully created and saved to: ${this.indexDirectory}`);
    } catch (error) {
      console.error('Error creating or saving FAISS index:', error);
      throw error;
    }
  }

  public async loadIndex(): Promise<boolean> {
    // Change to console.error for server runtime logging
    console.error(`Attempting to load FAISS index from: ${this.indexDirectory}`);
    try {
      if (!(await FileUtils.directoryExists(this.indexDirectory))) {
        console.error(`Index directory not found: ${this.indexDirectory}`);
        return false;
      }
      const indexFile = path.join(this.indexDirectory, 'faiss.index');
      const docstoreFile = path.join(this.indexDirectory, 'docstore.json');
      if (!(await FileUtils.fileExists(indexFile)) || !(await FileUtils.fileExists(docstoreFile))) {
          console.error(`Essential index files (faiss.index, docstore.json) missing in ${this.indexDirectory}. Cannot load index.`);
          return false;
      }

      await FaissStore.importFaiss();
      this.vectorStore = await FaissStore.load(
        this.indexDirectory,
        this.embeddings
      );
       // Change to console.error for server runtime logging
      console.error('FAISS index loaded successfully.');
      return true;
    } catch (error) {
      console.error(`Error loading FAISS index from ${this.indexDirectory}:`, error);
      this.vectorStore = null;
      return false;
    }
  }

  public async search(query: string, k: number = config.directQueryLimitDefault): Promise<Document[]> {
    if (!this.vectorStore) {
      throw new Error('FAISS index is not loaded. Cannot perform search.');
    }
     // Change to console.error for server runtime logging
    console.error(`Performing similarity search for: "${query}" (k=${k})`);
    try {
      const results = await this.vectorStore.similaritySearch(query, k);
       // Change to console.error for server runtime logging
      console.error(`Found ${results.length} results for query.`);
      return results;
    } catch (error) {
      console.error(`Error during similarity search for "${query}":`, error);
      throw error;
    }
  }

  public isIndexLoaded(): boolean {
      return this.vectorStore !== null;
  }
}