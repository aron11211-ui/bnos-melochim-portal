import { copyFile, mkdir, writeFile } from "node:fs/promises";

const worker = `const htmlHeaders = {
  "cache-control": "no-store",
  "content-type": "text/html; charset=utf-8",
};

function wantsHtml(request) {
  const accept = request.headers.get("accept") || "";
  return request.method === "GET" && accept.includes("text/html");
}

async function serveIndex(request, env) {
  const indexUrl = new URL("/index.html", request.url);
  const indexRequest = new Request(indexUrl, request);
  const response = await env.ASSETS.fetch(indexRequest);
  return new Response(response.body, {
    status: response.status,
    headers: htmlHeaders,
  });
}

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);

    if (response.status !== 404) {
      return response;
    }

    if (wantsHtml(request)) {
      return serveIndex(request, env);
    }

    return response;
  },
};
`;

await mkdir("dist/server", { recursive: true });
await writeFile("dist/server/index.js", worker);
await mkdir("dist/.openai", { recursive: true });
await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
