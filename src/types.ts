import type { Options as HtmlMinifierOptions } from 'html-minifier-terser';
import type {
  AvifOptions,
  HeifOptions,
  JpegOptions,
  PngOptions,
  TiffOptions,
  WebpOptions,
  GifOptions,
  JxlOptions,
} from 'sharp';
import type { Config as SvgoConfig } from 'svgo';
import type { MinifyOptions } from 'terser';
import type { TransformOptions } from 'lightningcss';

// Lightning CSS options excluding fields that are set at call time (code, filename, minify, targets).
// `targets` is replaced with a plain string[] accepting browserslist queries (e.g. ['safari >= 15']).
// Using `any` for the CustomAtRules generic since we don't need custom at-rules for basic CSS minification.
export type LightningCssOptions = Omit<
  TransformOptions<any>,
  'code' | 'filename' | 'minify' | 'targets'
> & {
  /** Browserslist queries that control which browser-specific CSS transforms and prefixes are applied.
   * Example: `['safari >= 15', 'chrome >= 100']`
   * Omitting this field means no browser-specific transforms are applied beyond minification. */
  targets?: string[];
};

export interface FormatCompressionOptions {
  png?: PngOptions;
  jpeg?: JpegOptions;
  jxl?: JxlOptions;
  webp?: WebpOptions;
  avif?: AvifOptions;
  heif?: HeifOptions;
  gif?: GifOptions;
  tiff?: TiffOptions;
  html?: HtmlMinifierOptions;
  js?: MinifyOptions;
  svg?: SvgoConfig;
  css?: LightningCssOptions;
}

export interface CompressOptions extends FormatCompressionOptions {
  cache?: {
    enabled: boolean;
    cacheDir?: string;
  };
}

export type UsedFormatConfig = {
  config: ValueOf<FormatCompressionOptions>;
  format: string;
} | null;

export type ValueOf<T> = T[keyof T];

export type SetValueType<T> = T extends Set<infer U> ? U : never;
