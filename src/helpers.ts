import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import type { AstroIntegrationLogger } from 'astro';

export async function traverseDirectory(directory: URL) {
  let subTree: string[] = [];

  const dirPath = fileURLToPath(directory);
  const files = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const file of files) {
    if (file.isDirectory()) {
      const subDirPath = path.join(dirPath, file.name);
      subTree.push(
        ...await traverseDirectory(pathToFileURL(subDirPath))
      );
    }
    else {
      const filePath = path.join(dirPath, file.name);
      subTree.push(filePath);
    }
  }

  return subTree;
}

/**
 * Helper function to read file with retry for Windows file locking issues.
 * On Windows, files may still be locked from previous operations.
 */
export async function readFileSyncWithRetry(file: string, logger: AstroIntegrationLogger, maxRetries = 5, delayMs = 50): Promise<Buffer> {
  let readFileErr;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try { return fs.readFileSync(file) }
    catch (err) { readFileErr = err }
    await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
  }

  throw readFileErr;
}