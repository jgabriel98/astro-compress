import * as fs from 'fs/promises';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import gabAstroCompress from '../src/index';
import { getFileSize, mockLogger, setupTestFile } from './helpers';

describe('JavaScript Compression', () => {
  let tempDir: string;
  let buildDir: string;

  const TEST_JS = {
    basicJs: {
      name: 'basic.js',
      content: `
        // This comment should be removed
        function calculateSum(a, b) {
            const result = a + b;  // Inline comment
            return result;
        }

        const longVariableName = "This is a long string that should be preserved";
        
        /* Multi-line comment
           that should be removed */
        function unusedFunction(unused) {
            console.log("This function might be removed");
        }

        export function main() {
            const x = calculateSum(5, 10);
            console.log(longVariableName);
        }
      `
    },
    withES6: {
      name: 'modern.mjs',
      content: `
        const arrowFunction = (x) => {
            return x.map(item => item * 2);
        };

        class TestClass {
            constructor(value) {
                this.value = value;
            }

            getValue() {
                return this.value;
            }
        }

        const [a, b, ...rest] = [1, 2, 3, 4, 5];
        const { property: renamed } = { property: "value" };
      `
    }
  };

  beforeAll(async () => {
    tempDir = path.join(__dirname, 'fixtures', 'temp-js-' + Date.now());
    buildDir = path.join(tempDir, 'dist');
  });

  afterEach(async () => {
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

  test('should minify basic JavaScript', async () => {
    const filePath = await setupTestFile(buildDir, TEST_JS.basicJs);
    const originalSize = await getFileSize(filePath);

    const compress = gabAstroCompress();
    await runCompression(compress);

    const compressedContent = await fs.readFile(filePath, 'utf-8');
    const compressedSize = await getFileSize(filePath);

    // Verify size reduction
    expect(compressedSize).toBeLessThan(originalSize);

    // Verify comment removal
    expect(compressedContent).not.toContain('// This comment should be removed');
    expect(compressedContent).not.toContain('// Inline comment');
    expect(compressedContent).not.toContain('/* Multi-line comment');

    // Verify code functionality is preserved
    expect(compressedContent).toContain('function calculateSum');
    expect(compressedContent).toContain('export function main');
    expect(compressedContent).toContain('This is a long string that should be preserved');
  });

  test('should handle ES6+ features', async () => {
    const filePath = await setupTestFile(buildDir, TEST_JS.withES6);
    const originalSize = await getFileSize(filePath);

    const compress = gabAstroCompress();
    await runCompression(compress);

    const compressedContent = await fs.readFile(filePath, 'utf-8');
    const compressedSize = await getFileSize(filePath);

    // Verify size reduction
    expect(compressedSize).toBeLessThan(originalSize);

    // Verify ES6+ features are preserved
    expect(compressedContent).toContain('=>');  // Arrow functions
    expect(compressedContent).toContain('class');  // Class syntax
    expect(compressedContent).toContain('constructor');
    expect(compressedContent).toContain('...rest');  // Rest operator
  });

  test('should handle malformed JavaScript gracefully', async () => {
    const malformedJS = {
      name: 'malformed.js',
      content: `
        function broken {  // Missing parentheses
          const x = 'unclosed string
          return x
        }
      `
    };

    const filePath = await setupTestFile(buildDir, malformedJS);
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