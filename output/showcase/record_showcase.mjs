import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium } from "playwright";

const execFileAsync = promisify(execFile);

const projectRoot = "/home/javier/Desktop/PhasePortraitVisualizer";
const outputDir = path.join(projectRoot, "output", "showcase");
const docsDir = path.join(projectRoot, "docs");
const rawTarget = path.join(outputDir, "phase_portrait_demo_cursor.webm");
const encodedTarget = path.join(outputDir, "phase_portrait_demo_cursor.mp4");
const paletteTarget = path.join(outputDir, "phase_portrait_demo_palette.png");
const finalTarget = path.join(docsDir, "phase-portrait-explorer-showcase.gif");
const chromePath = "/usr/bin/google-chrome";
const url = process.env.SHOWCASE_URL ?? "http://127.0.0.1:4183/";
const videoSize = { width: 1920, height: 1080 };
const trimStartSeconds = "0.8";
const gifFps = "20";
const gifWidth = "1920";

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(docsDir, { recursive: true });
await removeIfExists(rawTarget);
await removeIfExists(encodedTarget);
await removeIfExists(paletteTarget);
await removeIfExists(finalTarget);

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--mute-audio"]
});

const context = await browser.newContext({
  viewport: videoSize,
  recordVideo: {
    dir: outputDir,
    size: videoSize
  }
});

const page = await context.newPage();
const video = page.video();

await page.goto(url, { waitUntil: "domcontentloaded" });

await page.evaluate(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const getElement = (id) => {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Expected element #${id} to exist.`);
    }
    return element;
  };

  const existing = document.getElementById("showcase-cursor");
  if (existing) {
    existing.remove();
  }

  const cursor = document.createElement("div");
  cursor.id = "showcase-cursor";
  cursor.style.position = "fixed";
  cursor.style.left = "140px";
  cursor.style.top = "140px";
  cursor.style.width = "20px";
  cursor.style.height = "20px";
  cursor.style.borderRadius = "50%";
  cursor.style.background = "rgba(44, 68, 95, 0.94)";
  cursor.style.border = "2px solid rgba(255,255,255,0.96)";
  cursor.style.boxShadow = "0 8px 22px rgba(0,0,0,0.20)";
  cursor.style.transform = "translate(-50%, -50%) scale(1)";
  cursor.style.zIndex = "999999";
  cursor.style.pointerEvents = "none";
  document.body.append(cursor);

  let cursorX = 140;
  let cursorY = 140;

  const pulse = () => {
    const ring = document.createElement("div");
    ring.style.position = "fixed";
    ring.style.left = `${cursorX}px`;
    ring.style.top = `${cursorY}px`;
    ring.style.width = "20px";
    ring.style.height = "20px";
    ring.style.borderRadius = "50%";
    ring.style.border = "2px solid rgba(44, 68, 95, 0.52)";
    ring.style.transform = "translate(-50%, -50%) scale(0.9)";
    ring.style.transformOrigin = "center";
    ring.style.opacity = "0.84";
    ring.style.zIndex = "999998";
    ring.style.pointerEvents = "none";
    ring.style.transition = "transform 420ms ease, opacity 420ms ease";
    document.body.append(ring);
    requestAnimationFrame(() => {
      ring.style.transform = "translate(-50%, -50%) scale(2.15)";
      ring.style.opacity = "0";
    });
    setTimeout(() => ring.remove(), 460);
  };

  const moveCursorTo = async (x, y, duration = 440) => {
    const startX = cursorX;
    const startY = cursorY;
    const start = performance.now();

    await new Promise((resolve) => {
      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        cursorX = startX + (x - startX) * eased;
        cursorY = startY + (y - startY) * eased;
        cursor.style.left = `${cursorX}px`;
        cursor.style.top = `${cursorY}px`;

        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  };

  const clickAt = async (x, y, target, waitAfter = 180) => {
    await moveCursorTo(x, y, 430);
    cursor.style.transform = "translate(-50%, -50%) scale(0.88)";
    pulse();
    target.dispatchEvent(
      new MouseEvent("click", {
        clientX: x,
        clientY: y,
        bubbles: true
      })
    );
    await sleep(100);
    cursor.style.transform = "translate(-50%, -50%) scale(1)";
    await sleep(waitAfter);
  };

  const centerOf = (element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  };

  const clickModelPoint = async (xValue, yValue, waitAfter = 520) => {
    const svg = getElement("portrait-plot");
    const frame = svg.querySelector('[data-layer="grid"] rect');
    if (!(frame instanceof SVGRectElement)) {
      throw new Error("Expected the plot frame rect to exist.");
    }

    const xMin = Number(getElement("x-min-input").value);
    const xMax = Number(getElement("x-max-input").value);
    const yMin = Number(getElement("y-min-input").value);
    const yMax = Number(getElement("y-max-input").value);
    const innerLeft = Number(frame.getAttribute("x"));
    const innerTop = Number(frame.getAttribute("y"));
    const innerWidth = Number(frame.getAttribute("width"));
    const innerHeight = Number(frame.getAttribute("height"));

    const x = innerLeft + ((xValue - xMin) / (xMax - xMin)) * innerWidth;
    const y = innerTop + ((yMax - yValue) / (yMax - yMin)) * innerHeight;
    const point = svg.createSVGPoint();
    point.x = x;
    point.y = y;
    const mapped = point.matrixTransform(svg.getScreenCTM());

    await clickAt(mapped.x, mapped.y, svg, 120);
    await sleep(waitAfter);
  };

  const typeInto = async (element, text, delay = 58) => {
    const rect = element.getBoundingClientRect();
    const clickPoint = {
      x: rect.left + 120,
      y: rect.top + Math.min(rect.height / 2, 34)
    };

    await clickAt(clickPoint.x, clickPoint.y, element, 120);
    element.focus();
    element.value = "";
    element.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(140);
    await moveCursorTo(rect.right + 36, rect.top + 18, 180);

    for (const character of text) {
      element.value += character;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(delay);
    }
  };

  const selectExample = async (value, waitAfter = 1800) => {
    const select = getElement("example-select");
    const center = centerOf(select);
    await clickAt(center.x, center.y, select, 120);
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(waitAfter);
  };

  await sleep(420);

  await clickModelPoint(-2.2, 1.9, 560);
  await clickModelPoint(-1.55, -0.75, 560);
  await clickModelPoint(1.6, 1.1, 640);

  await sleep(260);

  await clickAt(
    ...Object.values(centerOf(getElement("clear-curves-button"))),
    getElement("clear-curves-button"),
    200
  );
  await sleep(240);

  await typeInto(getElement("x-equation-input"), "y", 68);
  await sleep(160);
  await typeInto(getElement("y-equation-input"), "-x - 0.5 * y", 56);
  await sleep(520);

  await clickAt(...Object.values(centerOf(getElement("seed-ring-button"))), getElement("seed-ring-button"), 180);
  await sleep(1900);

  await selectExample("stable-node", 1900);
  await selectExample("limit-cycle", 2600);

  await sleep(520);
  cursor.remove();
});

await context.close();
await browser.close();

const rawPath = await video.path();
if (rawPath !== rawTarget) {
  await removeIfExists(rawTarget);
  await fs.rename(rawPath, rawTarget);
}

await execFileAsync("ffmpeg", [
  "-y",
  "-ss",
  trimStartSeconds,
  "-i",
  rawTarget,
  "-an",
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  encodedTarget
]);

await execFileAsync("ffmpeg", [
  "-y",
  "-i",
  encodedTarget,
  "-vf",
  `fps=${gifFps},scale=${gifWidth}:-1:flags=lanczos,palettegen=stats_mode=diff`,
  paletteTarget
]);

await execFileAsync("ffmpeg", [
  "-y",
  "-i",
  encodedTarget,
  "-i",
  paletteTarget,
  "-lavfi",
  `fps=${gifFps},scale=${gifWidth}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a:diff_mode=rectangle`,
  finalTarget
]);

await removeIfExists(rawTarget);
await removeIfExists(encodedTarget);
await removeIfExists(paletteTarget);

console.log(`Saved ${finalTarget}`);

async function removeIfExists(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}
