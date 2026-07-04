import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
    },
  },
  {
    // Enforce no hardcoded style literals in screens and components.
    // Only the designSystem/tokens.ts module may define literal values.
    files: ['src/screens/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "Property[key.name=/color|Color|background|Background/i] > Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
          message:
            'Hardcoded hex color values are prohibited in screens/components. Import from designSystem/tokens instead.',
        },
        {
          selector:
            "Property[key.name=/color|Color|background|Background/i] > Literal[value=/^rgb/]",
          message:
            'Hardcoded rgb/rgba color values are prohibited in screens/components. Import from designSystem/tokens instead.',
        },
        {
          selector:
            'Property[key.name=/fontSize|fontWeight|fontFamily/] > Literal',
          message:
            'Hardcoded typography values are prohibited in screens/components. Import from designSystem/tokens instead.',
        },
        {
          selector:
            'Property[key.name=/padding|margin|gap|top|bottom|left|right|Padding|Margin|Gap/] > Literal[value!=/^0$/]',
          message:
            'Hardcoded spacing values (non-zero) are prohibited in screens/components. Import from designSystem/tokens instead.',
        },
        {
          selector: 'Property[key.name=/[Rr]adius/] > Literal',
          message:
            'Hardcoded border-radius values are prohibited in screens/components. Import from designSystem/tokens instead.',
        },
      ],
    },
  },
];
