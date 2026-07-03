import baseConfig from './base.js';

/**
 * Next.js ESLint configuration.
 * Extends base with Next.js specific rules.
 *
 * Note: react/no-danger is intentionally omitted here because eslint-plugin-react
 * must be explicitly imported in ESLint 9 flat config before its rules can be used.
 * dangerouslySetInnerHTML is structurally discouraged in the Next.js App Router
 * and RSC architecture; if required, add eslint-plugin-react to this package.
 */
export default [
  ...baseConfig,
];
