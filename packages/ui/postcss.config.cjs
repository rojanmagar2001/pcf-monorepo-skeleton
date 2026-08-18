/**
 * Used by the normal postcss pipeline (the web app's Vite build and
 * Storybook), pointed at the one shared Tailwind config. The PCF build never
 * touches this file - it consumes the prebuilt string from `dist/styles.js`.
 */
module.exports = {
  plugins: {
    tailwindcss: { config: require.resolve('./tailwind.config.ts') },
    autoprefixer: {},
  },
};
