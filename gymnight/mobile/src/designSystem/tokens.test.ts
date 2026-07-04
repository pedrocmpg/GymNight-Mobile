/**
 * Unit tests for Design_Token_Module (tokens.ts)
 *
 * Validates:
 * - Requirements 13.1: All required color tokens exist and are distinct
 * - Requirements 13.2: Spacing scale is strictly increasing with at least 4 values
 * - Requirements 13.5: No light-mode keys present in the exported module
 */
import { colors, typography, spacing, radii } from './tokens';

describe('Design_Token_Module', () => {
  describe('Requirement 13.1 — Color tokens exist and are distinct', () => {
    const requiredColorKeys = [
      'background',
      'surface',
      'primary',
      'primaryText',
      'secondaryText',
      'success',
      'error',
    ] as const;

    it('exports all required color token keys', () => {
      for (const key of requiredColorKeys) {
        expect(colors).toHaveProperty(key);
        expect(typeof colors[key]).toBe('string');
        expect(colors[key].length).toBeGreaterThan(0);
      }
    });

    it('all color token values are distinct from each other', () => {
      const values = requiredColorKeys.map((k) => colors[k]);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });

  describe('Requirement 13.2 — Spacing scale is strictly increasing with >= 4 values', () => {
    it('has at least 4 spacing values', () => {
      const spacingValues = Object.values(spacing);
      expect(spacingValues.length).toBeGreaterThanOrEqual(4);
    });

    it('all spacing values are strictly increasing', () => {
      const spacingValues = Object.values(spacing);
      for (let i = 1; i < spacingValues.length; i++) {
        expect(spacingValues[i]).toBeGreaterThan(spacingValues[i - 1]);
      }
    });

    it('spacing values are practical (not trivially small)', () => {
      const spacingValues = Object.values(spacing);
      // Each value should be >= 4 to be practically useful for layout
      for (const val of spacingValues) {
        expect(val).toBeGreaterThanOrEqual(4);
      }
    });
  });

  describe('Requirement 13.5 — No light-mode tokens in the module', () => {
    const lightModeIndicators = [
      'light',
      'Light',
      'LIGHT',
      'lightMode',
      'lightBackground',
      'lightSurface',
      'lightPrimary',
      'lightText',
      'theme',
      'Theme',
    ];

    it('colors object contains no light-mode keys', () => {
      const colorKeys = Object.keys(colors);
      for (const indicator of lightModeIndicators) {
        expect(colorKeys).not.toContain(indicator);
      }
    });

    it('typography object contains no light-mode keys', () => {
      const typoKeys = Object.keys(typography);
      for (const indicator of lightModeIndicators) {
        expect(typoKeys).not.toContain(indicator);
      }
    });

    it('spacing object contains no light-mode keys', () => {
      const spacingKeys = Object.keys(spacing);
      for (const indicator of lightModeIndicators) {
        expect(spacingKeys).not.toContain(indicator);
      }
    });

    it('radii object contains no light-mode keys', () => {
      const radiiKeys = Object.keys(radii);
      for (const indicator of lightModeIndicators) {
        expect(radiiKeys).not.toContain(indicator);
      }
    });

    it('no exported object has a "mode" or "variant" property suggesting theme switching', () => {
      const allExports = { colors, typography, spacing, radii };
      for (const [, exportedObj] of Object.entries(allExports)) {
        const keys = Object.keys(exportedObj);
        expect(keys).not.toContain('mode');
        expect(keys).not.toContain('variant');
        expect(keys).not.toContain('lightMode');
        expect(keys).not.toContain('darkMode');
      }
    });
  });

  describe('Additional structural validation', () => {
    it('typography defines heading, body, and caption styles', () => {
      expect(typography).toHaveProperty('heading');
      expect(typography).toHaveProperty('body');
      expect(typography).toHaveProperty('caption');
    });

    it('radii values are numeric and positive', () => {
      for (const val of Object.values(radii)) {
        expect(typeof val).toBe('number');
        expect(val).toBeGreaterThan(0);
      }
    });
  });
});
