import * as fs from 'fs/promises';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import gabAstroCompress from '../src/index';
import { getFileSize, mockLogger, setupTestFile } from './helpers';

describe('HTML Minification', () => {
  let tempDir: string;
  let buildDir: string;

  const TEST_HTML = {
    basic: {
      name: 'test.html',
      content: `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test Page</title>
          </head>
          <body>
            <!-- This is a comment that should be removed -->
            <div class="container">
              <h1>Hello World</h1>
              <p>
                This is a test paragraph with
                multiple lines and    extra    spaces.
              </p>
            </div>
          </body>
        </html>
      `
    },
    withInlineAssets: {
      name: 'with-assets.html',
      content: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              .container {
                padding: 20px   20px   20px   20px;
                color: #ffffff;
              }
            </style>
          </head>
          <body>
            <script>
              function test() {
                // This comment should be removed
                var x = "hello";
                console.log(x);
              }
            </script>
          </body>
        </html>
      `
    }
  };

  beforeAll(async () => {
    // Create unique temp directory for this test suite
    tempDir = path.join(__dirname, 'fixtures', 'temp-html-' + Date.now());
    buildDir = path.join(tempDir, 'dist');
  });

  afterEach(async () => {
    // Clean up test directory
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

  test('should remove HTML comments', async () => {
    const filePath = await setupTestFile(buildDir, TEST_HTML.basic);
    const originalContent = await fs.readFile(filePath, 'utf-8');

    // Initialize compression with default settings
    const compress = gabAstroCompress();
    await runCompression(compress);

    const compressedContent = await fs.readFile(filePath, 'utf-8');

    // Verify comments are removed
    expect(compressedContent).not.toContain('<!-- This is a comment that should be removed -->');
    // Verify content is preserved
    expect(compressedContent).toContain('Hello World');
  });

  test('should collapse whitespace while preserving content', async () => {
    const filePath = await setupTestFile(buildDir, TEST_HTML.basic);
    const originalContent = await fs.readFile(filePath, 'utf-8');

    const compress = gabAstroCompress();
    await runCompression(compress);

    const compressedContent = await fs.readFile(filePath, 'utf-8');

    // Check that multiple spaces are collapsed
    expect(compressedContent).not.toMatch(/\s{2,}/);
    // Verify that text content is unchanged
    expect(compressedContent).toContain('This is a test paragraph with multiple lines and extra spaces');
  });

  test('should minify inline CSS and JavaScript', async () => {
    const filePath = await setupTestFile(buildDir, TEST_HTML.withInlineAssets);
    const originalSize = await getFileSize(filePath);

    const compress = gabAstroCompress({
      html: {
        minifyCSS: true,
        minifyJS: true
      }
    });

    await runCompression(compress);

    const compressedContent = await fs.readFile(filePath, 'utf-8');
    const compressedSize = await getFileSize(filePath);

    // Check that CSS is minified
    expect(compressedContent).toContain('<style>.container{padding:20px 20px 20px 20px;color:#fff}</style></head>');
    // Check that JS is minified and comments are removed
    expect(compressedContent).not.toContain('// This comment should be removed');
    expect(compressedContent).toContain('<script>function test(){console.log("hello")}</script>');
    // Verify overall file size reduction
    expect(compressedSize).toBeLessThan(originalSize);
  });

  test('should handle malformed HTML gracefully', async () => {
    const malformedHTML = {
      name: 'malformed.html',
      content: `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Malformed HTML</title>
          </head>
          <body>
            <div>Unclosed div
            <p>Unclosed paragraph
            <!-- Unclosed comment
      `
    };

    const filePath = await setupTestFile(buildDir, malformedHTML);

    const compress = gabAstroCompress();

    // Should not throw error
    await runCompression(compress);

    // Should still be able to read the file
    const compressedContent = await fs.readFile(filePath, 'utf-8');
    expect(compressedContent).toBeTruthy();
  });
}); 