import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier/flat';

/**
 * ESLint flat config。
 *
 * `eslint-config-next` は `@next/next` / `react` / `react-hooks` / `import` /
 * `jsx-a11y` の各プラグインと、TypeScript ファイル向けの `@typescript-eslint`
 * プラグインおよびパーサを自前で登録する。そのため FlatCompat も
 * `@eslint/eslintrc` も要らない。
 *
 * @type {import('eslint').Linter.Config[]}
 */
const config = [
  {
    ignores: [
      '.next/**',
      'dist/**',
      '.vinext/**',
      '.wrangler/**',
      'out/**',
      'build/**',
      'cloudflare-env.d.ts',
    ],
  },

  // next + next/core-web-vitals
  ...nextCoreWebVitals,

  // jsx-a11y の recommended 全体。eslint-config-next が有効にするのは 34 ルール
  // 中 6 ルールだけなので、残りを明示的に足す。
  // プラグイン本体は eslint-config-next が登録済みで、そこに入っているのは
  // `_interop_require_wildcard` を通した複製オブジェクトである。
  // `jsxA11y.flatConfigs.recommended` をそのまま展開すると同じキーに別の
  // オブジェクトを割り当てることになり `Cannot redefine plugin "jsx-a11y"`
  // で落ちる。だからルールだけを取り出す。
  {
    // `eslint-config-next` がプラグインを登録する対象は JSX を書ける拡張子に
    // 限られる。`postcss.config.cjs` のような `.cjs` を含めると
    // `Cannot find plugin "jsx-a11y"` で落ちるため、範囲を揃える。
    name: 'jsx-a11y/recommended',
    files: ['**/*.{js,mjs,jsx,ts,tsx}'],
    rules: jsxA11y.flatConfigs.recommended.rules,
  },

  // prettier と競合する整形系ルールを落とす。他の config より後に置く。
  prettier,

  {
    name: 'synsk/rules',
    files: ['**/*.{js,mjs,jsx,ts,tsx}'],
    rules: {
      'react/function-component-definition': [2, { namedComponents: 'arrow-function' }],
      'no-console': 2,
    },
  },

  {
    // `@typescript-eslint` プラグインは eslint-config-next が TypeScript
    // ファイルにだけ登録するため、ルールの適用範囲も揃える。
    name: 'synsk/rules-typescript',
    files: ['**/*.{ts,tsx,mts,cts}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 1,
      '@typescript-eslint/no-explicit-any': 2,
    },
  },

  {
    // リポジトリ直下のビルド時 Node スクリプト。失敗を stderr に出すのは
    // 正当なので `console.error` / `console.warn` を許す。
    name: 'synsk/build-config-files',
    files: ['*.{js,mjs,cjs,ts,mts,cts}'],
    rules: {
      'no-console': [2, { allow: ['error', 'warn'] }],
    },
  },
];

export default config;
