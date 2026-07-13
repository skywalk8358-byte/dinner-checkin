/**
 * 冒煙測試：跑完「看板 → 報名 → 選位 → 登機證 → 後台名單 → 登機口報到」全流程。
 * 先啟動 server（npm run dev 或 npm run build && npm run start），再執行 npm run smoke。
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const OUT = resolve(process.env.SHOT_DIR ?? "smoke-shots") + "/";
mkdirSync(OUT, { recursive: true });

const fail = (msg) => {
  console.error("✗ FAIL:", msg);
  process.exitCode = 1;
};

async function launch() {
  try {
    return await chromium.launch();
  } catch {
    return await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  }
}

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("pageerror", (e) => fail(`page error: ${e.message}`));

// 1. 出發看板
await page.goto(BASE + "/");
await page.waitForTimeout(2200); // 等翻牌動畫定格
await page.screenshot({ path: OUT + "01-departures.png", fullPage: true });
if (!(await page.getByText("DN-0808").first().isVisible())) fail("departures board missing DN-0808");
console.log("✓ departures board");

// 2. 航班頁
await page.getByText("DN-0808").first().click();
await page.waitForURL("**/flight/DN-0808");
await page.waitForTimeout(2200);
await page.screenshot({ path: OUT + "02-flight.png", fullPage: true });
if (!(await page.getByText("CHECK IN · 開始報名").isVisible())) fail("flight page missing check-in CTA");
console.log("✓ flight page");

// 3. 報名表單
await page.getByText("CHECK IN · 開始報名").click();
await page.waitForURL("**/checkin");
await page.getByPlaceholder("王小明").fill("林小美");
await page.getByPlaceholder("研發部").fill("設計部");
await page.getByText("素食餐").click();
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT + "03-checkin-form.png", fullPage: true });
await page.getByText("NEXT · 前往選位").click();
console.log("✓ check-in form");

// 4. 選位（挑第 5 桌 A 位）
await page.waitForURL("**/seat");
await page.waitForTimeout(1500);
const seat5A = page.locator("g").filter({ has: page.locator("title", { hasText: /^座位 5A$/ }) });
await seat5A.click();
await page.waitForTimeout(800);
await page.screenshot({ path: OUT + "04-seatmap.png", fullPage: true });
await page.getByText("CONFIRM · 確認選位").click();
console.log("✓ seat selection");

// 5. 登機證
await page.waitForURL("**/pass/**");
await page.waitForTimeout(1800);
await page.screenshot({ path: OUT + "05-boarding-pass.png", fullPage: true });
const passUrl = page.url();
if (!(await page.getByText("林小美").first().isVisible())) fail("pass missing passenger name");
if (!(await page.locator(".ticket").getByText("5A").first().isVisible())) fail("pass missing seat 5A");
console.log("✓ boarding pass:", passUrl);

// 手機尺寸的登機證
const mobile = await ctx.newPage();
await mobile.setViewportSize({ width: 390, height: 844 });
await mobile.goto(passUrl);
await mobile.waitForTimeout(1500);
await mobile.screenshot({ path: OUT + "06-pass-mobile.png", fullPage: true });
await mobile.close();
console.log("✓ mobile pass");

// 6. 後台（通關碼 0815）→ 乘客名單
await page.goto(BASE + "/admin/DN-0808");
await page.getByPlaceholder("••••").fill("0815");
await page.getByText("UNLOCK 解鎖").click();
await page.waitForTimeout(2000);
await page.screenshot({ path: OUT + "07-manifest.png", fullPage: true });
if (!(await page.getByText("林小美").first().isVisible())) fail("manifest missing new attendee");
console.log("✓ manifest");

// 7. 登機口：手動幫林小美報到
await page.goto(BASE + "/admin/DN-0808/boarding");
await page.waitForTimeout(1500);
await page.getByPlaceholder(/搜尋姓名/).fill("林小美");
await page.waitForTimeout(400);
await page.locator("button", { hasText: /^報到$/ }).first().click();
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT + "08-boarding-gate.png", fullPage: true });
console.log("✓ boarding gate manual check-in");

// 8. 報到後的登機證要蓋 BOARDED 章
await page.goto(passUrl);
await page.waitForTimeout(1800);
await page.screenshot({ path: OUT + "09-pass-boarded.png", fullPage: true });
if (!(await page.getByText("BOARDED").first().isVisible())) fail("pass missing BOARDED stamp");
console.log("✓ boarded stamp");

await browser.close();
console.log(process.exitCode ? "SMOKE TEST FAILED" : "ALL SMOKE TESTS PASSED");
