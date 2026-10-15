import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite"; // Add this

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()], // Add tailwindcss plugin here
});
