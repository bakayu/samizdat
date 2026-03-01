import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
    prettier,
    js.configs.recommended,
    // TS
    ...tseslint.configs.recommended,
    // Import Plugin Configuration
    {
        files: ["**/*.{ts,tsx}"],
        plugins: {
            import: importPlugin,
        },
        rules: {
            // --- 1. THE RELATIVE IMPORT BAN ---
            "no-restricted-imports": [
                "error",
                {
                    patterns: [
                        {
                            group: ["./*", "../*"],
                            message: 'Please use absolute imports starting with "@/" instead of relative paths.',
                        },
                    ],
                },
            ],

            // --- 2. ORDERING & SORTING ---
            "import/order": [
                "error",
                {
                    groups: [
                        "builtin", // Node.js built-ins (fs, path)
                        "external", // npm packages (react, @untitledui/icons)
                        "internal", // Your @/ imports
                        ["parent", "sibling", "index"], // Relative (though we banned these, it's good for safety)
                        "object",
                        "type", // TypeScript type imports
                    ],
                    pathGroups: [
                        {
                            pattern: "react",
                            group: "external",
                            position: "before",
                        },
                        {
                            pattern: "@/**",
                            group: "internal",
                        },
                        {
                            pattern: "#imports",
                            group: "external",
                            position: "after",
                        },
                    ],
                    pathGroupsExcludedImportTypes: ["react"],
                    "newlines-between": "always",
                    alphabetize: { order: "asc", caseInsensitive: true },
                },
            ],

            // --- 3. CONSISTENCY RULES ---
            "import/first": "error", // All imports must be at the top
            "import/newline-after-import": "error", // Space between imports and code
            "import/no-duplicates": "error", // No double-importing from same file

            // --- 4. DISABLE UNRESOLVED (For WXT compatibility) ---
            "import/no-unresolved": "off",
        },
    },
    // React
    {
        files: ["**/*.{ts,tsx}"],
        plugins: {
            react,
            "react-hooks": reactHooks,
        },
        languageOptions: {
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                ...globals.browser,
                ...globals.es2023,
            },
        },
        settings: {
            react: {
                version: "detect",
            },
        },
        rules: {
            // React 17+
            "react/react-in-jsx-scope": "off",

            // Hooks
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",
        },
    },
    // Accesibility
    {
        plugins: {
            "jsx-a11y": jsxA11y,
        },
        rules: {
            ...jsxA11y.configs.recommended.rules,
        },
    },
    {
        ignores: ["dist/**", "client/**", "node_modules/**", "vite.config.ts", "src/components/**"],
    },
]);
