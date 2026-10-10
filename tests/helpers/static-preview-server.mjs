// Test-only static hosting: no preview logic or custom preview response headers.
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { copyFile, readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const deployments = [
  { name: "project", port: 4179, base: "/brokenbuckaroos.se/" },
  { name: "root", port: 4180, base: "/" },
];
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".woff": "font/woff", ".woff2": "font/woff2" };
for (const deployment of deployments) {
  const directory = resolve("dist-preview-tests", deployment.name);
  execFileSync(process.execPath, ["node_modules/vite/bin/vite.js", "build", "--outDir", directory, "--base", deployment.base], {
    stdio: "inherit",
    env: { ...process.env, VITE_SITE_URL: "", VITE_CMS_URL: "https://cms.preview.test", VITE_CMS_SITE_KEY: "broken-buckaroos" },
  });
  await copyFile(resolve(directory, "index.html"), resolve(directory, "404.html"));
  const fallback = await readFile(resolve(directory, "404.html"));
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, `http://127.0.0.1:${deployment.port}`).pathname;
    if (pathname === "/health") { response.end("Ready"); return; }
    if (!pathname.startsWith(deployment.base)) { response.writeHead(404); response.end("Not found"); return; }
    const filename = resolve(directory, pathname.slice(deployment.base.length) || "index.html");
    if (filename !== directory && !filename.startsWith(`${directory}${sep}`)) { response.writeHead(404); response.end(); return; }
    try {
      if (!(await stat(filename)).isFile()) throw new Error("Missing file");
      response.writeHead(200, { "Content-Type": types[extname(filename)] || "application/octet-stream", "Cache-Control": "public, max-age=3600" });
      response.end(await readFile(filename));
    } catch {
      // Matches GitHub Pages: serve the app shell in place, still with HTTP 404.
      response.writeHead(404, { "Content-Type": "text/html", "Cache-Control": "public, max-age=3600" });
      response.end(fallback);
    }
  });
  server.listen(deployment.port, "127.0.0.1");
  process.on("SIGTERM", () => server.close());
}
