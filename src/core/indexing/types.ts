// Types specific to the document indexing process

export interface SitemapUrl {
    loc: string;
    lastmod: string;
  }
  
  export interface PageContent {
    url: string;
    lastmod: string;
    title: string;
    description: string;
    content: string;
  }
  
  export interface FileProcessResult {
    url: string;
    filePath: string;
    hash: string;
    modified: boolean;
    isNew: boolean;
    contentLength: number;
  }
  
  export interface FetcherStats {
    totalUrls: number;
    processedUrls: number;
    modifiedUrls: number;
    errors: number;
    totalBytes: number;
  }
  
  export interface CacheData {
    lastRun: string;
    urls: Record<string, string>; // Map<url, lastmod>
  }