/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        // Match the homepage's font so the shared header/footer + Layout pages
        // (about, contact, digital-marketing-services) all render identically.
        sans: ['proximanova', 'proxima-nova-1', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
