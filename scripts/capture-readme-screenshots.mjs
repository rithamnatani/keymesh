/**
 * README screenshots using the real browser UI (Playwright).
 * Run with Node (not Bun): Playwright relies on Node child_process behavior.
 *
 *   npm install
 *   npx playwright install chromium
 *   npm run screenshots
 *
 * If bundled Chromium fails on Windows, install Microsoft Edge or Chrome — this script tries channel: msedge / chrome automatically.
 */
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "docs");

function resolvedPublicFile(pathname) {
    const tail = pathname === "/" || pathname === "" ? "index.html" : pathname.replace(/^\/+/, "");
    if (!tail || tail.includes("..")) return null;
    const abs = path.resolve(root, tail);
    const rel = path.relative(root, abs);
    if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
    return abs;
}

function contentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const map = {
        ".html": "text/html; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".png": "image/png",
        ".ico": "image/x-icon",
        ".svg": "image/svg+xml",
    };
    return map[ext] || "application/octet-stream";
}

const server = http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url || "/", "http://127.0.0.1");
        const abs = resolvedPublicFile(url.pathname);
        if (!abs) {
            res.writeHead(400);
            res.end();
            return;
        }
        const data = await fs.readFile(abs);
        res.writeHead(200, { "Content-Type": contentType(abs) });
        res.end(data);
    } catch {
        res.writeHead(404);
        res.end();
    }
});

await new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", (err) => (err ? reject(err) : resolve()));
});

const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const launchArgs = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"];

async function launchBrowser() {
    const tries = [
        {
            name: "Playwright Chromium",
            options: { headless: true, args: launchArgs },
        },
        ...(process.platform === "win32"
            ? [
                  { name: "Microsoft Edge (system)", options: { channel: "msedge", headless: true, args: launchArgs } },
                  { name: "Google Chrome (system)", options: { channel: "chrome", headless: true, args: launchArgs } },
              ]
            : []),
        {
            name: "Chromium (shell headless)",
            options: { headless: "shell", args: launchArgs },
        },
    ];

    let lastErr;
    for (const { name, options } of tries) {
        try {
            const browser = await chromium.launch(options);
            console.error(`Using browser: ${name}`);
            return browser;
        } catch (e) {
            lastErr = e;
            console.error(`${name} failed: ${e?.message || e}`);
        }
    }
    throw new Error(
        lastErr?.message ||
            "Could not launch a browser. Try: npx playwright install chromium\n" +
                "Or install Microsoft Edge / Google Chrome for channel fallback.",
    );
}

try {
    await fs.mkdir(outDir, { recursive: true });

    const browser = await launchBrowser();
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(90_000);
    page.setDefaultTimeout(90_000);

    await page.goto(`${base}/`, { waitUntil: "load" });
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${base}/`, { waitUntil: "networkidle" });

    await page.waitForFunction(() => {
        const select = document.querySelector("#profile-select");
        return select instanceof HTMLSelectElement && select.options.length >= 2;
    });

    await page.selectOption("#profile-select", { index: 0 });
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({
        path: path.join(outDir, "readme-fortnite-default.png"),
        fullPage: true,
    });

    await page.selectOption("#profile-select", { index: 1 });
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({
        path: path.join(outDir, "readme-fortnite-2.png"),
        fullPage: true,
    });

    await browser.close();

    console.log(`Wrote ${path.join(outDir, "readme-fortnite-default.png")}`);
    console.log(`Wrote ${path.join(outDir, "readme-fortnite-2.png")}`);
} finally {
    server.close();
}
