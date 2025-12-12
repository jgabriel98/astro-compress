import type { AstroIntegrationLogger } from 'astro';
import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { CompressionCacheManagerImpl } from '../src/CompressionCache';
import { defaultCacheDir, defaultConfig } from '../src/defaultConfig';
import gabAstroCompress from '../src/index';
import { setupTestFile, setupTestFiles } from './helpers';

describe('Cache System', () => {
  let tempDir: string;

  const TEST_FILES = {
    css: {
      name: 'style.css',
      content: `
        .container {
          padding: 20px   20px   20px   20px;
          color: #ffffff;
          background-color: #000000;
        }
      `
    },
    js: {
      name: 'script.js',
      content: `
        // This comment should be removed
        function test() {
          const x = "hello";
          console.log(x);
        }
      `
    }
  } as const;

  // Create mock logger
  const mockLogger: AstroIntegrationLogger = {
    info: console.log,
    debug: console.log,
    warn: console.log,
    error: console.error,
    fork: () => mockLogger,
    label: 'gab-astro-compress',
    options: {
      dest: {
        write: () => true
      },
      level: 'info'
    }
  };

  // beforeAll(async () => {
  //   await setupTestFiles(tempDir, TEST_FILES);
  // });

  beforeEach(async () => {
    tempDir = path.join(__dirname, 'fixtures', 'temp-cache-' + Date.now());
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function runCompression(compress: ReturnType<typeof gabAstroCompress>) {
    await compress.hooks['astro:config:done']?.({
      config: {
        root: new URL(`file://${tempDir}`),
        srcDir: new URL(`file://${tempDir}`),
        outDir: new URL(`file://${tempDir}/dist`),
        publicDir: new URL(`file://${tempDir}/public`),
        base: '/',
        integrations: [],
        trailingSlash: 'never',
        server: { host: true, port: 3000, open: false },
        redirects: {},
        adapter: undefined,
        image: {
          service: { entrypoint: 'astro/assets/services/sharp', config: {} },
          domains: [],
          remotePatterns: [],
          endpoint: { route: '/image-endpoint', entrypoint: 'astro/assets/endpoint/node' }
        },
        markdown: {
          syntaxHighlight: 'shiki',
          shikiConfig: {
            langs: [],
            theme: 'github-dark',
            wrap: false,
            themes: {},
            langAlias: {},
            transformers: []
          },
          remarkPlugins: [],
          rehypePlugins: [],
          remarkRehype: {},
          gfm: true,
          smartypants: true
        },
        vite: {},
        compressHTML: true,
        build: {
          format: 'directory',
          client: new URL(`file://${tempDir}/dist/client`),
          server: new URL(`file://${tempDir}/dist/server`),
          assets: 'assets',
          serverEntry: 'entry.mjs',
          redirects: true,
          inlineStylesheets: 'auto',
          concurrency: 5
        },
        site: 'http://localhost:3000'
      },
      logger: mockLogger,
      updateConfig: (config) => config,
    });

    await compress.hooks['astro:build:done']?.({
      dir: new URL(`file://${tempDir}`),
      pages: [{ pathname: '/index.html' }],
      routes: [],
      assets: new Map(),
      logger: mockLogger,
    });
  }

  test('should cache compressed files', async () => {
    await setupTestFile(tempDir, TEST_FILES.css);
    await setupTestFile(tempDir, TEST_FILES.js);
    const cssPath = path.join(tempDir, TEST_FILES.css.name);
    const jsPath = path.join(tempDir, TEST_FILES.js.name);

    const compress = gabAstroCompress(defaultConfig);
    const cacheManager = new CompressionCacheManagerImpl(path.join(tempDir, defaultCacheDir));
    await cacheManager.initialize();

    const beforeRunCacheEntry = {
      css: await cacheManager.getCachedFile(cssPath, { "config": {}, "format": "css" }),
      js: await cacheManager.getCachedFile(jsPath, { "config": {}, "format": "js" }),
    }

    expect(beforeRunCacheEntry.css).toBeNull();
    expect(beforeRunCacheEntry.js).toBeNull();

    // First compression run
    await runCompression(compress);
    await cacheManager.loadManifest();
    const firstRunCacheEntry = {
      css: await cacheManager.getCachedFile(cssPath, { "config": defaultConfig.css, "format": "css" }),
      js: await cacheManager.getCachedFile(jsPath, { "config": defaultConfig.js, "format": "js" }),
    }

    expect(firstRunCacheEntry.css).not.toBeNull();
    expect(firstRunCacheEntry.js).not.toBeNull();

    const firstRunContent = {
      css: await fs.readFile(firstRunCacheEntry.css!.compressedPath),
      js: await fs.readFile(firstRunCacheEntry.js!.compressedPath),
    }

    // Second compression run with same files
    await runCompression(compress);
    await cacheManager.loadManifest();
    const secondRunCacheEntry = {
      css: await cacheManager.getCachedFile(cssPath, { "config": defaultConfig.css, "format": "css" }),
      js: await cacheManager.getCachedFile(jsPath, { "config": defaultConfig.js, "format": "js" }),
    }

    expect(secondRunCacheEntry.css).not.toBeNull();
    expect(secondRunCacheEntry.js).not.toBeNull();

    const secondRunContent = {
      css: await fs.readFile(secondRunCacheEntry.css!.compressedPath),
      js: await fs.readFile(secondRunCacheEntry.js!.compressedPath),
    }

    // Files should not be modified in second run (same mtime)
    expect(firstRunCacheEntry.css?.timestamp).toBe(secondRunCacheEntry.css?.timestamp);
    expect(firstRunCacheEntry.js?.timestamp).toBe(secondRunCacheEntry.js?.timestamp);
    expect(firstRunContent.css).toEqual(secondRunContent.css);
    expect(firstRunContent.js).toEqual(secondRunContent.js);
  });

  test('should recreate cache when file content changes', async () => {
    const cssPath = await setupTestFile(tempDir, TEST_FILES.css);
    const cacheManager = new CompressionCacheManagerImpl(path.join(tempDir, defaultCacheDir))


    // First compression run
    const compress = gabAstroCompress();
    await runCompression(compress);

    await cacheManager.loadManifest();
    const firstRunCacheEntry = await cacheManager.getCachedFile(cssPath, {
      "config": {},
      "format": "css"
    })
    const firstRunContent = await fs.readFile(firstRunCacheEntry!.compressedPath);

    // Modify file
    await fs.writeFile(cssPath, `
      .container {
        padding: 30px;
        color: #cccccc;
      }
    `);

    // Second compression run
    await runCompression(compress);
    await cacheManager.loadManifest();
    const secondRunCacheEntry = await cacheManager.getCachedFile(cssPath, {
      "config": {},
      "format": "css"
    })
    const secondRunContent = await fs.readFile(secondRunCacheEntry!.compressedPath);

    // File should be modified in second run (different mtime)
    expect(firstRunContent).not.toEqual(secondRunContent);
    expect(firstRunCacheEntry?.timestamp).not.toEqual(secondRunCacheEntry?.timestamp);
  });

  test('should invalidate cache when file content changes', async () => {
    const cssPath = await setupTestFile(tempDir, TEST_FILES.css);
    const cacheManager = new CompressionCacheManagerImpl(path.join(tempDir, defaultCacheDir))

    // First compression run
    const compress = gabAstroCompress();
    await runCompression(compress);

    await cacheManager.loadManifest();
    let firstRunCacheEntry = await cacheManager.getCachedFile(cssPath, {
      "config": {},
      "format": "css"
    })
    const firstRunContent = await fs.readFile(firstRunCacheEntry!.compressedPath);

    expect(firstRunCacheEntry).not.toBeNull();
    expect(firstRunContent).not.toBeNull();

    // Modify file
    await fs.writeFile(cssPath, `
      .container {
        padding: 30px;
        color: #cccccc;
      }
    `);

    // Second compression run
    await runCompression(compress);
    await cacheManager.loadManifest();
    const secondRunCacheEntry = await cacheManager.getCachedFile(cssPath, {
      "config": {},
      "format": "css"
    })
    const secondRunContent = await fs.readFile(secondRunCacheEntry!.compressedPath);
    const firstRunContentStillExists = existsSync(firstRunCacheEntry!.compressedPath);

    expect(secondRunContent).not.toBeNull();
    // File should be modified in second run
    expect(firstRunCacheEntry).not.toEqual(secondRunCacheEntry);
    expect(firstRunContentStillExists).toBe(false);
  });

  test('should recreate cache when compression settings change', async () => {
    const jsPath = await setupTestFile(tempDir, TEST_FILES.js);
    const cacheManager = new CompressionCacheManagerImpl(path.join(tempDir, defaultCacheDir))
    await cacheManager.initialize();

    // const originalContent = await fs.readFile(jsPath);

    // First compression run with default settings
    const compress1 = gabAstroCompress();
    await runCompression(compress1);

    await cacheManager.loadManifest();
    const firstRunCacheEntry = await cacheManager.getCachedFile(jsPath, {
      "config": defaultConfig.js,
      "format": "js"
    })

    expect(firstRunCacheEntry).not.toBeNull();

    // Second compression run with different settings
    const compress2 = gabAstroCompress({
      js: {
        compress: true,
        mangle: false  // Different from default
      }
    });
    await runCompression(compress2);
    await cacheManager.loadManifest();
    const secondRunCacheEntry = await cacheManager.getCachedFile(jsPath, {
      "config": {
        compress: true,
        mangle: false  // Different from default
      },
      "format": "js"
    })

    expect(secondRunCacheEntry).not.toBeNull();
    // File should be modified in second run (different mtime)
    expect(firstRunCacheEntry?.timestamp).not.toBe(secondRunCacheEntry?.timestamp);
  });

  test('should invalidate cache when compression settings change', async () => {
    const jsPath = await setupTestFile(tempDir, TEST_FILES.js);
    const cacheManager = new CompressionCacheManagerImpl(path.join(tempDir, defaultCacheDir))
    await cacheManager.initialize();

    // First compression run with default settings
    const compress1 = gabAstroCompress();
    await runCompression(compress1);

    await cacheManager.loadManifest();
    let firstRunCacheEntry = await cacheManager.getCachedFile(jsPath, {
      "config": defaultConfig.js,
      "format": "js"
    })
    let compressedContent = await fs.readFile(firstRunCacheEntry!.compressedPath);

    expect(firstRunCacheEntry).not.toBeNull();
    expect(compressedContent).not.toBeNull();

    // Second compression run with different settings
    const compress2 = gabAstroCompress({
      js: {
        compress: true,
        mangle: false  // Different from default
      }
    });
    await runCompression(compress2);

    await cacheManager.loadManifest();
    const secondRunCacheEntry = await cacheManager.getCachedFile(jsPath, {
      "config": {
        compress: true,
        mangle: false  // Different from default
      },
      "format": "js"
    })
    compressedContent = await fs.readFile(secondRunCacheEntry!.compressedPath);

    firstRunCacheEntry = await cacheManager.getCachedFile(jsPath, {
      "config": defaultConfig.js,
      "format": "js"
    })

    expect(compressedContent).not.toBeNull();
    // cache entry should not exist anymore
    expect(firstRunCacheEntry).toBeNull();
    expect(secondRunCacheEntry).not.toBeNull();
  });

  test('should handle cache directory creation', async () => {
    await setupTestFiles(tempDir, TEST_FILES);
    const cacheDir = path.join(tempDir, defaultCacheDir);

    // Run compression
    const compress = gabAstroCompress();
    await runCompression(compress);

    // Cache directory should be created
    const cacheDirExists = await fs.access(cacheDir).then(() => true).catch(() => false);
    expect(cacheDirExists).toBe(true);

    // Cache manifest should exist
    const manifestExists = await fs.access(path.join(cacheDir, 'manifest.json'))
      .then(() => true)
      .catch(() => false);
    expect(manifestExists).toBe(true);
  });

  test('should not create cache directory when cache is disabled', async () => {
    await setupTestFiles(tempDir, TEST_FILES);
    const cacheDir = path.join(tempDir, defaultCacheDir);

    // Run compression with cache disabled
    const compress = gabAstroCompress({
      cache: {
        enabled: false
      }
    });
    await runCompression(compress);

    // Cache directory should not be created
    const cacheDirExists = await fs.access(cacheDir).then(() => true).catch(() => false);
    expect(cacheDirExists).toBe(false);
  });

  test('should use custom cache directory when specified', async () => {
    await setupTestFiles(tempDir, TEST_FILES);
    const customCacheDir = 'custom-cache-dir';

    // Delete custom cache directory if it exists
    const absoluteCustomCacheDir = path.join(tempDir, customCacheDir);
    try {
      await fs.rm(absoluteCustomCacheDir, { recursive: true });
    } catch { }

    // Run compression with custom cache directory
    const compress = gabAstroCompress({
      cache: {
        enabled: true,
        cacheDir: customCacheDir
      }
    });
    await runCompression(compress);

    // Custom cache directory should be created
    const customCacheDirExists = await fs.access(absoluteCustomCacheDir).then(() => true).catch(() => false);
    expect(customCacheDirExists).toBe(true);

    // Custom cache manifest should exist
    const customManifestExists = await fs.access(path.join(absoluteCustomCacheDir, 'manifest.json'))
      .then(() => true)
      .catch(() => false);
    expect(customManifestExists).toBe(true);
  });
}, {
  sequential: true
}); 