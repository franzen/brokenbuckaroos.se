import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/brokenbuckaroos.se/",
  plugins: [react()],
  build: { target: "es2020" },
});
