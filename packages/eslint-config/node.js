import baseConfig from './base.js';

/**
 * Node.js ESLint configuration.
 * Extends base for backend packages and worker.
 */
export default [
  ...baseConfig,
  {
    rules: {
      // Node-specific: allow console for structured logging
      'no-console': 'off',
    },
  },
];
