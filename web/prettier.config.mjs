/** @type {import("prettier").Config} */
export default {
  // --------------------------------------------------
  // Core formatting
  // --------------------------------------------------
  printWidth: 90,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  trailingComma: 'es5',
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'avoid',

  // --------------------------------------------------
  // React / JSX
  // --------------------------------------------------
  jsxSingleQuote: false,

  // --------------------------------------------------
  // Line endings
  // --------------------------------------------------
  endOfLine: 'lf',

  // --------------------------------------------------
  // Tailwind CSS class sorting
  // --------------------------------------------------
  plugins: ['prettier-plugin-tailwindcss'],
  tailwindFunctions: ['sortCx', 'cx'],
  tailwindStylesheet: './src/styles/globals.css',
};
