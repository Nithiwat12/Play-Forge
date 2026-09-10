/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f5ff",
          100: "#dbe6fe",
          200: "#bed0fd",
          300: "#90b0fb",
          400: "#5b87f7",
          500: "#3763f0",
          600: "#2545e3",
          700: "#1f37c6",
          800: "#1f31a0",
          900: "#1f2f7e",
          950: "#141d4d",
        },
      },
    },
  },
  plugins: [],
};
