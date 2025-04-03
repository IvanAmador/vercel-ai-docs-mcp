import { config } from '../config/index.js';
import { DocumentFetcher } from '../core/indexing/DocumentFetcher.js'; // Added .js extension
import { VectorStoreManager } from '../core/indexing/VectorStoreManager.js'; // Added .js extension
import { FileUtils } from '../utils/fileUtils.js';
import { fileURLToPath } from 'url';
import { FileProcessResult } from '../core/indexing/types.js'; // Import the type

async function runIndexing(): Promise<void> {
  console.log('Starting Vercel AI SDK Documentation Indexing Process...');
  const startTime = Date.now();

  const forceUpdate = process.argv.includes('--force');
  if (forceUpdate) {
      console.log("Force update requested. Cache will be ignored and index rebuilt.");
  }

  const fetcher = new DocumentFetcher();
  let processedFiles: FileProcessResult[]; // Add type annotation
  try {
    processedFiles = await fetcher.fetchAndProcessDocuments(forceUpdate);
    if (processedFiles.length === 0 && !forceUpdate) {
      console.log("No documents were updated based on the cache. Index remains unchanged.");
      const endTime = Date.now();
      console.log(`Indexing process finished in ${(endTime - startTime) / 1000} seconds.`);
      return;
    }
  } catch (error) {
    console.error("Fatal error during document fetching/processing:", error);
    process.exit(1);
  }

  const vectorStoreManager = new VectorStoreManager();
  const shouldRebuildIndex = forceUpdate || processedFiles.some((f: FileProcessResult) => f.isNew || f.modified);

  if (shouldRebuildIndex) {
      console.log("Changes detected or force update requested. Rebuilding FAISS index...");
      try {
          console.log(`Cleaning index directory: ${config.indexDir}`);
          await FileUtils.removeDirectory(config.indexDir);
          await FileUtils.ensureDirectoryExists(config.indexDir);

          const documents = await vectorStoreManager.loadJsonDocuments(config.docsDir);
          if (documents.length > 0) {
              await vectorStoreManager.createIndex(documents);
              console.log("FAISS index rebuild complete.");
          } else {
              console.warn("No valid documents found to build the index after cleaning.");
          }
      } catch (error) {
          console.error("Fatal error during index creation:", error);
          process.exit(1);
      }
  } else {
      console.log("No significant changes detected. Index rebuild skipped.");
      if (!await vectorStoreManager.loadIndex()) {
          console.error("Index rebuild was skipped, but the existing index could not be loaded. Please check index files or run with --force.");
      }
  }

  const endTime = Date.now();
  console.log(`Indexing process finished successfully in ${(endTime - startTime) / 1000} seconds.`);
}

const scriptPath = fileURLToPath(import.meta.url);
const isDirectRun = process.argv[1] === scriptPath;

if (isDirectRun) {
  runIndexing().catch(error => {
    console.error('Unhandled error during indexing:', error);
    process.exit(1);
  });
}