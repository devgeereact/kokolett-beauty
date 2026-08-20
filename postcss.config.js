export default {
  plugins: {
    // Tailwind 4 moved the PostCSS plugin out of the main package.
    // `tailwindcss: {}` here now throws "it looks like you're trying to use
    // tailwindcss directly as a PostCSS plugin".
    '@tailwindcss/postcss': {},
    // autoprefixer is no longer needed: Tailwind 4 handles vendor prefixing
    // via Lightning CSS internally.
  },
};
