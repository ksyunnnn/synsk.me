import { defineConfig } from "eslint/config";
import next from "eslint-config-next";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([{
    extends: [
        ...next,
        ...nextCoreWebVitals,
        ...compat.extends("plugin:jsx-a11y/recommended"),
        ...compat.extends("prettier")
    ],

    plugins: {
        "@typescript-eslint": typescriptEslint,
    },

    rules: {
        "react/function-component-definition": [2, {
            namedComponents: "arrow-function",
        }],

        "@typescript-eslint/no-unused-vars": 1,
        "no-console": 2,
        "@typescript-eslint/no-explicit-any": 2,
    },
}]);