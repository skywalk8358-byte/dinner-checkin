/**
 * 把整個 app 打包成單一自足的 HTML（demo/dinner-air-demo.html）：
 * - esbuild 打包 React app，next/link、next/navigation 換成 hash 路由 shim
 * - qr-scanner 換成替身（沙箱環境沒有相機）
 * - Tailwind CLI 產出 CSS，全部 inline 進同一個檔案
 *
 * 用途：丟到 Claude Artifact 或任何靜態空間，單檔即可互動展示。
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = resolve(root, "demo");
mkdirSync(outDir, { recursive: true });

// 1) JS bundle
const result = await esbuild.build({
  entryPoints: [resolve(root, "scripts/demo/entry.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  write: false,
  tsconfig: resolve(root, "tsconfig.json"),
  alias: {
    "next/link": resolve(root, "scripts/demo/next-link.tsx"),
    "next/navigation": resolve(root, "scripts/demo/next-navigation.tsx"),
    "qr-scanner": resolve(root, "scripts/demo/qr-scanner-stub.ts"),
  },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_ADMIN_CODE": "undefined",
  },
});
// inline <script> 安全處理：字串裡的 </script> 會提早關閉標籤
const js = result.outputFiles[0].text.replaceAll("</script", "<\\/script");

// 2) CSS（Tailwind v4 CLI 會自動掃描專案原始碼）
execSync("npx @tailwindcss/cli -i src/app/globals.css -o demo/demo.css --minify", {
  cwd: root,
  stdio: "inherit",
});
const css = readFileSync(resolve(outDir, "demo.css"), "utf8");

// 3) 組出單一 HTML（不含 doctype/head/body，交給宿主頁面包）
const html = `<title>Dinner Air — 聚餐報名 Demo</title>
<style>${css}</style>
<div id="root"></div>
<script>${js}</script>
`;
const outFile = resolve(outDir, "dinner-air-demo.html");
writeFileSync(outFile, html);
console.log(`✓ ${outFile} (${Math.round(html.length / 1024)} KB)`);

// 同步一份到 docs/index.html —— GitHub Pages（Deploy from branch → /docs）直接對外服務
const pagesFile = resolve(root, "docs/index.html");
const pagesHtml = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#f2f2f7">
<title>Dinner Air ✈ 聚餐報名</title>
<style>${css}</style>
</head>
<body class="antialiased">
<div id="root"></div>
<script>${js}</script>
</body>
</html>
`;
writeFileSync(pagesFile, pagesHtml);
console.log(`✓ ${pagesFile} (${Math.round(pagesHtml.length / 1024)} KB)`);
