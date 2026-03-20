import * as fs from 'fs/promises';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import gabAstroCompress from '../src/index';
import { getFileSize, mockLogger, setupTestFile, setupTestFiles } from './helpers';

describe('CSS Compression', () => {
  let tempDir: string;
  let buildDir: string;

  const TEST_CSS = {
    basic: {
      name: 'basic.css',
      content: `
        .container {
          padding: 20px   20px   20px   20px;  /* Should be simplified */
          margin-top: 0px;  /* Zero units should be removed */
          color: #ffffff;  /* Should be shortened to #fff */
          background-color: #000000;  /* Should be shortened to #000 */
        } 

        /* This comment should be removed */
        .button {
          display: block;
          width: 100%;
          border-width: 1px;
          border-style: solid;
          border-color: black;  /* Should be combined into border shorthand */
        }
      `
    },
    withVendorPrefixes: {
      name: 'prefixes.css',
      content: `
        .box {
          -webkit-border-radius: 10px;
          -moz-border-radius: 10px;
          border-radius: 10px;
          
          -webkit-box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
          -moz-box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
          box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
        }
      `
    }
  };

  beforeEach(async () => {
    tempDir = path.join(__dirname, 'fixtures', 'temp-css-' + Date.now());
    buildDir = path.join(tempDir, 'dist');
    await fs.mkdir(tempDir, { recursive: true });
    await setupTestFiles(buildDir, TEST_CSS);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function runCompression(compress: ReturnType<typeof gabAstroCompress>) {
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

    await compress.hooks['astro:build:done']?.({
      dir: pathToFileURL(buildDir),
      pages: [{ pathname: '/index.html' }],
      routes: [],
      assets: new Map(),
      logger: mockLogger,
    });
  }

  test('should minify basic CSS', async () => {
    const filePath = path.join(buildDir, TEST_CSS.basic.name);
    const originalSize = await getFileSize(filePath);
    
    const compress = gabAstroCompress();
    await runCompression(compress);

    const compressedContent = await fs.readFile(filePath, 'utf-8');
    const compressedSize = await getFileSize(filePath);
    
    // Verify size reduction
    expect(compressedSize).toBeLessThan(originalSize);
    
    // Verify optimizations
    expect(compressedContent).toContain('padding:20px');  // Simplified padding
    expect(compressedContent).toContain('margin-top:0');  // Removed unit from zero
    expect(compressedContent).toContain('#fff');  // Shortened color
    expect(compressedContent).toContain('#000');  // Shortened color
    
    // Verify comment removal
    expect(compressedContent).not.toContain('/* This comment should be removed */');
  });

  test('should handle vendor prefixes', async () => {
    const filePath = path.join(buildDir, TEST_CSS.withVendorPrefixes.name);
    const originalSize = await getFileSize(filePath);
    
    const compress = gabAstroCompress();
    await runCompression(compress);

    const compressedContent = await fs.readFile(filePath, 'utf-8');
    const compressedSize = await getFileSize(filePath);
    
    // Verify size reduction
    expect(compressedSize).toBeLessThan(originalSize);
    
    // Verify prefixes are preserved
    expect(compressedContent).toContain('-webkit-border-radius:10px');
    expect(compressedContent).toContain('-moz-border-radius:10px');
    expect(compressedContent).toContain('border-radius:10px');
    
    // Verify rgba color is compressed
    expect(compressedContent).toContain('rgba(0,0,0,.5)');
  });

  test('should handle malformed CSS gracefully', async () => {
    const malformedCSS = {
      name: 'malformed.css',
      content: `
        / .broken {
          color: red  /* Missing closing brace */
        .another {
          display: block;
      `
    };

    const filePath = await setupTestFile(tempDir, malformedCSS);
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