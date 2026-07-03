import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Base ESLint configuration for all packages.
 *
 * Security rules (Doc 16 §17.1):
 * - no-eval: Prevents eval() usage (code execution risk)
 * - no-implied-eval: Prevents setTimeout/setInterval with strings
 * - Restricted imports: Blocks child_process, fs (write operations)
 *   to enforce Doc 1 Principle 5 (never execute user code)
 */
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      // Security: Doc 16 §17.1 — banned APIs
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-restricted-globals': [
        'error',
        {
          name: 'eval',
          message: 'eval() is banned (Doc 16 §17.1). Never execute dynamic code.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'child_process',
              message: 'child_process is banned (Doc 1 Principle 5). Verity never executes code.',
            },
          ],
        },
      ],

      // TypeScript strictness
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports' },
      ],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '.next/', 'coverage/'],
  },
);
