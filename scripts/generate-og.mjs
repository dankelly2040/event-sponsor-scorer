import { createCanvas, registerFont } from "canvas";
import { writeFileSync } from "fs";

const W = 1200;
const H = 630;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");

// Use a font the canvas library actually has
const FONT = "Helvetica, Arial, sans-serif";
const FONT_BOLD = `bold`;

// Background
ctx.fillStyle = "#ffffff";
ctx.fillRect(0, 0, W, H);

// Event names scattered around the edges
const events = [
  // Left column
  { name: "SaaStr", x: 60, y: 80, size: 32 },
  { name: "SXSW", x: 50, y: 135, size: 26 },
  { name: "Dreamforce", x: 70, y: 185, size: 28 },
  { name: "Chain React", x: 55, y: 240, size: 24 },
  { name: "Google I/O", x: 60, y: 300, size: 30 },
  { name: "AWS re:Invent", x: 45, y: 365, size: 22 },
  { name: "CES", x: 75, y: 420, size: 36 },
  { name: "Web Summit", x: 55, y: 480, size: 24 },
  { name: "React Summit", x: 60, y: 535, size: 26 },
  { name: "KubeCon", x: 70, y: 585, size: 22 },
  // Right column
  { name: "Web Summit", x: 890, y: 75, size: 34 },
  { name: "SaaStr", x: 940, y: 130, size: 24 },
  { name: "AWS re:Invent", x: 870, y: 180, size: 28 },
  { name: "Google I/O", x: 910, y: 235, size: 22 },
  { name: "SXSW", x: 950, y: 290, size: 36 },
  { name: "React Summit", x: 880, y: 350, size: 24 },
  { name: "KubeCon", x: 910, y: 405, size: 28 },
  { name: "Dreamforce", x: 870, y: 460, size: 22 },
  { name: "App.js Conf", x: 890, y: 515, size: 26 },
  { name: "Chain React", x: 910, y: 570, size: 24 },
  // Extra scattered
  { name: "App.js Conf", x: 130, y: 145, size: 20 },
  { name: "CES", x: 980, y: 475, size: 20 },
];

// Draw event names with low opacity
for (const e of events) {
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.font = `${FONT_BOLD} ${e.size}px ${FONT}`;
  ctx.fillStyle = "#000000";
  ctx.fillText(e.name, e.x, e.y);
  ctx.restore();
}

// White gradient fade from center to make headline pop
// Draw a radial-ish white overlay in the center
ctx.save();
const gradient = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, 380);
gradient.addColorStop(0, "rgba(255,255,255,1)");
gradient.addColorStop(0.6, "rgba(255,255,255,0.95)");
gradient.addColorStop(1, "rgba(255,255,255,0)");
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, W, H);
ctx.restore();

// Center text
ctx.textAlign = "center";
ctx.textBaseline = "middle";

// Main headline
ctx.font = `${FONT_BOLD} 86px ${FONT}`;
ctx.fillStyle = "#111111";
ctx.fillText("Sponsor or nah?", W / 2, H / 2 - 10);

// Subtitle
ctx.font = `400 24px ${FONT}`;
ctx.fillStyle = "#999999";
ctx.fillText("Score any event in seconds", W / 2, H / 2 + 48);

// Badge pill above headline
const badgeText = "Sponsor Score";
ctx.font = `500 15px ${FONT}`;
const bm = ctx.measureText(badgeText);
const bw = bm.width + 32;
const bh = 30;
const bx = (W - bw) / 2;
const by = H / 2 - 80;
const br = 15;

ctx.fillStyle = "#f0f0f0";
ctx.beginPath();
ctx.moveTo(bx + br, by);
ctx.lineTo(bx + bw - br, by);
ctx.arcTo(bx + bw, by, bx + bw, by + br, br);
ctx.lineTo(bx + bw, by + bh - br);
ctx.arcTo(bx + bw, by + bh, bx + bw - br, by + bh, br);
ctx.lineTo(bx + br, by + bh);
ctx.arcTo(bx, by + bh, bx, by + bh - br, br);
ctx.lineTo(bx, by + br);
ctx.arcTo(bx, by, bx + br, by, br);
ctx.closePath();
ctx.fill();

ctx.fillStyle = "#555555";
ctx.font = `500 15px ${FONT}`;
ctx.fillText(badgeText, W / 2, by + bh / 2 + 1);

// Export
const buffer = canvas.toBuffer("image/png");
writeFileSync("assets/og-image.png", buffer);
console.log("Created assets/og-image.png (1200x630)");
