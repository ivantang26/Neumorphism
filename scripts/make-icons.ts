// Render the app icons (PWA manifest, apple-touch-icon) from one SVG.
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";

const mark = (pad: number) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="#e4e9f0"/>
  <g transform="translate(256 256) scale(${pad ? 0.62 : 0.78}) translate(-256 -256)">
    <circle cx="256" cy="256" r="220" fill="#e4e9f0" stroke="#6f7a8e" stroke-width="10"/>
    <path d="M 131 381 A 177 177 0 1 1 381 381" fill="none" stroke="#d3dae4" stroke-width="56" stroke-linecap="round"/>
    <path d="M 131 381 A 177 177 0 0 1 344 102" fill="none" stroke="#c2410c" stroke-width="56" stroke-linecap="round"/>
    <circle cx="256" cy="256" r="74" fill="#2a3342"/>
  </g>
</svg>`;

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon.svg", mark(0).trim());
await sharp(Buffer.from(mark(0))).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(Buffer.from(mark(0))).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(Buffer.from(mark(1))).resize(512, 512).png().toFile("public/icons/icon-maskable-512.png");
console.log("Icons written to public/icons/");
