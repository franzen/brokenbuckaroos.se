import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const siteUrl = process.env.VITE_SITE_URL || env.VITE_SITE_URL;
  const base = siteUrl ? `${new URL(siteUrl).pathname.replace(/\/+$/, "")}/` : "/brokenbuckaroos.se/";
  return {
    base,
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL(".", import.meta.url)),
      },
    },
    build: { target: "es2020" },
  };
});
