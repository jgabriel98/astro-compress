import * as fs from 'fs/promises';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import gabAstroCompress from '../src/index';
import { getFileSize, mockLogger, setupTestFile } from './helpers';

describe('SVG Compression', () => {
  let tempDir: string;
  let buildDir: string;

  const TEST_SVGS = {
    basic: {
      name: 'basic.svg',
      content: `
        <?xml version="1.0" encoding="UTF-8"?>
        <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
          <!-- This comment should be removed -->
          <circle cx="50" cy="50" r="40" 
                  stroke="black" 
                  stroke-width="3" 
                  fill="red"/>
        </svg>
      `
    },
    withPaths: {
      name: 'paths.svg',
      content: `
        <?xml version="1.0" encoding="UTF-8"?>
        <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
          <path d="M 10 10 L 90 10 L 90 90 L 10 90 L 10 10" 
                fill="none" 
                stroke="blue" 
                stroke-width="2"/>
          <path d="M 20,20 L 80,20 L 80,80 L 20,80 Z" 
                fill="yellow"/>
        </svg>
      `
    }
  };

  beforeAll(async () => {
    tempDir = path.join(__dirname, 'fixtures', 'temp-svg-' + Date.now());
    buildDir = path.join(tempDir, 'dist');
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function runCompression(compress: ReturnType<typeof gabAstroCompress>) {
    // First run config hook
    await compress.hooks['astro:config:done']?.({
      // @ts-ignore
      config: {
        root: pathToFileURL(tempDir),
        srcDir: pathToFileURL(tempDir),
        outDir: pathToFileURL(buildDir),
        publicDir: pathToFileURL(`${tempDir}/public`),
      },
      logger: mockLogger,
    });

    // Then run build hook
    await compress.hooks['astro:build:done']?.({
      dir: pathToFileURL(buildDir),
      pages: [{ pathname: '/index.html' }],
      routes: [],
      assets: new Map(),
      logger: mockLogger,
    });
  }

  test('should remove comments and format SVG', async () => {
    const filePath = await setupTestFile(buildDir, TEST_SVGS.basic);
    const originalSize = await getFileSize(filePath);

    const compress = gabAstroCompress({
      svg: { multipass: true }
    });

    await runCompression(compress);

    const compressedContent = await fs.readFile(filePath, 'utf-8');
    const compressedSize = await getFileSize(filePath);

    // Verify size reduction
    expect(compressedSize).toBeLessThan(originalSize);

    // Verify comment removal
    expect(compressedContent).not.toContain('<!-- This comment should be removed -->');

    // Verify SVG structure is preserved
    expect(compressedContent).toMatch(/<circle[^>]+>/);
    expect(compressedContent).toMatch(/cx="50"/);
    expect(compressedContent).toMatch(/cy="50"/);
  });

  test('should optimize paths', async () => {
    const filePath = await setupTestFile(buildDir, TEST_SVGS.withPaths);
    const originalSize = await getFileSize(filePath);

    const compress = gabAstroCompress({
      svg: { multipass: true }
    });

    await runCompression(compress);

    const compressedContent = await fs.readFile(filePath, 'utf-8');
    const compressedSize = await getFileSize(filePath);

    // Verify size reduction
    expect(compressedSize).toBeLessThan(originalSize);

    // Verify path optimization (should convert absolute to relative commands where beneficial)
    expect(compressedContent).toMatch(/<path[^>]+d="[^"]+"/);

    // Verify essential attributes are preserved (using hex color codes)
    expect(compressedContent).toMatch(/fill="#ff0"/);  // yellow in hex
    expect(compressedContent).toMatch(/stroke="#00f"/); // blue in hex
  });

  test('should handle malformed SVG gracefully', async () => {
    const malformedSVG = {
      name: 'malformed.svg',
      content: `
        <?xml version="1.0" encoding="UTF-8"?>
        <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
          <unclosed-element>
          <invalid-tag>
          <!-- Unclosed comment
      `
    };

    const filePath = await setupTestFile(buildDir, malformedSVG);
    const originalContent = await fs.readFile(filePath, 'utf-8');

    const compress = gabAstroCompress();

    // Should not throw error
    await runCompression(compress);

    // Original file should still exist and be unchanged
    const exists = await fs.access(filePath).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    const finalContent = await fs.readFile(filePath, 'utf-8');
    expect(finalContent).toBe(originalContent);
  });
}); 