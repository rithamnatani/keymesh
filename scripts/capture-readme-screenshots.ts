/**
 * Optional: pixel-accurate PNGs from the live UI.
 * Requires Chromium (e.g. `bun x playwright install chromium`).
 * Prefer `bun run readme-previews` when browser launch is blocked (CI/sandbox).
 */
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const outDir = path.join(root, "docs");

function resolvedPublicFile(pathname: string): string | null {
    const tail = pathname === "/" || pathname === "" ? "index.html" : pathname.replace(/^\/+/, "");
    if (!tail || tail.includes("..")) return null;
    const abs = path.resolve(root, tail);
    const rel = path.relative(root, abs);
    if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
    return abs;
}

const server = Bun.serve({
    port: 0,
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

const base = `http://${server.hostname}:${server.port}`;

try {
    await mkdir(outDir, { recursive: true });

    const browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(60_000);
    page.setDefaultTimeout(60_000);

    await page.goto(`${base}/`, { waitUntil: "load" });
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${base}/`, { waitUntil: "load" });

    await page.waitForFunction(() => {
        const select = document.querySelector("#profile-select");
        return select instanceof HTMLSelectElement && select.options.length >= 2;
    });

    await page.selectOption("#profile-select", { index: 0 });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({
        path: path.join(outDir, "readme-fortnite-default.png"),
        fullPage: true,
    });

    await page.selectOption("#profile-select", { index: 1 });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({
        path: path.join(outDir, "readme-fortnite-2.png"),
        fullPage: true,
    });

    await browser.close();

    console.log(`Wrote ${path.join(outDir, "readme-fortnite-default.png")}`);
    console.log(`Wrote ${path.join(outDir, "readme-fortnite-2.png")}`);
} finally {
    server.stop();
}
