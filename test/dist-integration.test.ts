import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { pathToFileURL } from 'url';

const DIST_DIR = path.join(__dirname, '..', 'dist');
const distReady =
  existsSync(path.join(DIST_DIR, 'index.js')) && existsSync(path.join(DIST_DIR, 'index.mjs'));

describe.skipIf(!distReady)('Distribution Files Integration Tests', () => {
  let tempDir: string;
  let buildDir: string;

  const TEST_FILES = {
    css: {
      name: 'style.css',
      content: `
        .container {
          padding: 20px   20px   20px   20px;
          color: #ffffff;
          background-color: #000000;
        }
      `,
    },
    js: {
      name: 'script.js',
      content: `
        // This comment should be removed
        function test() {
          const x = "hello";
          console.log(x);
        }
      `,
    },
    html: {
      name: 'index.html',
      content: `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Page</title>
          <!-- This comment should be removed -->
        </head>
        <body>
          <h1>Hello World</h1>
          <p>This is a test page.</p>
        </body>
        </html>
      `,
    },
  };

  async function setupTestFile(tempDir: string, fileInfo: { name: string; content: string }) {
    await fs.mkdir(tempDir, { recursive: true });
    const filePath = path.join(tempDir, fileInfo.name);
    await fs.writeFile(filePath, fileInfo.content);
    return filePath;
  }

  async function setupTestFiles(
    tempDir: string,
    files: Record<string, { name: string; content: string }>,
  ) {
    await Promise.all(Object.values(files).map((fileInfo) => setupTestFile(tempDir, fileInfo)));
  }

  const mockLogger = {
    info: () => {},
    debug: () => {},
    warn: () => {},
    error: console.error,
    fork: () => mockLogger,
    label: 'gab-astro-compress',
    options: {
      dest: { write: (_: any) => true },
      level: 'info',
    },
  };

  beforeEach(async () => {
    tempDir = path.join(__dirname, 'fixtures', 'temp-dist-' + Date.now());
    buildDir = path.join(tempDir, 'dist');
    await fs.mkdir(buildDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('CommonJS Export', () => {
    test('should export default function from CJS bundle', async () => {
      // Dynamically require the CJS build
      const gabAstroCompress = require('../dist/index.js');

      expect(gabAstroCompress).toBeDefined();
      expect(typeof gabAstroCompress.default).toBe('function');

      // Test that we can instantiate the integration
      const integration = gabAstroCompress.default();
      expect(integration).toBeDefined();
      expect(integration.hooks).toBeDefined();
    });

    test('should have required hooks in CJS export', async () => {
      const gabAstroCompress = require('../dist/index.js');
      const integration = gabAstroCompress.default();

      expect(integration.hooks).toHaveProperty('astro:config:done');
      expect(integration.hooks).toHaveProperty('astro:build:done');
      expect(typeof integration.hooks['astro:config:done']).toBe('function');
      expect(typeof integration.hooks['astro:build:done']).toBe('function');
    });

    test('should run compression hooks via CJS export', async () => {
      await setupTestFiles(buildDir, TEST_FILES);

      const gabAstroCompress = require('../dist/index.js');
      const integration = gabAstroCompress.default();

      // Run config done hook
      const configResult = await integration.hooks['astro:config:done']({
        config: {
          root: pathToFileURL(tempDir),
          srcDir: pathToFileURL(tempDir),
          outDir: pathToFileURL(buildDir),
          publicDir: pathToFileURL(`${tempDir}/public`),
        },
        logger: mockLogger,
      });

      expect(configResult).toBeUndefined(); // Hook doesn't return anything

      // Run build done hook
      const buildResult = await integration.hooks['astro:build:done']({
        dir: pathToFileURL(buildDir),
        pages: [{ pathname: '/index.html' }],
        routes: [],
        assets: new Map(),
        logger: mockLogger,
      });

      expect(buildResult).toBeUndefined(); // Hook doesn't return anything

      // Verify that files were processed (CSS and JS should be compressed)
      const cssContent = await fs.readFile(path.join(buildDir, 'style.css'), 'utf-8');
      const jsContent = await fs.readFile(path.join(buildDir, 'script.js'), 'utf-8');

      expect(cssContent.length).toBeLessThan(TEST_FILES.css.content.length);
      expect(jsContent.length).toBeLessThan(TEST_FILES.js.content.length);
    });
  });

  describe('ESM Export', () => {
    test('should export default function from ESM bundle', async () => {
      // Import the ESM build
      const gabAstroCompress = await import('../dist/index.mjs');

      expect(gabAstroCompress).toBeDefined();
      expect(typeof gabAstroCompress.default).toBe('function');

      // Test that we can instantiate the integration
      const integration = gabAstroCompress.default();
      expect(integration).toBeDefined();
      expect(integration.hooks).toBeDefined();
    });

    test('should have required hooks in ESM export', async () => {
      const gabAstroCompress = await import('../dist/index.mjs');
      const integration = gabAstroCompress.default();

      expect(integration.hooks).toHaveProperty('astro:config:done');
      expect(integration.hooks).toHaveProperty('astro:build:done');
      expect(typeof integration.hooks['astro:config:done']).toBe('function');
      expect(typeof integration.hooks['astro:build:done']).toBe('function');
    });

    test('should run compression hooks via ESM export', async () => {
      await setupTestFiles(buildDir, TEST_FILES);

      const gabAstroCompress = await import('../dist/index.mjs');
      const integration = gabAstroCompress.default();

      // Run config done hook
      const configResult = await integration.hooks['astro:config:done']!({
        config: {
          root: pathToFileURL(tempDir),
          srcDir: pathToFileURL(tempDir),
          outDir: pathToFileURL(buildDir),
          publicDir: pathToFileURL(`${tempDir}/public`),
        },
        logger: mockLogger,
      });

      expect(configResult).toBeUndefined();

      // Run build done hook
      const buildResult = await integration.hooks['astro:build:done']({
        dir: pathToFileURL(buildDir),
        pages: [{ pathname: '/index.html' }],
        routes: [],
        assets: new Map(),
        logger: mockLogger,
      });

      expect(buildResult).toBeUndefined();

      // Verify that files were processed (CSS and JS should be compressed)
      const cssContent = await fs.readFile(path.join(buildDir, 'style.css'), 'utf-8');
      const jsContent = await fs.readFile(path.join(buildDir, 'script.js'), 'utf-8');

      expect(cssContent.length).toBeLessThan(TEST_FILES.css.content.length);
      expect(jsContent.length).toBeLessThan(TEST_FILES.js.content.length);
    });
  });

  describe('Type Definitions', () => {
    test('should have TypeScript definitions for CJS', async () => {
      // Check that d.ts file exists and is readable
      const dtsPath = path.join(__dirname, '..', 'dist', 'index.d.ts');
      const dtsContent = await fs.readFile(dtsPath, 'utf-8');

      expect(dtsContent).toBeDefined();
      expect(dtsContent.length).toBeGreaterThan(0);
      expect(dtsContent).toContain('export');
    });

    test('should have TypeScript definitions for ESM', async () => {
      // Check that d.mts file exists and is readable
      const dmtsPath = path.join(__dirname, '..', 'dist', 'index.d.mts');
      const dmtsContent = await fs.readFile(dmtsPath, 'utf-8');

      expect(dmtsContent).toBeDefined();
      expect(dmtsContent.length).toBeGreaterThan(0);
      expect(dmtsContent).toContain('export');
    });
  });

  describe('Export Consistency', () => {
    test('CJS and ESM exports should have the same API', async () => {
      const cjsExport = require('../dist/index.js');
      const esmExport = await import('../dist/index.mjs');

      const cjsIntegration = cjsExport.default();
      const esmIntegration = esmExport.default();

      // Both should have the same structure
      expect(Object.keys(cjsIntegration.hooks).sort()).toEqual(
        Object.keys(esmIntegration.hooks).sort(),
      );

      // Both should be callable with the same options
      const cjsWithConfig = cjsExport.default({ js: { mangle: false } });
      const esmWithConfig = esmExport.default({ js: { mangle: false } });

      expect(cjsWithConfig.hooks).toBeDefined();
      expect(esmWithConfig.hooks).toBeDefined();
    });
  });
});
