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

    // 11. Regression test for pure red #FF0000 — exact known values
    // Kills: h+180 -> h-180 mutation (line 61) since palette[5] changes from #d1e6e6 to #e6e6e6
    it('should produce known exact palette for pure red #FF0000', () => {
      expect(generatePalette('#FF0000')).toEqual([
        '#e8c9c9', // Primary pastel (H=0)
        '#e9ded2', // Analogous +30
        '#cbe6cb', // Triadic +120
        '#cbcbe6', // Triadic +240
        '#eaead7', // Analogous +60
        '#d1e6e6', // Complementary (H=180) — differs from h-180 mutation which gives #e6e6e6
        '#efe7e7', // Very light primary
        '#ac3939', // Medium primary (border/accent)
      ]);
    });

    // 12. Regression test for pure green #00FF00 — covers case g: branch in hexToHsl
    // Kills: NoCoverage mutants on line 25 (the green-dominant case: h = ((b-r)/d + 2) / 6)
    it('should produce known exact palette for pure green #00FF00', () => {
      expect(generatePalette('#00FF00')).toEqual([
        '#c9e8c9', // Primary pastel (H=120)
        '#d2e9de', // Analogous +30
        '#cbcbe6', // Triadic +120
        '#e6cbcb', // Triadic +240
        '#d7eaea', // Analogous +60
        '#e6d1e6', // Complementary (H=300)
        '#e7efe7', // Very light primary
        '#39ac39', // Medium primary (border/accent)
      ]);
    });

    // 15. Regression test for mid-green #40CC20 (H≈110, S≈74%, L≈47%)
    // Green is dominant channel (G=0.8 > R=0.25 > B=0.125), r != 0 and b != 0
    // Kills: (b-r)/d -> (b-r)*d mutation (line 25) — *d vs /d differ when d != 1
    // Also kills: (b-r)/d -> (b+r)/d mutation (line 25) — b+r != b-r when r != 0
    it('should produce known exact palette for mid-green #40CC20', () => {
      expect(generatePalette('#40CC20')).toEqual([
        '#d2e4ce', // Primary pastel (H~110)
        '#d5e6db', // Analogous +30
        '#cfd3e3', // Triadic +120
        '#e3cfd3', // Triadic +240
        '#dae7e5', // Analogous +60
        '#e0d3e3', // Complementary
        '#e9eee8', // Very light primary
        '#589d49', // Medium primary (border/accent)
      ]);
    });

    // 13. Regression test for dark red #CC0000 (H=0, S=100%, L=40%)
    // Kills: l=(max+min)/2 -> *2 mutation (line 18) — changes saturation branch result
    // Also kills: l>0.5 -> true/l>=0.5 mutations (line 22) — l=0.4 uses different formula
    // Also kills: d/(max+min) -> d*(max+min) and d/(max-min) mutations (line 22)
    // Note: CC0000 and FF0000 produce same normal palette (both H=0, S=100%)
    // but mutations in hexToHsl produce different results for CC0000 (l=40%) vs FF0000 (l=50%)
    it('should produce known exact palette for dark red #CC0000', () => {
      expect(generatePalette('#CC0000')).toEqual([
        '#e8c9c9', // Primary pastel (H=0, S=100%)
        '#e9ded2', // Analogous +30
        '#cbe6cb', // Triadic +120
        '#cbcbe6', // Triadic +240
        '#eaead7', // Analogous +60
        '#d1e6e6', // Complementary
        '#efe7e7', // Very light primary
        '#ac3939', // Medium primary (border/accent)
      ]);
    });

    // 14. Regression test for dark rose #C83264 (H=340, S=60%, L=49%)
    // This color has: red is max, g < b (g=50, b=100 in 0-255), d != 1
    // Kills: (g-b)/d -> (g+b)/d hue mutation (line 24) — hue changes from 340 to 420 degrees
    // Also kills: /d -> *d hue mutation (line 24) — hue changes from 340 to ~353 degrees
    // Also kills: /6 -> *6 hue mutation (line 24) — hue changes drastically
    it('should produce known exact palette for dark rose #C83264', () => {
      expect(generatePalette('#C83264')).toEqual([
        '#e2d0d6', // Primary pastel (H=340)
        '#e5d9d7', // Analogous +30
        '#d6e1d1', // Triadic +120
        '#d1d6e1', // Triadic +240
        '#e6e2db', // Analogous +60
        '#d5e2dd', // Complementary (H=160)
        '#ede8ea', // Very light primary
        '#955067', // Medium primary (border/accent)
      ]);
    });
  });
});
