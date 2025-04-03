import { CoreMessage } from 'ai';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { config } from '../../config/index.js';
import { FileUtils } from '../../utils/fileUtils.js';

function getSessionFilePath(sessionId: string): string {
  const sessionsDir = config.sessionsDir;
  const safeSessionId = path.basename(sessionId).replace(/[^a-z0-9_-]/gi, '_');
  if (!safeSessionId) {
      throw new Error("Invalid sessionId provided.");
  }
  return path.join(sessionsDir, `${safeSessionId}.json`);
}

export async function loadSessionMessages(sessionId: string): Promise<CoreMessage[]> {
  const filePath = getSessionFilePath(sessionId);
  try {
    if (!(await FileUtils.fileExists(filePath))) {
      return [];
    }
    const fileContent = await FileUtils.readFile(filePath);
    const messages = JSON.parse(fileContent);
    if (Array.isArray(messages)) {
        return messages as CoreMessage[];
    } else {
        console.warn(`Session file ${filePath} content is not an array. Returning empty history.`);
        await deleteSessionMessages(sessionId);
        return [];
    }
  } catch (error) {
    console.error(`Error loading or parsing session messages for ${sessionId} from ${filePath}:`, error);
    return [];
  }
}

export async function saveSessionMessages(sessionId: string, messages: CoreMessage[]): Promise<void> {
  const filePath = getSessionFilePath(sessionId);
  try {
    await FileUtils.ensureDirectoryExists(config.sessionsDir);
    const content = JSON.stringify(messages, null, 2);
    await FileUtils.writeFile(filePath, content);
  } catch (error) {
    console.error(`Error saving session messages for ${sessionId} to ${filePath}:`, error);
  }
}

export async function deleteSessionMessages(sessionId: string): Promise<void> {
  const filePath = getSessionFilePath(sessionId);
  try {
    if (await FileUtils.fileExists(filePath)) {
      await fsp.unlink(filePath);
      // Log deletion to stderr
      console.error(`Deleted session file for ${sessionId}: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error deleting session file for ${sessionId} at ${filePath}:`, error);
  }
}

export async function deleteAllSessionMessages(): Promise<void> {
  const sessionsDir = config.sessionsDir;
  try {
    if (!(await FileUtils.directoryExists(sessionsDir))) {
      return;
    }
    const files = await FileUtils.listFiles(sessionsDir, '.json');
    let deletedCount = 0;
    for (const file of files) {
      const filePath = path.join(sessionsDir, file);
      try {
        await fsp.unlink(filePath);
        deletedCount++;
      } catch (unlinkError) {
        console.error(`Error deleting session file ${filePath}:`, unlinkError);
      }
    }
    if (deletedCount > 0) {
        // Log deletion to stderr
        console.error(`Deleted ${deletedCount} session files from ${sessionsDir}.`);
    }
  } catch (error) {
    console.error(`Error deleting all session messages from ${sessionsDir}:`, error);
  }
}