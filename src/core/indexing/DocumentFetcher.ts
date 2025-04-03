import axios from 'axios';
import * as cheerio from 'cheerio';
import * as path from 'path';
import { config } from '../../config/index.js';
import { FileUtils } from '../../utils/fileUtils.js';
import { formatDuration, generateHash, urlToFilename } from '../../utils/helpers.js';
import {
  CacheData,
  FetcherStats,
  FileProcessResult,
  PageContent,
  SitemapUrl
} from './types.js'; // Added .js extension back

const axiosInstance = axios.create({
  timeout: 30000,
  headers: {
    'User-Agent': 'VercelAIDocsIndexer/1.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml'
  },
  maxRedirects: 5,
  responseType: 'text',
  validateStatus: (status) => status >= 200 && status < 400,
});

export class DocumentFetcher {
  private readonly outputDir: string = config.docsDir;
  private readonly sitemapUrl: string = config.sitemapUrl;
  private readonly cacheFile: string = path.join(this.outputDir, 'lastmod_cache.json');
  private stats: FetcherStats = {
    totalUrls: 0,
    processedUrls: 0,
    modifiedUrls: 0,
    errors: 0,
    totalBytes: 0,
  };
  private startTime: number = 0;

  public async fetchAndProcessDocuments(forceUpdate: boolean = false): Promise<FileProcessResult[]> {
    this.startTime = Date.now();
    console.error(`Starting document fetch process from ${this.sitemapUrl}`);
    await FileUtils.ensureDirectoryExists(this.outputDir);

    const cache = await this.loadLastModCache();
    console.error(`Last successful run recorded: ${cache.lastRun || 'Never'}`);

    const sitemapUrls = await this.extractSitemapUrls();
    this.stats.totalUrls = sitemapUrls.length;
    console.error(`Found ${this.stats.totalUrls} URLs in sitemap.`);

    const urlsToProcess = forceUpdate ? sitemapUrls : this.filterUrlsToUpdate(sitemapUrls, cache);
    console.error(`Processing ${urlsToProcess.length} URLs (${forceUpdate ? 'forced update' : 'based on cache'}).`);

    if (urlsToProcess.length === 0 && !forceUpdate) {
      console.error("No documents require updating.");
      this.printStats();
      return [];
    }

    const results: FileProcessResult[] = [];
    const batchSize = 10;
    for (let i = 0; i < urlsToProcess.length; i += batchSize) {
        const batch = urlsToProcess.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
            batch.map(urlObj => this.processUrl(urlObj))
        );

        batchResults.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                results.push(result.value);
                this.stats.processedUrls++;
                if (result.value.isNew || result.value.modified) {
                    this.stats.modifiedUrls++;
                }
                this.stats.totalBytes += result.value.contentLength;
            } else if (result.status === 'rejected') {
                this.stats.errors++;
                const reason = result.reason ?? 'Unknown error';
                console.error(`Error processing URL ${batch[index]?.loc || 'unknown'}:`, reason);
            }
        });
        this.printProgress();
    }

    const successfulUrls = results.map(r => r.url);
    for (const urlObj of urlsToProcess) {
        if (successfulUrls.includes(urlObj.loc)) {
            cache.urls[urlObj.loc] = urlObj.lastmod;
        }
    }
    await this.saveLastModCache(cache);
    await this.updateSummary(results);

    console.error(`\nDocument fetch process completed.`);
    this.printStats();
    return results;
  }

  private async processUrl(urlObj: SitemapUrl): Promise<FileProcessResult | null> {
    const { loc: url, lastmod } = urlObj;
    const filename = urlToFilename(url);
    const filePath = path.join(this.outputDir, filename);

    try {
      const pageContent = await this.extractPageContent(url, lastmod);
      if (!pageContent) return null;

      const contentStr = JSON.stringify(pageContent, null, 2);
      const currentHash = generateHash(contentStr);
      let modified = false;
      let isNew = false;

      if (await FileUtils.fileExists(filePath)) {
        const existingContent = await FileUtils.readFile(filePath);
        const existingHash = generateHash(existingContent);
        modified = currentHash !== existingHash;
      } else {
        isNew = true;
      }

      if (isNew || modified) {
        await FileUtils.writeFile(filePath, contentStr);
        console.error(`Saved ${isNew ? 'new' : 'modified'} document: ${filename} (URL: ${url.substring(0, 60)}...)`);
      }

      return {
        url,
        filePath,
        hash: currentHash,
        modified,
        isNew,
        contentLength: contentStr.length
      };

    } catch (error) {
      console.error(`Failed to process URL ${url}:`, error instanceof Error ? error.message : error);
      this.stats.errors++;
      return null;
    }
  }

  private async extractPageContent(url: string, lastmod: string): Promise<PageContent | null> {
    try {
      const response = await axiosInstance.get(url);
      const html = response.data;
      const $ = cheerio.load(html);

      const title = $('head title').text().trim() || $('h1').first().text().trim() || url;
      const description = $('meta[name="description"]').attr('content') ||
                          $('meta[property="og:description"]').attr('content') || '';

      $('script, style, nav, header, footer, aside, .sidebar, .toc, .menu, .navigation, .ads, .advertisement, noscript').remove();

      let contentElement = $('main').first();
      if (!contentElement.length) contentElement = $('article').first();
      if (!contentElement.length) contentElement = $('.content').first();
      if (!contentElement.length) contentElement = $('#content').first();
      if (!contentElement.length) contentElement = $('body');

      let content = contentElement.text();
      content = content.replace(/\s\s+/g, ' ').replace(/\n+/g, '\n').trim();

      if (content.length < 50) {
          console.warn(`Extracted minimal content (${content.length} chars) from ${url}. Skipping.`);
          return null;
      }

      return { url, lastmod, title, description, content };

    } catch (error: any) {
      console.error(`Error extracting content from ${url}: ${error.message}`);
      this.stats.errors++;
      return null;
    }
  }

  private async extractSitemapUrls(): Promise<SitemapUrl[]> {
    try {
      console.error(`Downloading sitemap from ${this.sitemapUrl}`);
      const response = await axiosInstance.get(this.sitemapUrl);
      const xmlData = response.data;
      const $ = cheerio.load(xmlData, { xmlMode: true });
      const urls: SitemapUrl[] = [];

      $('url').each((_, element) => {
        const loc = $(element).find('loc').text().trim();
        const lastmod = $(element).find('lastmod').text().trim() || new Date(0).toISOString();

        if (loc && !loc.includes('/playground')) {
          try {
            new URL(loc);
            urls.push({ loc, lastmod });
          } catch (e) {
              console.warn(`Skipping invalid URL in sitemap: ${loc}`);
          }
        }
      });
      return urls;
    } catch (error) {
      console.error(`Failed to extract sitemap URLs:`, error);
      throw new Error(`Could not fetch or parse sitemap from ${this.sitemapUrl}`);
    }
  }

  private filterUrlsToUpdate(sitemapUrls: SitemapUrl[], cache: CacheData): SitemapUrl[] {
    return sitemapUrls.filter(({ loc, lastmod }) => {
      const cachedLastmod = cache.urls[loc];
      return !cachedLastmod || new Date(lastmod) > new Date(cachedLastmod);
    });
  }

  private async loadLastModCache(): Promise<CacheData> {
    try {
      if (await FileUtils.fileExists(this.cacheFile)) {
        const cacheContent = await FileUtils.readFile(this.cacheFile);
        const parsed = JSON.parse(cacheContent);
        if (parsed && typeof parsed === 'object' && typeof parsed.urls === 'object') {
            return parsed as CacheData;
        }
        console.warn(`Cache file ${this.cacheFile} has invalid format. Starting fresh.`);
      }
    } catch (error) {
      console.error(`Error reading cache file ${this.cacheFile}, creating a new one:`, error);
    }
    return { lastRun: '', urls: {} };
  }

  private async saveLastModCache(cache: CacheData): Promise<void> {
    try {
      cache.lastRun = new Date().toISOString();
      await FileUtils.writeFile(this.cacheFile, JSON.stringify(cache, null, 2));
      console.error(`Cache saved to: ${this.cacheFile}`);
    } catch (error) {
      console.error(`Error saving cache to ${this.cacheFile}:`, error);
    }
  }

  private async updateSummary(results: FileProcessResult[]): Promise<void> {
      const summaryPath = path.join(this.outputDir, 'summary.json');
      let summary: { url: string; title: string; filename: string }[] = [];
      try {
          if (await FileUtils.fileExists(summaryPath)) {
              const existingContent = await FileUtils.readFile(summaryPath);
              summary = JSON.parse(existingContent);
          }
      } catch (error) {
          console.warn(`Could not load existing summary file: ${summaryPath}`, error);
      }

      const summaryMap = new Map(summary.map(item => [item.url, item]));
      let updatedCount = 0;

      for (const result of results) {
          if (result && (result.isNew || result.modified)) {
              try {
                  const content = await FileUtils.readFile(result.filePath);
                  const pageData = JSON.parse(content) as PageContent;
                  summaryMap.set(result.url, {
                      url: result.url,
                      title: pageData.title || 'No Title',
                      filename: path.basename(result.filePath)
                  });
                  updatedCount++;
              } catch (error) {
                  console.error(`Error reading/parsing updated file for summary: ${result.filePath}`, error);
              }
          }
      }

      if (updatedCount > 0) {
          try {
              await FileUtils.writeFile(summaryPath, JSON.stringify(Array.from(summaryMap.values()), null, 2));
              console.error(`Summary file updated with ${updatedCount} changes at: ${summaryPath}`);
          } catch (error) {
              console.error(`Error writing summary file: ${summaryPath}`, error);
          }
      } else {
           console.error(`Summary file remains unchanged.`);
      }
  }

  private printProgress(): void {
    const processed = this.stats.processedUrls;
    const total = this.stats.totalUrls;
    const percentage = total > 0 ? ((processed / total) * 100).toFixed(1) : '0.0';
    const elapsedSecs = (Date.now() - this.startTime) / 1000;
    const rate = elapsedSecs > 0 ? (processed / elapsedSecs).toFixed(2) : '0.00';
    process.stderr.write(
        `\rProgress: ${processed}/${total} URLs (${percentage}%) | Modified: ${this.stats.modifiedUrls} | Errors: ${this.stats.errors} | Rate: ${rate} URLs/sec`
    );
  }

  private printStats(): void {
    const elapsedSecs = (Date.now() - this.startTime) / 1000;
    const mbProcessed = (this.stats.totalBytes / (1024 * 1024)).toFixed(2);
    console.error(`\n--- Fetcher Stats ---`);
    console.error(`Total URLs in Sitemap: ${this.stats.totalUrls}`);
    console.error(`URLs Processed: ${this.stats.processedUrls}`);
    console.error(`URLs Modified/New: ${this.stats.modifiedUrls}`);
    console.error(`Errors Encountered: ${this.stats.errors}`);
    console.error(`Total Data Processed: ${mbProcessed} MB`);
    console.error(`Total Time: ${formatDuration(elapsedSecs)}`);
    console.error(`---------------------`);
  }
}