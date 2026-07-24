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
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
}

const files = {};

async function addFile(route, filePath) {
  files[route] = {
    body: (await readFile(filePath)).toString("base64"),
    type: contentType(route),
  };
}

await addFile("/", "dist/index.html");
await addFile("/index.html", "dist/index.html");

for (const file of await readdir("dist/assets")) {
  await addFile(`/assets/${file}`, join("dist/assets", file));
}

for (const entry of await readdir("dist", { withFileTypes: true })) {
  if (entry.isFile() && entry.name !== "index.html") {
    await addFile(`/${entry.name}`, join("dist", entry.name));
  }
}

const worker = `const files = ${JSON.stringify(files)};

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function responseFor(path) {
  const file = files[path];
  if (file == null) return undefined;
  return new Response(decodeBase64(file.body), {
    headers: {
      "content-type": file.type,
      "cache-control": path === "/" || path.endsWith(".html") ? "no-store" : "public, max-age=31536000, immutable",
    },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const direct = responseFor(url.pathname);
    if (direct) return direct;

    const acceptsHtml = (request.headers.get("accept") || "").includes("text/html");
    const looksLikeAppRoute = !url.pathname.split("/").pop()?.includes(".");

    if (request.method === "GET" && (acceptsHtml || looksLikeAppRoute)) {
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
