/**
 * Unit tests for Design_Token_Module (tokens.ts)
 *
 * Validates:
 * - Requirements 13.1: All required color tokens exist and are distinct
 * - Requirements 13.2: Spacing scale is strictly increasing with at least 4 values
 * - Requirements 13.5: No light-mode keys present in the exported module
 */
import { colors, typography, spacing, radii, fonts, glow } from './tokens';

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

  describe('Wave 0 — Paleta portada do GymNight-Desktop', () => {
    it('uses the desktop palette values verbatim (theme.py:10-38)', () => {
      expect(colors.background).toBe('#0a0a0a'); // C_BG
      expect(colors.surface).toBe('#0f0f0f'); // C_SURFACE
      expect(colors.card).toBe('#1a1a1a'); // C_CARD
      expect(colors.cardAlt).toBe('#222222'); // C_CARD2
      expect(colors.border).toBe('#2a2a2a'); // C_BORDER
      expect(colors.primary).toBe('#a2ff00'); // C_GREEN
      expect(colors.primaryHover).toBe('#b5f542'); // C_GREEN_ACTIVE
      expect(colors.primaryDark).toBe('#65a30d'); // C_GREEN_DK
      expect(colors.primaryText).toBe('#ffffff'); // C_TEXT
      expect(colors.secondaryText).toBe('#6b7280'); // C_TEXT2
      expect(colors.error).toBe('#ef4444'); // C_RED
    });

    it('radii match RADIUS_SM / RADIUS_MD / RADIUS_LG of the desktop', () => {
      expect(radii.sm).toBe(6);
      expect(radii.md).toBe(10);
      expect(radii.lg).toBe(16);
    });
  });

  describe('Wave 0 — Tipografia com famílias da Inter', () => {
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
  });

  describe('Wave 0 — glow() (equivalente ao neon_glow do desktop)', () => {
    it('produces a centered boxShadow in the requested color and radius', () => {
      const style = glow('#a2ff00', 20, 0.35);
      expect(style.boxShadow).toBe('0px 0px 20px rgba(162, 255, 0, 0.35)');
      expect(style.shadowOffset).toEqual({ width: 0, height: 0 });
    });

    it('defaults to the primary accent', () => {
      expect(glow().boxShadow).toContain('rgba(162, 255, 0,');
    });

    it('keeps the shadow* fallback consistent with the requested values', () => {
      const style = glow(colors.error, 12, 0.5);
      expect(style.shadowColor).toBe(colors.error);
      expect(style.shadowOpacity).toBe(0.5);
      expect(style.shadowRadius).toBe(6);
    });
  });
});
