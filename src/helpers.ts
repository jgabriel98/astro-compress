import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

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
