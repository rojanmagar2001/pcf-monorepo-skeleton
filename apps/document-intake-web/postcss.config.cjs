/**
 * The normal postcss pipeline, pointed at the workspace's single Tailwind
 * config. Storybook uses the same config, so what the harness renders and what
 * the control ships come from one source.
 */
module.exports = {
  plugins: {
    tailwindcss: { config: require.resolve('@document-intake/ui/tailwind.config') },
    autoprefixer: {},
  },
};
