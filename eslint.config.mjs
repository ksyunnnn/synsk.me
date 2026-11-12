import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier/flat';
import boundaries from 'eslint-plugin-boundaries';
import { globSync, readFileSync } from 'node:fs';

/** 依存の向きの規則（ADR-0026）の対象から外す試作の置き場。 */
const boundariesIgnore = ['src/app/lab/**', 'src/app/top-draft/**'];

/**
 * 先頭に `'use client'` を書いたファイル。boundaries はファイルの中身で選べない
 * ため、設定を読み込むときに探して、パスの一覧として渡す（ADR-0026 の規則 3）。
 */
const clientFiles = globSync('src/**/*.{js,jsx,ts,tsx}', { exclude: boundariesIgnore }).filter(
  // ディレクティブの前に置けるのはコメントだけなので、先頭のコメントを読み飛ばす
  (path) =>
    /^(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*['"]use client['"]/.test(readFileSync(path, 'utf8')),
);

const featureLayers = ['domain', 'application', 'components', 'server'];
const sharedLayers = ['domain', 'components', 'server', 'types'];
const domains = ['feature-domain', 'shared-domain'];
const servers = ['feature-server', 'shared-server'];
const componentsTypes = ['feature-components', 'shared-components'];
const featureTypes = featureLayers.map((layer) => `feature-${layer}`);
const sharedTypes = [...sharedLayers.map((layer) => `shared-${layer}`), 'shared'];

/** `to` に並べた要素の種類を、値の import に限って止める。型の import は通す（ADR-0033）。 */
const disallowValue = (types, extra = {}) => ({
  to: { element: { type: types, ...extra } },
  dependency: { kind: 'value' },
});

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
      // Phosphor の入口から読み込むと、開発サーバが全アイコンのモジュールを変換して遅くなる（#331）
      'no-restricted-imports': [
        2,
        {
          paths: ['@phosphor-icons/react', '@phosphor-icons/react/ssr'].map((name) => ({
            name,
            message:
              'アイコンごとのファイルから読み込む。例: @phosphor-icons/react/dist/csr/X（サーバ専用は dist/ssr/X）',
          })),
        },
      ],
    },
  },

  {
    // 依存の向き（docs/decisions/0026-code-structure-adop.md の規則 1〜5）。
    // 既定は許可にし、禁止だけを並べる（ADR-0033）。import 先の解決は
    // eslint-config-next が設定する `import/resolver` を使う。
    name: 'synsk/boundaries',
    files: ['**/*.{js,mjs,jsx,ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/ignore': boundariesIgnore,
      'boundaries/legacy-templates': false,
      'boundaries/elements': [
        ...featureLayers.map((layer) => ({
          type: `feature-${layer}`,
          pattern: `src/features/*/${layer}`,
          capture: ['feature'],
          partialMatch: false,
        })),
        ...sharedLayers.map((layer) => ({
          type: `shared-${layer}`,
          pattern: `src/shared/${layer}`,
          partialMatch: false,
        })),
        { type: 'shared', pattern: 'src/shared', partialMatch: false },
        { type: 'app', pattern: 'src/app', partialMatch: false },
        // どの層にも当たらないファイルを受け止める（ADR-0033）
        { type: 'other', pattern: '**' },
      ],
      'boundaries/files': [{ pattern: clientFiles, category: 'client' }],
    },
    rules: {
      'boundaries/dependencies': [
        2,
        {
          default: 'allow',
          policies: [
            {
              from: { element: { type: featureTypes } },
              disallow: disallowValue(featureTypes, {
                captured: { feature: '!{{ from.element.captured.feature }}' },
              }),
              message: '規則 1: 機能どうしは import しない（ADR-0026）',
            },
            {
              from: { element: { type: sharedTypes } },
              disallow: disallowValue(featureTypes),
              message: '規則 2: shared/ は features/ を import しない（ADR-0026）',
            },
            {
              from: { file: { categories: { anyOf: ['client'] } } },
              disallow: disallowValue(servers),
              message: "規則 3: 'use client' のファイルは server/ を import しない（ADR-0026）",
            },
            {
              from: { element: { type: domains } },
              disallow: disallowValue([...servers, ...componentsTypes]),
              message: '規則 4: domain/ は server/ も components/ も import しない（ADR-0026）',
            },
            {
              from: { element: { type: 'feature-application' } },
              disallow: disallowValue([...servers, ...componentsTypes]),
              message:
                '規則 5: application/ は server/ も components/ も直接 import しない。インタフェースを介す（ADR-0026）',
            },
          ],
        },
      ],
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
    // リポジトリ直下のビルド時 Node スクリプトと `scripts/` の運用スクリプト。
    // 検査の結果を stdout に出すのが役目なので `console` を許す。
    name: 'synsk/build-config-files',
    files: ['*.{js,mjs,cjs,ts,mts,cts}', 'scripts/*.{js,mjs,cjs,ts,mts,cts}'],
    rules: {
      'no-console': 0,
    },
  },
];

export default config;
