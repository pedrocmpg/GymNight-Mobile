/**
 * Unit tests for Design_Token_Module (tokens.ts)
 *
 * Validates:
 * - Requirements 13.1: All required color tokens exist and are distinct
 * - Requirements 13.2: Spacing scale is strictly increasing with at least 4 values
 * - Requirements 13.5: No light-mode keys present in the exported module
 */
import { colors, typography, spacing, radii, fonts, layout, motion } from './tokens';

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

  describe('REDESIGN-04 — paleta minimal premium', () => {
    it('pins the layered surfaces, the brand lime and the text hierarchy', () => {
      expect(colors.background).toBe('#0a0a0a');
      expect(colors.surface).toBe('#111113');
      expect(colors.card).toBe('#18181b');
      expect(colors.cardAlt).toBe('#222226');
      expect(colors.border).toBe('#2a2a2e');
      expect(colors.primary).toBe('#a2ff00');
      expect(colors.primaryText).toBe('#f4f4f5');
      expect(colors.secondaryText).toBe('#a1a1aa');
      expect(colors.tertiaryText).toBe('#71717a');
      expect(colors.error).toBe('#f87171');
    });

    it('retires the neon-era keys', () => {
      for (const key of ['primaryHover', 'primaryDark', 'primaryBg', 'primaryMuted', 'errorBg', 'scrim']) {
        expect(colors).not.toHaveProperty(key);
      }
    });

    it('radii step from tiny badges to sheet corners', () => {
      expect(radii.xs).toBe(4);
      expect(radii.sm).toBe(8);
      expect(radii.md).toBe(12);
      expect(radii.lg).toBe(16);
      expect(radii.xl).toBe(24);
    });

    it('every screen shares a 20px gutter and 44px hit targets', () => {
      expect(layout.gutter).toBe(20);
      expect(layout.hitTarget).toBe(44);
      expect(layout.controlHeight.md).toBeGreaterThanOrEqual(layout.hitTarget);
    });

    it('press feedback is subtle and durations stay short', () => {
      expect(motion.pressScale).toBeGreaterThan(0.9);
      expect(motion.pressScale).toBeLessThan(1);
      expect(motion.duration.slow).toBeLessThanOrEqual(300);
    });
  });

  describe('REDESIGN-04 — contraste WCAG', () => {
    function luminance(hex: string): number {
      const n = parseInt(hex.replace('#', ''), 16);
      const channel = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
    }

    function contrast(a: string, b: string): number {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    }

    const surfaces = [colors.background, colors.surface, colors.card];

    it.each(['primaryText', 'secondaryText', 'error'] as const)(
      '%s passes AA (4.5:1) on every surface',
      (key) => {
        for (const surface of surfaces) {
          expect(contrast(colors[key], surface)).toBeGreaterThanOrEqual(4.5);
        }
      },
    );

    it('tertiaryText passes 3:1 on background and card (large/secondary text only)', () => {
      expect(contrast(colors.tertiaryText, colors.background)).toBeGreaterThanOrEqual(3);
      expect(contrast(colors.tertiaryText, colors.card)).toBeGreaterThanOrEqual(3);
    });

    it('text on the lime CTA passes AA', () => {
      expect(contrast(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('Tipografia com famílias da Inter', () => {
    it('every font token is a distinct Inter family name', () => {
      const families = Object.values(fonts);
      for (const family of families) {
        expect(family).toMatch(/^Inter_\d{3}[A-Za-z]+$/);
      }
      expect(new Set(families).size).toBe(families.length);
    });

    it('every typography token carries a fontFamily and a positive fontSize', () => {
      for (const [name, style] of Object.entries(typography)) {
        expect(typeof style.fontFamily).toBe(`string`);
        expect(Object.values(fonts)).toContain(style.fontFamily);
        expect(style.fontSize).toBeGreaterThan(0);
        expect(name).toBeTruthy();
      }
    });

    it('no typography token declares fontWeight — Android ignores it when fontFamily is set', () => {
      for (const style of Object.values(typography)) {
        expect(style).not.toHaveProperty('fontWeight');
      }
    });

    it('every typography token sets a lineHeight at least as tall as its fontSize', () => {
      for (const style of Object.values(typography)) {
        expect(style.lineHeight).toBeGreaterThanOrEqual(style.fontSize);
      }
    });
  });
});
