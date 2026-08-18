/**
 * The normal postcss pipeline, pointed at the workspace's single Tailwind
 * config - the same one the web app and the library build use, so what
 * Storybook renders is what the control ships.
 */
module.exports = {
  plugins: {
    tailwindcss: { config: require.resolve('@document-intake/ui/tailwind.config') },
    autoprefixer: {},
  },
};
