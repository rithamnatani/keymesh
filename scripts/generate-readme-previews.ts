import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");

const THEME = {
    base: "#1e1e2e",
    text: "#cdd6f4",
    muted: "#bac2de",
    surface: "#313244",
    line: "#89b4fa",
};

const FINGER_COLOR: Record<string, string> = {
    thumb: "#f9e2af",
    index: "#a6e3a1",
    middle: "#89b4fa",
    ring: "#cba6f7",
    pinky: "#f5c2e7",
    mouse: "#94e2d5",
};

type ProfileJson = {
    name: string;
    data: {
        left: { id: string; text: string; finger?: string }[];
        right: { id: string; text: string }[];
        connections: { from: string; to: string }[];
    };
};

function escapeXml(value: string): string {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function profileToSvg(profile: ProfileJson, width: number): string {
    const rowH = 22;
    const padTop = 72;
    const padBottom = 28;
    const padX = 20;
    const rows = Math.max(profile.data.left.length, profile.data.right.length);
    const height = padTop + rows * rowH + padBottom;
    const mid = width / 2;
    const leftTextX = padX + 14;
    const leftStripeX = padX;
    const rightTextX = width - padX;
    const curveStartX = padX + 160;
    const curveEndX = width - padX - 200;

    const leftIndex = new Map(profile.data.left.map((item, index) => [item.id, index]));
    const rightIndex = new Map(profile.data.right.map((item, index) => [item.id, index]));

    let body = "";

    body += `<rect width="${width}" height="${height}" fill="${THEME.base}"/>`;
    body += `<rect x="0" y="0" width="${width}" height="52" fill="#181825" opacity="0.92"/>`;
    body += `<rect x="14" y="11" width="190" height="30" rx="6" fill="${THEME.surface}" stroke="#45475a"/>`;
    body += `<text x="24" y="31" fill="${THEME.text}" font-family="Segoe UI,system-ui,sans-serif" font-size="14">${escapeXml(
        profile.name,
    )}</text>`;

    for (const connection of profile.data.connections) {
        const li = leftIndex.get(connection.from);
        const ri = rightIndex.get(connection.to);
        if (li === undefined || ri === undefined) continue;
        const y1 = padTop + li * rowH - 4;
        const y2 = padTop + ri * rowH - 4;
        body += `<path d="M ${curveStartX} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${curveEndX} ${y2}" fill="none" stroke="${
            THEME.line
        }" stroke-opacity="0.35" stroke-width="1.5"/>`;
    }

    body += `<text x="${padX + 40}" y="${padTop - 28}" fill="${THEME.muted}" font-family="Segoe UI,system-ui,sans-serif" font-size="13">Keys</text>`;
    body += `<text x="${width - padX - 40}" y="${padTop - 28}" fill="${THEME.muted}" font-family="Segoe UI,system-ui,sans-serif" font-size="13" text-anchor="end">Actions</text>`;

    profile.data.left.forEach((item, index) => {
        const y = padTop + index * rowH;
        const stripe = FINGER_COLOR[item.finger || ""] || "#45475a";
        body += `<rect x="${leftStripeX}" y="${y - 14}" width="5" height="18" rx="2" fill="${stripe}"/>`;
        body += `<text x="${leftTextX}" y="${y}" fill="${THEME.text}" font-family="Segoe UI,system-ui,sans-serif" font-size="13">${escapeXml(
            item.text,
        )}</text>`;
    });

    profile.data.right.forEach((item, index) => {
        const y = padTop + index * rowH;
        body += `<text x="${rightTextX}" y="${y}" fill="${THEME.muted}" font-family="Segoe UI,system-ui,sans-serif" font-size="13" text-anchor="end">${escapeXml(
            item.text,
        )}</text>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>` +
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
}

async function jsonToPng(relPath: string, outName: string) {
    const filePath = path.join(root, relPath);
    const raw = await Bun.file(filePath).text();
    const profile = JSON.parse(raw) as ProfileJson;
    const svg = profileToSvg(profile, 1280);
    const pngPath = path.join(root, "docs", outName);
    await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(pngPath);
    console.log(`Wrote ${pngPath}`);
}

await mkdir(path.join(root, "docs"), { recursive: true });
await jsonToPng("examples/fortnite-default.json", "readme-fortnite-default.png");
await jsonToPng("examples/fortnite-2.json", "readme-fortnite-2.png");
