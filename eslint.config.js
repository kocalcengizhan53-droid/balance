import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    /*
     * shadcn/ui files export variant helpers next to their components, which trips the fast
     * refresh rule. The template switched the rule off for the whole project; scoped here it
     * still protects everything we write ourselves.
     */
    files: ['src/components/ui/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    /*
     * The scene owns three.js objects — materials, uniforms — that are mutable by design and
     * are updated from effects and from the frame loop. The compiler rule against mutating a
     * value once it has been handed to JSX cannot know that; the compiler leaves these
     * components unmemoised, which is what a render loop wants anyway.
     */
    files: ['src/features/scene/**/*.{ts,tsx}'],
    rules: { 'react-hooks/immutability': 'off' },
  },
])
