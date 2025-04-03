import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve project root assuming config is in src/config
const projectRoot = path.resolve(__dirname, '..', '..');

interface AppConfig {
  sitemapUrl: string;
  embeddingModelName: string;
  agentModelName: string;
  baseDir: string;
  docsDir: string;
  indexDir: string;
  sessionsDir: string;
  agentMaxSteps: number;
  directQueryLimitDefault: number;
  agentQueryLimitDefault: number;
  vectorDimensions: number;
}

export const config: AppConfig = {
  sitemapUrl: 'https://sdk.vercel.ai/sitemap.xml',
  embeddingModelName: "Xenova/all-MiniLM-L12-v2", 
  agentModelName: 'gemini-2.0-flash', 
  baseDir: path.join(projectRoot, 'files'),
  docsDir: path.join(projectRoot, 'files', 'docs'),
  indexDir: path.join(projectRoot, 'files', 'faiss_index'),
  sessionsDir: path.join(projectRoot, 'files', 'sessions'),
  agentMaxSteps: 8,
  directQueryLimitDefault: 5,
  agentQueryLimitDefault: 5, // Corresponds to k in similaritySearch within AgentService
  vectorDimensions: 384 // Matches HuggingFaceTransformersEmbeddings default for MiniLM
};