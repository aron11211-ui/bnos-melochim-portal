import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

function contentType(path) {
  switch (extname(path)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".svg":
      return "image/svg+xml; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

const files = {
  "/": await readFile("dist/index.html", "utf8"),
  "/index.html": await readFile("dist/index.html", "utf8"),
};

for (const file of await readdir("dist/assets")) {
  files[`/assets/${file}`] = await readFile(join("dist/assets", file), "utf8");
}

for (const file of ["favicon.svg", "icons.svg"]) {
  files[`/${file}`] = await readFile(join("dist", file), "utf8");
}

const worker = `const files = ${JSON.stringify(files)};

function contentType(path) {
  if (path.endsWith(".html") || path === "/") return "text/html; charset=utf-8";
  if (path.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml; charset=utf-8";
  return "application/octet-stream";
}

function responseFor(path) {
  const body = files[path];
  if (body == null) return undefined;
  return new Response(body, {
    headers: {
      "content-type": contentType(path),
      "cache-control": path === "/" || path.endsWith(".html") ? "no-store" : "public, max-age=31536000, immutable",
    },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const direct = responseFor(url.pathname);
    if (direct) return direct;

    if (request.method === "GET" && (request.headers.get("accept") || "").includes("text/html")) {
      return responseFor("/") || new Response("Not found", { status: 404 });
    }

    return new Response("Not found", { status: 404 });
  },
};
`;

await mkdir("dist/server", { recursive: true });
await writeFile("dist/server/index.js", worker);
await mkdir("dist/.openai", { recursive: true });
await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
