// =============================================================================
// color-utils.test.ts -- Tests for Harmonious Color Palette Generation
// =============================================================================

import { describe, it, expect } from 'vitest';
import { generatePalette } from '../color-utils.js';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('color-utils', () => {
  describe('generatePalette', () => {
    // 1. Returns exactly 8 colors
    it('should return exactly 8 colors', () => {
      expect(generatePalette('#4169E1').length).toBe(8);
    });

    // 2. All colors are valid lowercase hex strings
    it('should return valid hex colors', () => {
      const palette = generatePalette('#4169E1');
      for (const color of palette) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });

    // 3. First color is lighter than input
    it('should make palette[0] lighter than the input color', () => {
      // Royal Blue #4169E1 has lightness ~57% — palette[0] should be ~85%
      const palette = generatePalette('#4169E1');
      const { r, g, b } = hexToRgb(palette[0]);
      // High lightness means all RGB channels are high
      expect(r).toBeGreaterThan(180);
      expect(g).toBeGreaterThan(180);
      expect(b).toBeGreaterThan(180);
      expect(palette[0]).not.toBe('#4169e1');
    });

    // 4. Last color (palette[7]) is noticeably darker than pastel colors
    it('should make palette[7] darker than pastel colors', () => {
      const palette = generatePalette('#4169E1');
      const accent = hexToRgb(palette[7]);
      // palette[7] is medium lightness (~45%) — average channel should be noticeably lower
      const accentAvg = (accent.r + accent.g + accent.b) / 3;
      for (let i = 0; i < 7; i++) {
        const pastel = hexToRgb(palette[i]);
        const pastelAvg = (pastel.r + pastel.g + pastel.b) / 3;
        expect(accentAvg).toBeLessThan(pastelAvg - 50);
      }
    });

    // 5. Pastel colors (palette[0]-[6]) are all light
    it('should make pastel colors (palette[0]-[6]) have all RGB channels > 180', () => {
      const palette = generatePalette('#4169E1');
      for (let i = 0; i < 7; i++) {
        const { r, g, b } = hexToRgb(palette[i]);
        expect(r).toBeGreaterThan(180);
        expect(g).toBeGreaterThan(180);
        expect(b).toBeGreaterThan(180);
      }
    });

    // 6. Different inputs produce different palettes
    it('should produce different palettes for different inputs', () => {
      const red = generatePalette('#FF0000');
      const blue = generatePalette('#0000FF');
      expect(red).not.toEqual(blue);
    });

    // 7. Regression test for Royal Blue — exact known values
    it('should produce known exact palette for Royal Blue #4169E1', () => {
      const palette = generatePalette('#4169E1');
      expect(palette).toEqual([
        '#ced3e4', // Primary pastel
        '#dad5e6', // Analogous +30
        '#e2cfd4', // Triadic +120
        '#d4e2cf', // Triadic +240
        '#e4dae7', // Analogous +60
        '#e3dfd4', // Complementary
        '#e8e9ee', // Very light primary
        '#495e9c', // Medium primary (border/accent)
      ]);
    });

    // 8a. Edge case — pure black
    it('should produce valid palette for pure black #000000', () => {
      const palette = generatePalette('#000000');
      expect(palette.length).toBe(8);
      for (const color of palette) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });

    // 8b. Edge case — pure white
    it('should produce valid palette for pure white #FFFFFF', () => {
      const palette = generatePalette('#FFFFFF');
      expect(palette.length).toBe(8);
      for (const color of palette) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });

    // 8c. Edge case — grayscale (saturation = 0)
    it('should produce valid palette for grayscale #808080', () => {
      const palette = generatePalette('#808080');
      expect(palette.length).toBe(8);
      for (const color of palette) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });

    // 9. Color math verification for #FF0000 (H=0, S=100, L=50)
    it('should produce correct hue relationships for pure red #FF0000', () => {
      const palette = generatePalette('#FF0000');
      // palette[0] — pastel red: H=0, so R channel dominates
      const p0 = hexToRgb(palette[0]);
      expect(p0.r).toBeGreaterThan(p0.g);
      expect(p0.r).toBeGreaterThan(p0.b);

      // palette[2] — triadic +120 degrees (H=120, green): G dominates
      const p2 = hexToRgb(palette[2]);
      expect(p2.g).toBeGreaterThanOrEqual(p2.r);
      expect(p2.g).toBeGreaterThanOrEqual(p2.b);

      // palette[3] — triadic +240 degrees (H=240, blue): B dominates
      const p3 = hexToRgb(palette[3]);
      expect(p3.b).toBeGreaterThanOrEqual(p3.r);
      expect(p3.b).toBeGreaterThanOrEqual(p3.g);
    });

    // 10. Round-trip consistency — same input always yields identical output
    it('should return identical results for repeated calls with the same input', () => {
      const first = generatePalette('#4169E1');
      const second = generatePalette('#4169E1');
      expect(first).toEqual(second);
    });

    // Bonus: round-trip for a non-trivial color
    it('should return identical results for repeated calls with #FF6347 (tomato)', () => {
      const first = generatePalette('#FF6347');
      const second = generatePalette('#FF6347');
      expect(first).toEqual(second);
    });
  });
});
