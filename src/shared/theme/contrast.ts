/**
 * WCAG 2.x 對比度計算（relative luminance → contrast ratio）。
 * 公式來源：https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 * 供 `colors.ts` 色票挑色與 `__tests__/contrast.test.ts` 驗證共用，不在測試檔內重寫一份。
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX_PATTERN = /^#?([0-9a-fA-F]{6})$/;

export function hexToRgb(hex: string): Rgb {
  const match = HEX_PATTERN.exec(hex);
  if (!match) {
    throw new Error(`不是有效的 6 碼 hex 色碼：${hex}`);
  }
  const value = match[1];
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function linearizeChannel(channel8bit: number): number {
  const channel = channel8bit / 255;
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  const rLin = linearizeChannel(r);
  const gLin = linearizeChannel(g);
  const bLin = linearizeChannel(b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * 兩個顏色的對比度（1:1 ~ 21:1）。順序不影響結果。
 */
export function contrastRatio(hexA: string, hexB: string): number {
  const luminanceA = relativeLuminance(hexToRgb(hexA));
  const luminanceB = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}
