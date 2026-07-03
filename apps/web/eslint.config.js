import nextConfig from '@verity/eslint-config/next.js';

/**
 * ESLint flat config for @verity/web.
 * Extends the shared Next.js config from @verity/eslint-config.
 */
export default [
  ...nextConfig,
  {
    ignores: ['.next/**', 'node_modules/**'],
  },
];
