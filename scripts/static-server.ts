import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolvedPublicFile(pathname: string): string | null {
    const tail = pathname === "/" || pathname === "" ? "index.html" : pathname.replace(/^\/+/, "");
    if (!tail || tail.includes("..")) return null;
    const abs = path.resolve(root, tail);
    const rel = path.relative(root, abs);
    if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
    return abs;
}

const port = Number(process.env.PORT) || 3000;

Bun.serve({
    port,
    hostname: "127.0.0.1",
    async fetch(req) {
        const url = new URL(req.url);
        const abs = resolvedPublicFile(url.pathname);
        if (!abs) return new Response("Bad path", { status: 400 });
        const file = Bun.file(abs);
        if (await file.exists()) return new Response(file);
        return new Response("Not Found", { status: 404 });
    },
});

console.log(`Serving ${root}`);
console.log(`http://127.0.0.1:${port}/`);
