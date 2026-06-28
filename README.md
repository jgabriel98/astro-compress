[![NPM Downloads](https://img.shields.io/npm/dm/gab-astro-compress?logo=npm)](https://www.npmjs.com/package/gab-astro-compress) <!-- [![NPM Downloads](https://img.shields.io/npm/dt/gab-astro-compress?logo=npm)](https://www.npmjs.com/package/gab-astro-compress) -->
![NPM Version](https://img.shields.io/npm/v/gab-astro-compress/latest?logo=npm)

# AstroCompress

A powerful compression integration for static assets in Astro. This package automatically optimizes and compresses various file types including images, HTML, JavaScript, CSS, and SVG files during the build process.

This integraton is inspired by [astro-compress](https://github.com/withastro/astro-compress) and I would like to thank Nikola Hristov for his excellent work. In my Astro project with hundreds of images, I found that the build time was too long. Because I had difficulty understanding the high level of abstraction in the original package, I decided to create my own solution. For small projects with few images, the original package is faster, but for larger projects with many images, this package is faster.

## Features

- 🖼️ Image optimization (PNG, JPEG, JXL, WebP, AVIF, HEIF, GIF, TIFF)
- 📄 HTML minification
- 🔧 JavaScript minification
- 🎨 CSS minification
- 📐 SVG optimization
- 💾 Caching system for faster builds
- ⚙️ Highly configurable compression settings

## Installation

```bash
npm install gab-astro-compress
```

## Usage

Add the integration to your `astro.config.mjs`:

```js
import astroCompress from 'gab-astro-compress';

import { defineConfig } from 'astro';

export default defineConfig({
  integrations: [
    astroCompress({
      // optional configuration
    }),
  ],
});
```

> **Note:** gab-astro-compress hooks into the Astro `astro:build:done` hook. It is called when the static assets are finished. Add gab-astro-compress as the last integration for best results. This way it can also optimize the output of other integrations.

## Configuration

You can customize the compression settings for different file types.

- The compression for `png`, `jpeg`, `jxl`, `webp`, `avif`, `heif`, `gif` and `tiff` is handled by [sharp](https://sharp.pixelplumbing.com/api-output#png). The gab-astro-compress integration wraps the corresponding sharp options, so that you have full control over the compression process.
- The compression for `html` is handled by [html-minifier-terser](https://github.com/terser/html-minifier-terser?tab=readme-ov-file#options-quick-reference). The gab-astro-compress integration wraps the corresponding html-minifier-terser options, so that you have full control over the compression process.
- The compression for `js` is handled by [terser](https://terser.org/docs/api-reference#minify-options). The gab-astro-compress integration wraps the corresponding terser options, so that you have full control over the compression process.
- The compression for `svg` is handled by [svgo](https://github.com/svg/svgo?tab=readme-ov-file#configuration).
- The compression for `css` is handled by [Lightning CSS](https://lightningcss.dev/). `css.targets` accepts [browserslist](https://browsersl.ist/) queries and applies the same browser-specific CSS transforms to both linked stylesheets and inline styles.

Below you can find the default configuration for each file type. The effort parameter is set to max for all image formats. As we are using a cache this will provide the best compression at reasonable build times. You can override the default settings in your configuration for faster builds.

```ts
export const defaultConfig: CompressOptions = {
  cache: {
    enabled: true,
    cacheDir: 'node_modules/.astro/.gab-astro-compress',
  },
  png: {
    compressionLevel: 9.0,
    palette: true,
  },
  jpeg: {
    mozjpeg: true,
    trellisQuantisation: true,
    overshootDeringing: true,
    optimizeScans: true,
  },
  jxl: {
    effort: 9.0,
  },
  webp: {
    effort: 6.0,
  },
  avif: {
    effort: 9.0,
  },
  heif: {
    effort: 9.0,
  },
  tiff: {},
  gif: {
    effort: 6.0,
  },
  html: {
    collapseWhitespace: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: true,
    continueOnParseError: true,
  },
  js: {
    compress: true,
    mangle: true,
  },
  svg: {
    multipass: true,
  },
  css: {
    // targets: ['safari >= 15']
  },
};
```

### CSS browser targets

To make Lightning CSS apply browser-specific transforms (e.g. downlevelling modern CSS syntax for older browsers), pass one or more [browserslist](https://browsersl.ist/) queries to `css.targets`:

```js
astroCompress({
  css: {
    targets: ['safari >= 15'],
  },
});
```

Multiple queries are supported and follow standard browserslist union semantics:

```js
astroCompress({
  css: {
    targets: ['safari >= 15', 'chrome >= 100', 'firefox >= 110'],
  },
});
```

> **Note:** `css.targets` is independent from Vite's `build.target`. Vite's `build.target` controls JavaScript transpilation via esbuild; `css.targets` controls CSS transforms via Lightning CSS. Set both explicitly to keep them aligned.

## Default Configuration

If no configuration is provided, the integration will use optimal default settings for each file type. You can override specific options while keeping the defaults for others.

## Caching

The integration includes a caching system that stores compressed versions of files to speed up subsequent builds. Here's how it works:

- **Cache Storage**: Compressed files are stored in a cache directory within the project's `node_modules/.astro/.gab-astro-compress` folder by default, or in the directory specified by `cache.cacheDir`.
- **Cache Manifest**: A manifest file (`manifest.json`) keeps track of cached files, their original hashes, compression settings, and timestamps.
- **Cache Retrieval**: Before compressing a file, the system checks if a cached version exists with the same original hash and settings. If found, the cached version is used.
- **Cache Invalidation**: The cache is automatically invalidated when:
  - Source files change (detected via hash comparison).
  - Compression settings change (detected via settings comparison).
  - Cache version changes (indicating a new version of the integration).

## File Types Supported

- Images: `.png`, `.jpg | .jpeg`, `.jxl`, `.webp`, `.avif`, `.heif`, `.gif`, `.tiff | .tif`
- HTML: `.html`, `.htm`
- JavaScript: `.js`, `.cjs`, `.mjs`
- Stylesheets: `.css`
- Vector Graphics: `.svg`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Issues

If you find a bug or want to request a new feature, please open an issue on GitHub.

## Acknowledgments

This is a fork of [mysong-compress](https://github.com/mysongstudio/mysong-compress), thanks for the original creator [@mysongstudio](https://github.com/mysongstudio) !

## License

MIT
