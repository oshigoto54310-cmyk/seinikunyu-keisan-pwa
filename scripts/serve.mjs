import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
]);

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const relativePath = normalize(pathname.replace(/^\/+/, ""));
  let path = resolve(join(root, relativePath));
  if (path !== root && !path.startsWith(root + sep)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  if (path === root || (existsSync(path) && statSync(path).isDirectory())) path = join(path, "index.html");
  if (!existsSync(path) || !statSync(path).isFile()) {
    response.writeHead(404).end("Not found");
    return;
  }
  response.writeHead(200, { "Content-Type": mime.get(extname(path)) || "application/octet-stream", "Cache-Control": "no-cache" });
  createReadStream(path).pipe(response);
});

const port = Number(process.env.PORT || 4173);
server.listen(port, "127.0.0.1", () => console.log(`精肉 値入計算: http://127.0.0.1:${port}`));
