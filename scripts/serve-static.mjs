import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const root = join(process.cwd(), "dist");
const port = Number(process.env.PORT || 4173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const clean = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  return clean === "/" ? "/index.html" : clean;
}

function send(res, file, status = 200) {
  res.writeHead(status, {
    "Content-Type": types[extname(file).toLowerCase()] || "application/octet-stream",
    "Cache-Control": extname(file) === ".html" ? "no-store" : "public, max-age=31536000, immutable",
  });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  const requested = safePath(req.url || "/");

  let file = join(root, requested);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (existsSync(file) && statSync(file).isFile()) return send(res, file);

  // SPA fallback — all unknown routes go to the React app.
  return send(res, join(root, "index.html"));
}).listen(port, "0.0.0.0", () => {
  console.log(`EcoBus static server listening on ${port}`);
});
