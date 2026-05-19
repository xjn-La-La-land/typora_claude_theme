# HTML 增强实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Claude-like Typora 主题在 HTML 导出场景下添加浏览器端增强：左侧浮动 TOC（带章节高亮）、代码块复制按钮 + 行号、图片 lightbox + caption、脚注 hover popover、light/grey/dark 主题切换器。

**Architecture:** 用户把构建产物 `dist/claude-like-plugin.html` 粘贴到 Typora 的「导出设置 ▸ HTML ▸ 在 `<head/>` 中添加」字段。该文件内嵌一组 `<style>` 与 `<script>` —— 加载到导出 HTML 时，JS 扫描 Typora 渲染的 DOM 并注入控件。SCSS 端做 mixin 重构，让三套色板既能作为 `:root`（Typora 编辑器场景），也能作为 `html[data-theme="..."]`（导出 HTML 场景）。

**Tech Stack:** vanilla ES Modules（不引框架），esbuild 0.21+（JS bundler），sass 1.77+（已装），Node.js 20+ ESM 脚本。

**Source spec:** `docs/specs/2026-05-19-html-enhancement-design.md`

---

## 文件结构

### 新增文件

```
scss/
├── _palettes.scss              # 三套色值 mixin (light/grey/dark)
└── plugin.scss                 # html[data-theme] 变体 + 控件 CSS
js/
├── _bootstrap.js               # DOMContentLoaded 入口 + 模块协调
├── toc.js                      # 浮动 TOC + IntersectionObserver
├── code-enhance.js             # 复制按钮 + 行号
├── image-lightbox.js           # 点击放大 + caption
├── footnote.js                 # hover popover
└── theme-switcher.js           # data-theme 切换 + localStorage
plugin/
└── template.html               # <head/> 模板,含 {{PLUGIN_CSS}}/{{PLUGIN_JS}}/{{VERSION}}
scripts/
└── build-plugin.mjs            # SCSS+JS 合并,inline 进 template,产 dist/claude-like-plugin.html
test/
├── sample.md                   # 覆盖所有特性的测试 markdown
└── CHECKLIST.md                # 每次手测的对照清单
docs/plans/
└── 2026-05-19-html-enhancement-implementation.md  # 本文件
LICENSE-VLOOK                   # VLOOK 仓库 LICENSE 逐字拷贝
```

### 修改文件

```
scss/claude-like.scss           # 重构:用 @include palettes.light
scss/claude-like-grey.scss      # 同上
scss/claude-like-dark.scss      # 同上
package.json                    # 加 build:plugin/watch:plugin 脚本 + esbuild 依赖
.gitignore                      # 加 dist/
.github/workflows/sync-css.yml  # 重命名/扩展为 build.yml,处理 JS+SCSS+plugin
README.md                       # 新增安装步骤 + Acknowledgments 章节
```

### 不动的文件

```
claude-like.css                 # 由 SCSS 重建,但内容 byte-identical（Task 1 验证）
claude-like-grey.css
claude-like-dark.css
scss/_base.scss
.github/workflows/release-latest.yml
LICENSE
```

---

## Pre-flight

执行前确认：

- [ ] Node.js 20+ 已安装：`node --version`
- [ ] 当前工作目录 = 仓库根目录：`pwd` 应输出 `.../Typora_Claude-Like_Theme`
- [ ] 工作树干净：`git status --short` 无 staged 改动
- [ ] 当前 branch = master 或专门的 feature branch
- [ ] `npm install` 已跑过（`node_modules/` 存在）

---

## Task 1: SCSS 色板 mixin 重构（idempotent 重构）

**目标:** 把三套调色板从单文件 `:root { ... }` 抽到共享 mixin。重构必须**byte-identical** 输出现有 CSS，证明无功能变化。

**Files:**
- Create: `scss/_palettes.scss`
- Modify: `scss/claude-like.scss`、`scss/claude-like-grey.scss`、`scss/claude-like-dark.scss`

- [ ] **Step 1: 保存当前编译产物作为黄金参考**

```bash
mkdir -p /tmp/css-golden
cp claude-like.css /tmp/css-golden/light.css
cp claude-like-grey.css /tmp/css-golden/grey.css
cp claude-like-dark.css /tmp/css-golden/dark.css
```

预期：三个文件已拷到 `/tmp/css-golden/`。

- [ ] **Step 2: 创建 `scss/_palettes.scss`**

把当前三个 `.scss` 文件 `:root` 块里的所有 `--xxx: value;` 一行不漏地抽到三个 mixin 里。具体方法：

```bash
# 用脚本辅助提取(确保不漏)
grep -E "^\s+--" scss/claude-like.scss > /tmp/light-vars.txt
grep -E "^\s+--" scss/claude-like-grey.scss > /tmp/grey-vars.txt
grep -E "^\s+--" scss/claude-like-dark.scss > /tmp/dark-vars.txt
wc -l /tmp/light-vars.txt /tmp/grey-vars.txt /tmp/dark-vars.txt
```

预期：三个文件行数应相等（变量名应该完全对应）。如果不等说明三个主题变量未对齐，先修这个。

然后写 `scss/_palettes.scss`：

```scss
// Three palette mixins. Each variable must exist in all three with semantically equivalent role.

@mixin light {
    // ----- Surfaces -----
    --bg-color: #faf9f5;
    --window-bg-color: #f6f3ed;
    --side-bar-bg-color: #f5f2ec;

    // ----- Text -----
    --text-color: #2b2621;
    --heading-color: #1c1815;
    --control-text-color: #72695e;
    --select-text-bg-color: #e8ddd0;

    // (注意：此处省略示意,实际填入当前 claude-like.scss :root 块里的全部变量,
    //  按相同分节注释。下同。)
}

@mixin grey {
    // ... 从 claude-like-grey.scss :root 全部搬过来 ...
}

@mixin dark {
    // ... 从 claude-like-dark.scss :root 全部搬过来 ...
}
```

**重要：** 不要凭印象抄；用 `cat scss/claude-like.scss` 等命令读完整内容，按原顺序原值原注释复制。

- [ ] **Step 3: 重构三个主题入口文件**

`scss/claude-like.scss` 重写为：

```scss
// Claude-like — Light variant
// Entry point: applies the light palette via shared mixin and pulls in shared structural styles.

@use 'palettes';
@use 'base';

:root {
    @include palettes.light;
}
```

`scss/claude-like-grey.scss` 重写为：

```scss
// Claude-like — Grey variant

@use 'palettes';
@use 'base';

:root {
    @include palettes.grey;
}
```

`scss/claude-like-dark.scss` 重写为：

```scss
// Claude-like — Dark variant

@use 'palettes';
@use 'base';

:root {
    @include palettes.dark;
}
```

- [ ] **Step 4: 重新编译**

```bash
npm run build
```

预期：sass 命令成功（exit 0），无 warning。三个 `.css` 文件被重写。

- [ ] **Step 5: 验证产物 byte-identical（这是本任务的"测试"）**

```bash
diff /tmp/css-golden/light.css claude-like.css
diff /tmp/css-golden/grey.css claude-like-grey.css
diff /tmp/css-golden/dark.css claude-like-dark.css
echo "exit: $?"
```

预期：三个 diff 均无输出，最后 exit 0。

**如果有差异**：先看 diff 内容；常见原因是 mixin 里漏抄了一个变量，或顺序错。修 `_palettes.scss` 直到三个 diff 都干净。

- [ ] **Step 6: 清理临时文件并提交**

```bash
rm -rf /tmp/css-golden /tmp/light-vars.txt /tmp/grey-vars.txt /tmp/dark-vars.txt
git add scss/_palettes.scss scss/claude-like.scss scss/claude-like-grey.scss scss/claude-like-dark.scss
git commit -m "refactor(scss): 抽出 _palettes.scss mixin,色板成为 single source of truth"
```

预期：commit 创建。CSS 文件**不** stage（它们 byte-identical，不该出现在 diff 里）。

---

## Task 2: 构建基础设施

**目标:** 引入 esbuild 依赖，写最小的 `scripts/build-plugin.mjs` 能产出占位版 `dist/claude-like-plugin.html`，并更新 `package.json` 与 `.gitignore`。

**Files:**
- Create: `scripts/build-plugin.mjs`、`plugin/template.html`
- Modify: `package.json`、`.gitignore`

- [ ] **Step 1: 安装 esbuild**

```bash
npm install --save-dev esbuild
```

预期：`package.json` 的 `devDependencies` 多了 `esbuild`，`package-lock.json` 更新。

- [ ] **Step 2: 写 `plugin/template.html`**

```html
<!--
##### plugin for <head /> #####
Claude-Like Typora Theme — HTML enhancement plugin v{{VERSION}}
Paste this entire file into "Export Setting ▸ HTML ▸ Append in <head />"
-->

<style id="claude-plugin-styles">
{{PLUGIN_CSS}}
</style>

<script id="claude-plugin-script">
{{PLUGIN_JS}}
</script>
```

**注意：** `{{PLUGIN_CSS}}`、`{{PLUGIN_JS}}`、`{{VERSION}}` 是 build 脚本要替换的占位符。

- [ ] **Step 3: 写 `scripts/build-plugin.mjs`（最小可工作版）**

```javascript
#!/usr/bin/env node
// Build dist/claude-like-plugin.html by inlining compiled SCSS and bundled JS into plugin/template.html.

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as sass from 'sass';
import { build as esbuild } from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

async function fileExists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function buildCSS() {
  const entry = resolve(root, 'scss/plugin.scss');
  if (!(await fileExists(entry))) return '/* plugin.scss not yet created */';
  const { css } = sass.compile(entry, { style: 'compressed', loadPaths: [resolve(root, 'scss')] });
  return css;
}

async function buildJS() {
  const entry = resolve(root, 'js/_bootstrap.js');
  if (!(await fileExists(entry))) return '// _bootstrap.js not yet created';
  const result = await esbuild({
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    minify: true,
    write: false,
    target: ['es2020'],
    legalComments: 'none',
  });
  return result.outputFiles[0].text;
}

async function readVersion() {
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  return pkg.version || '0.0.0';
}

async function main() {
  const [css, js, version] = await Promise.all([buildCSS(), buildJS(), readVersion()]);
  const tpl = await readFile(resolve(root, 'plugin/template.html'), 'utf8');
  const out = tpl
    .replaceAll('{{PLUGIN_CSS}}', css)
    .replaceAll('{{PLUGIN_JS}}', js)
    .replaceAll('{{VERSION}}', version);

  const distDir = resolve(root, 'dist');
  await mkdir(distDir, { recursive: true });
  await writeFile(resolve(distDir, 'claude-like-plugin.html'), out, 'utf8');

  const bytes = Buffer.byteLength(out, 'utf8');
  const kb = (bytes / 1024).toFixed(1);
  console.log(`[build-plugin] dist/claude-like-plugin.html written: ${kb} KB`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

**关键设计**：
- 用 `fileExists` 兜底允许在 SCSS/JS 文件未创建时也能跑通（早期 task 顺序灵活）
- `format: 'iife'` 让 esbuild 输出自执行函数，可直接放进 `<script>` 标签
- `minify: true` 用于产出；如需调试可改 false

- [ ] **Step 4: 更新 `package.json` 脚本**

把 `scripts` 块替换为：

```json
{
  "scripts": {
    "build": "npm run build:css && npm run build:plugin",
    "build:css": "sass --no-source-map --style=expanded scss/claude-like.scss:claude-like.css scss/claude-like-dark.scss:claude-like-dark.css scss/claude-like-grey.scss:claude-like-grey.css",
    "build:plugin": "node scripts/build-plugin.mjs",
    "watch": "sass --no-source-map --style=expanded --watch scss/claude-like.scss:claude-like.css scss/claude-like-dark.scss:claude-like-dark.css scss/claude-like-grey.scss:claude-like-grey.css"
  }
}
```

- [ ] **Step 5: 更新 `.gitignore`**

在末尾追加一行：

```
dist/
```

- [ ] **Step 6: 测试构建脚本**

```bash
npm run build:plugin
ls -lah dist/claude-like-plugin.html
```

预期：脚本退出 0；`dist/claude-like-plugin.html` 创建，体积约 200 bytes（因为 CSS/JS 都是 placeholder 字符串）。

打开看一眼：

```bash
cat dist/claude-like-plugin.html
```

预期：能看到 template.html 的结构，`{{PLUGIN_CSS}}` 被 `/* plugin.scss not yet created */` 替换，`{{PLUGIN_JS}}` 被 `// _bootstrap.js not yet created` 替换，`{{VERSION}}` 被 `1.0.0` 替换。

- [ ] **Step 7: 验证 `npm run build` 链路**

```bash
npm run build
```

预期：先跑 SCSS 编译，再跑 plugin 构建。两条都成功。

- [ ] **Step 8: 提交**

```bash
git add scripts/build-plugin.mjs plugin/template.html package.json package-lock.json .gitignore
git commit -m "build: 引入 esbuild 与 plugin 构建脚本(占位版)"
```

---

## Task 3: 插件 CSS skeleton + [data-theme] 变体

**目标:** 创建 `scss/plugin.scss`，让构建脚本能注入实际的样式。本任务**只**铺设 `[data-theme]` 变体；具体控件 CSS 在各模块任务里逐步追加。

**Files:**
- Create: `scss/plugin.scss`

- [ ] **Step 1: 写 `scss/plugin.scss`**

```scss
// Plugin stylesheet — injected via <head/> into Typora HTML exports.
// Provides theme-switcher palette variants and styles for plugin controls.

@use 'palettes';

// Theme switcher: html[data-theme] specificity (0,0,1,1) wins over :root (0,0,1,0).
// When the switcher sets data-theme on <html>, these blocks override the inline palette.
html[data-theme="light"] { @include palettes.light; }
html[data-theme="grey"]  { @include palettes.grey; }
html[data-theme="dark"]  { @include palettes.dark; }

// ============================================================
// Plugin control CSS will be appended below in subsequent tasks.
// All control classes use the .claude- namespace prefix.
// ============================================================
```

- [ ] **Step 2: 重新构建并验证 CSS 已注入**

```bash
npm run build:plugin
grep -c "html\[data-theme" dist/claude-like-plugin.html
```

预期：grep 计数 = 3（三套 `html[data-theme="..."]` 变体）。

- [ ] **Step 3: 验证体积**

```bash
ls -lah dist/claude-like-plugin.html
```

预期：体积应在 5–15 KB 范围内（包含三套 minified palette CSS，约 2-3KB 每套）。

- [ ] **Step 4: 提交**

```bash
git add scss/plugin.scss
git commit -m "feat(plugin): 添加 plugin.scss 与 [data-theme] 调色板变体"
```

---

## Task 4: JS bootstrap 与模块协议

**目标:** 写 `js/_bootstrap.js` —— 它是 esbuild 的 entry point，负责定义模块协议、错误兜底、DOMContentLoaded 调度。本任务先建立骨架，不实际注册任何业务模块。

**Files:**
- Create: `js/_bootstrap.js`

- [ ] **Step 1: 写 `js/_bootstrap.js`**

```javascript
/**
 * Claude-Like Typora Theme — HTML enhancement plugin bootstrap.
 *
 * Architecture: each feature module exports an object { name, init(ctx) }.
 * Bootstrap collects all modules, then on DOMContentLoaded calls init() on each.
 * Errors in one module are caught and logged; other modules continue.
 */

// Modules will be imported here as they're added in subsequent tasks.
// import themeSwitcher from './theme-switcher.js';
// import codeEnhance from './code-enhance.js';
// import imageLightbox from './image-lightbox.js';
// import footnote from './footnote.js';
// import toc from './toc.js';

const modules = [
  // themeSwitcher,
  // codeEnhance,
  // imageLightbox,
  // footnote,
  // toc,
];

function buildContext() {
  return {
    version: '__INJECTED_AT_BUILD__', // build:plugin will not replace this; informational only
    log: (...args) => console.info('[claude-plugin]', ...args),
    warn: (...args) => console.warn('[claude-plugin]', ...args),
  };
}

function bootstrap() {
  const ctx = buildContext();
  ctx.log(`bootstrap starting,${modules.length} module(s) registered`);
  for (const mod of modules) {
    try {
      mod.init(ctx);
      ctx.log(`module "${mod.name}" initialized`);
    } catch (e) {
      ctx.warn(`module "${mod.name}" failed:`, e);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
```

- [ ] **Step 2: 重新构建并验证 JS 已注入**

```bash
npm run build:plugin
grep -c "bootstrap starting" dist/claude-like-plugin.html
```

预期：grep 计数 = 1（字符串在 minified JS 里能找到）。

- [ ] **Step 3: 浏览器烟测**

把 `dist/claude-like-plugin.html` 中的 `<style>` + `<script>` 部分剪出来塞进一个最小 HTML 测试页：

```bash
cat > /tmp/plugin-smoke.html <<'EOF'
<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
EOF
cat dist/claude-like-plugin.html >> /tmp/plugin-smoke.html
cat >> /tmp/plugin-smoke.html <<'EOF'
</head>
<body>
<div id="write"><p>hello</p></div>
</body>
</html>
EOF
```

在浏览器打开 `/tmp/plugin-smoke.html`，按 F12 看 Console，应见：

```
[claude-plugin] bootstrap starting, 0 module(s) registered
```

如果有 error，定位修复。

- [ ] **Step 4: 提交**

```bash
git add js/_bootstrap.js
git commit -m "feat(plugin): _bootstrap.js 模块加载器 + 错误兜底"
```

---

## Task 5: theme-switcher.js

**目标:** 实现 light/grey/dark 切换器。优先做这个，因为它能立刻**端到端验证** Task 3 的 `[data-theme]` 机制是否工作。

**Files:**
- Create: `js/theme-switcher.js`
- Modify: `js/_bootstrap.js`、`scss/plugin.scss`

- [ ] **Step 1: 写 `js/theme-switcher.js`**

```javascript
/**
 * Theme switcher — inserts a small control in the top-right corner of the exported HTML
 * with three dots (light/grey/dark). Clicking sets data-theme on <html> and persists
 * choice in localStorage.
 */

const STORAGE_KEY = 'claude-theme';
const THEMES = ['light', 'grey', 'dark'];

function getInitialTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (THEMES.includes(stored)) return stored;
  } catch {
    // localStorage unavailable (private mode); fall through
  }
  return null; // null = leave inline :root palette as-is
}

function applyTheme(theme) {
  if (theme === null) {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  try { localStorage.setItem(STORAGE_KEY, theme || ''); } catch {}
}

function buildSwitcher(currentTheme) {
  const root = document.createElement('div');
  root.className = 'claude-theme-switcher';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', '主题切换');

  for (const t of THEMES) {
    const btn = document.createElement('button');
    btn.className = 'claude-theme-switcher__btn';
    btn.dataset.theme = t;
    btn.title = t;
    btn.setAttribute('aria-label', `切换到 ${t} 主题`);
    if (t === currentTheme) btn.classList.add('is-active');
    btn.addEventListener('click', () => {
      applyTheme(t);
      root.querySelectorAll('.claude-theme-switcher__btn').forEach((b) => {
        b.classList.toggle('is-active', b.dataset.theme === t);
      });
    });
    root.appendChild(btn);
  }
  return root;
}

export default {
  name: 'theme-switcher',
  init(ctx) {
    const initial = getInitialTheme();
    if (initial) applyTheme(initial);
    const switcher = buildSwitcher(initial);
    document.body.appendChild(switcher);
    ctx.log('theme-switcher mounted');
  },
};
```

- [ ] **Step 2: 在 `_bootstrap.js` 中注册**

修改 `js/_bootstrap.js` 顶部：

```javascript
// Modules
import themeSwitcher from './theme-switcher.js';

const modules = [
  themeSwitcher,
];
```

把之前的注释占位行去掉，只保留这一条。

- [ ] **Step 3: 在 `scss/plugin.scss` 末尾追加控件 CSS**

```scss

// ----- Theme switcher -----
.claude-theme-switcher {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 100;
    display: flex;
    gap: 6px;
    padding: 6px;
    border-radius: 999px;
    background: var(--bg-color);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    font-family: var(--font-ui);

    &__btn {
        width: 18px;
        height: 18px;
        border: 1px solid var(--border-color);
        border-radius: 50%;
        padding: 0;
        cursor: pointer;
        transition: transform 0.18s ease, box-shadow 0.18s ease;

        &[data-theme="light"] { background: #faf9f5; }
        &[data-theme="grey"]  { background: #444a52; }
        &[data-theme="dark"]  { background: #151210; }

        &.is-active {
            box-shadow: 0 0 0 2px var(--accent-color);
            transform: scale(1.05);
        }

        &:hover:not(.is-active) {
            transform: scale(1.08);
        }
    }
}

html[data-theme="dark"] .claude-theme-switcher {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.32);
}
```

- [ ] **Step 4: 构建**

```bash
npm run build:plugin
```

预期：成功，体积小幅增长（应在 10–25 KB 范围）。

- [ ] **Step 5: 手测**

需要一个真实的 Typora HTML 导出来验证。最快的方式：

```bash
# 先用 try.md 在 Typora 里走一遍标准导出(File > Export > HTML),
# 假定导出到 /tmp/try-export.html。
# 把刚 build 出的 plugin 内容插进 <head>。

PLUGIN=$(cat dist/claude-like-plugin.html)
# 用 Python 脚本插入(避免 sed 的转义噩梦):
python3 - <<EOF
import re
html = open('/tmp/try-export.html').read()
plugin = open('dist/claude-like-plugin.html').read()
html = html.replace('</head>', plugin + '\n</head>', 1)
open('/tmp/try-export-enhanced.html', 'w').write(html)
EOF

open /tmp/try-export-enhanced.html
```

在浏览器打开后预期：

- [ ] 右上角出现三个小圆点
- [ ] 当前 active 圆点带强调色 ring
- [ ] 点击 grey → 整页切到灰主题
- [ ] 点击 dark → 整页切到深主题
- [ ] 刷新页面 → 选择被记住
- [ ] Console 看到 `[claude-plugin] theme-switcher mounted`

如果切换无效：检查 `html[data-theme]` 是否生效（DevTools 看 `<html>` 标签是否有该属性，看 Elements ▸ Computed ▸ CSS variables 是否变了）。

- [ ] **Step 6: 提交**

```bash
git add js/theme-switcher.js js/_bootstrap.js scss/plugin.scss
git commit -m "feat(plugin): theme-switcher 模块 + 圆点控件 + localStorage 持久化"
```

---

## Task 6: code-enhance.js（复制按钮 + 行号）

**目标:** 给导出 HTML 里每个 `<pre>` 代码块加复制按钮和行号。复制内容**不含行号**。

**Files:**
- Create: `js/code-enhance.js`
- Modify: `js/_bootstrap.js`、`scss/plugin.scss`

- [ ] **Step 1: 用真实 Typora 导出确认代码块的 DOM 结构**

```bash
# 准备一个最小测试文档
cat > /tmp/code-test.md <<'EOF'
\`\`\`python
def hello():
    print("hello")
\`\`\`
EOF
```

在 Typora 里打开，导出 HTML 到 `/tmp/code-test.html`，搜索 `<pre`：

```bash
grep -A 3 "<pre" /tmp/code-test.html | head -20
```

记下实际的 selector 结构。**典型情况**：Typora 导出代码块为 `<pre class="md-fences ...">` 或 `<pre><code class="language-python">`。下面以最常见的 `<pre>` 容器为准。

- [ ] **Step 2: 写 `js/code-enhance.js`**

```javascript
/**
 * Code block enhancement:
 *   1. Inject a "copy" button in the top-right of each <pre> block.
 *   2. Render line numbers via CSS counters; line numbers do not enter the clipboard.
 *
 * Selector strategy: target every <pre> that is a direct child of a non-pre ancestor,
 * with at least one descendant <code> or non-empty text.
 */

function isCodeBlock(pre) {
  // Heuristic: pre with code child OR pre with .CodeMirror inside (Typora's source view leftovers should not appear in HTML export, but be safe).
  if (pre.querySelector('code')) return true;
  if (pre.textContent.trim().length > 0) return true;
  return false;
}

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback: textarea + execCommand
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy') ? resolve() : reject(new Error('execCommand failed'));
    } finally {
      document.body.removeChild(ta);
    }
  });
}

function attachCopyButton(pre) {
  const btn = document.createElement('button');
  btn.className = 'claude-code-copy-btn';
  btn.type = 'button';
  btn.textContent = '复制';
  btn.title = '复制代码';
  btn.addEventListener('click', async () => {
    const code = pre.querySelector('code') || pre;
    const text = code.innerText;
    try {
      await copyText(text);
      btn.textContent = '✓';
      btn.classList.add('is-success');
      setTimeout(() => {
        btn.textContent = '复制';
        btn.classList.remove('is-success');
      }, 2000);
    } catch (e) {
      btn.textContent = '失败';
      btn.classList.add('is-error');
      setTimeout(() => {
        btn.textContent = '复制';
        btn.classList.remove('is-error');
      }, 2000);
    }
  });
  pre.appendChild(btn);
}

function applyLineNumbers(pre) {
  // We rely on CSS counters; only mark the <pre> so styles can engage.
  pre.classList.add('claude-code-numbered');
}

export default {
  name: 'code-enhance',
  init(ctx) {
    if (!navigator.clipboard?.writeText && !document.queryCommandSupported?.('copy')) {
      ctx.warn('copy not supported in this browser; copy buttons will still try');
    }
    const pres = document.querySelectorAll('#write pre');
    let count = 0;
    pres.forEach((pre) => {
      if (!isCodeBlock(pre)) return;
      // Wrap so the button positions correctly even on long code blocks.
      pre.style.position = pre.style.position || 'relative';
      attachCopyButton(pre);
      applyLineNumbers(pre);
      count++;
    });
    ctx.log(`code-enhance attached to ${count} code block(s)`);
  },
};
```

- [ ] **Step 3: 在 `_bootstrap.js` 中注册**

```javascript
import themeSwitcher from './theme-switcher.js';
import codeEnhance from './code-enhance.js';

const modules = [
  themeSwitcher,
  codeEnhance,
];
```

- [ ] **Step 4: 在 `scss/plugin.scss` 末尾追加代码块控件 CSS**

```scss

// ----- Code block enhancement -----
#write pre {
    position: relative; // 让 copy 按钮的 absolute 定位有锚点
}

.claude-code-copy-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 4px 10px;
    font: 12px/1 var(--font-ui);
    color: var(--control-text-color);
    background: var(--bg-color);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.18s ease, color 0.18s ease;

    #write pre:hover & {
        opacity: 1;
    }

    &:hover {
        color: var(--heading-color);
    }

    &.is-success {
        color: var(--accent-color);
        border-color: var(--accent-color);
        opacity: 1;
    }

    &.is-error {
        color: #c14a4a;
        border-color: #c14a4a;
        opacity: 1;
    }
}

// Line numbers via CSS counters. Each direct child line in <code> gets numbered.
// Typora exports newlines as text nodes inside <code>, not <span> per line, which
// makes pure-CSS line numbering tricky. We fall back to the simpler approach of
// using ::before on the pre itself with a counter that increments per "\n".
//
// Practical approach: render numbers in a separate aside that overlays. Because
// fonts and line-heights match (both var(--font-mono)), alignment works.
.claude-code-numbered {
    padding-left: 3em !important;

    &::before {
        content: counter(claude-code-line);
        position: absolute;
        top: 0.9rem;
        left: 0.8em;
        font-family: var(--font-mono);
        font-size: 0.9em;
        line-height: 1.55;
        color: var(--code-muted-color, var(--control-text-color));
        text-align: right;
        white-space: pre;
        user-select: none;
        pointer-events: none;
        counter-reset: claude-code-line;
    }
}

// NOTE: pure-CSS multi-line numbering with Typora's pre/code structure is fragile.
// If Task 6 manual testing shows alignment issues, consider rendering numbers via
// JS as a <pre class="claude-code-gutter">…</pre> sibling (Future Work).
```

**重要：** 关于行号 —— 上面的 CSS 方案是单数字渲染，**不能给每行单独编号**。这是因为 Typora 导出代码块时把整段代码放在单一 `<code>` 里，行只是 `\n` 文本，无法用纯 CSS 给每行 `counter-increment`。

如果手测发现行号"只有一行"或"对不齐"，本任务**降级处理**：

> **降级方案**：删掉 `&::before` 那段 CSS，改成 JS 注入。在 `code-enhance.js` 的 `applyLineNumbers` 里，把 `code.innerText` 按 `\n` 分割，左侧用 `<aside class="claude-code-gutter">` 渲染 1..N 行号，CSS 让 gutter 与 pre 并排。**复制时按钮取 code.innerText**（已经避开 gutter），不会带入数字。代码量 ~30 行；不在此任务展开，写入 follow-up commit。

- [ ] **Step 5: 构建并手测**

```bash
npm run build:plugin
```

然后在 Typora 导出含代码块的样本（用 `try.md` 或 `/tmp/code-test.md`），按 Task 5 Step 5 的方式拼接 + 打开。

验证清单：
- [ ] 鼠标移到代码块上，右上角浮出"复制"按钮
- [ ] 点击 → 显示 "✓" 2 秒后回弹
- [ ] Console 不报错
- [ ] 行号显示在每行左侧（如果失败，按 Step 4 末尾的降级方案重做）
- [ ] 选中代码后复制（系统级 Cmd+C），粘贴出来**不含行号数字**

- [ ] **Step 6: 提交**

```bash
git add js/code-enhance.js js/_bootstrap.js scss/plugin.scss
git commit -m "feat(plugin): code-enhance 模块 — 复制按钮 + 行号"
```

如果走了降级方案，commit 信息加 `(JS-driven gutter)` 后缀。

---

## Task 7: image-lightbox.js

**目标:** 点击文档中的图片放大全屏查看；图片下方显示 `alt` 文本作为 caption。

**Files:**
- Create: `js/image-lightbox.js`
- Modify: `js/_bootstrap.js`、`scss/plugin.scss`

- [ ] **Step 1: 写 `js/image-lightbox.js`**

```javascript
/**
 * Image lightbox + caption.
 * - Wraps each <img alt="..."> in <figure> with <figcaption> showing alt text.
 * - Click image → fullscreen overlay with image + caption; Esc or click overlay closes.
 * - Skip images with class "no-lightbox".
 */

function wrapWithCaption(img) {
  if (img.parentElement?.tagName === 'FIGURE') return; // already wrapped
  const figure = document.createElement('figure');
  figure.className = 'claude-figure';
  img.parentElement.insertBefore(figure, img);
  figure.appendChild(img);
  const alt = (img.getAttribute('alt') || '').trim();
  if (alt) {
    const caption = document.createElement('figcaption');
    caption.className = 'claude-figcaption';
    caption.textContent = alt;
    figure.appendChild(caption);
  }
}

let overlay; // singleton

function ensureOverlay() {
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.className = 'claude-lightbox-overlay';
  overlay.innerHTML = `
    <img class="claude-lightbox-img" alt="">
    <div class="claude-lightbox-caption"></div>
  `;
  overlay.addEventListener('click', (e) => {
    // Click on overlay background (not the image itself) closes.
    if (e.target === overlay) close();
  });
  document.body.appendChild(overlay);
  return overlay;
}

function open(src, alt) {
  const ov = ensureOverlay();
  ov.querySelector('.claude-lightbox-img').src = src;
  ov.querySelector('.claude-lightbox-caption').textContent = alt || '';
  ov.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function close() {
  if (!overlay) return;
  overlay.classList.remove('is-open');
  document.body.style.overflow = '';
}

export default {
  name: 'image-lightbox',
  init(ctx) {
    const imgs = document.querySelectorAll('#write img:not(.no-lightbox)');
    if (imgs.length === 0) {
      ctx.log('image-lightbox: no images, skipping');
      return;
    }
    imgs.forEach((img) => {
      wrapWithCaption(img);
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', () => open(img.currentSrc || img.src, img.getAttribute('alt')));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
    ctx.log(`image-lightbox attached to ${imgs.length} image(s)`);
  },
};
```

- [ ] **Step 2: 在 `_bootstrap.js` 中注册**

```javascript
import themeSwitcher from './theme-switcher.js';
import codeEnhance from './code-enhance.js';
import imageLightbox from './image-lightbox.js';

const modules = [
  themeSwitcher,
  codeEnhance,
  imageLightbox,
];
```

- [ ] **Step 3: 在 `scss/plugin.scss` 末尾追加 CSS**

```scss

// ----- Image lightbox + caption -----
.claude-figure {
    margin: 1.2em 0;
    text-align: center;

    img {
        max-width: 100%;
        height: auto;
    }
}

.claude-figcaption {
    margin-top: 0.6em;
    font: 0.88em/1.4 var(--font-body);
    color: var(--control-text-color);
    text-align: center;
}

.claude-lightbox-overlay {
    position: fixed;
    inset: 0;
    z-index: 999;
    display: none;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 12px;
    background: rgba(0, 0, 0, 0.72);
    padding: 32px;
    cursor: zoom-out;

    &.is-open { display: flex; }

    .claude-lightbox-img {
        max-width: 92vw;
        max-height: 82vh;
        object-fit: contain;
        cursor: default;
        border-radius: 6px;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
    }

    .claude-lightbox-caption {
        max-width: 92vw;
        color: #f0f0f0;
        font: 0.92em/1.4 var(--font-ui);
        text-align: center;
    }
}
```

- [ ] **Step 4: 构建并手测**

```bash
npm run build:plugin
```

在带图片的 markdown（可在 `try.md` 加一行 `![测试图说明](image/2026-03-11-claude-like-theme/light.png)`）里走完整流程。

验证：
- [ ] 图片下方显示居中 caption（alt 文本）
- [ ] 鼠标移到图片上 cursor 变 zoom-in
- [ ] 点击图片 → 黑色 overlay 弹出，图片居中显示，caption 在下
- [ ] 按 Esc 关闭
- [ ] 点 overlay 黑色背景关闭（点图片本身不关闭）
- [ ] 无 alt 的图片不显示空 caption

- [ ] **Step 5: 提交**

```bash
git add js/image-lightbox.js js/_bootstrap.js scss/plugin.scss
git commit -m "feat(plugin): image-lightbox 模块 — 点击放大 + alt caption"
```

---

## Task 8: footnote.js

**目标:** 鼠标 hover 脚注引用 0.4 秒后浮窗显示对应内容；离开或 Esc 关闭。

**Files:**
- Create: `js/footnote.js`
- Modify: `js/_bootstrap.js`、`scss/plugin.scss`

- [ ] **Step 1: 确认 Typora 脚注的实际 DOM 结构**

```bash
cat > /tmp/fn-test.md <<'EOF'
正文有一个脚注[^1]。

[^1]: 这是脚注内容。
EOF
```

在 Typora 打开导出，看 HTML：

```bash
grep -B1 -A3 "footnote" /tmp/fn-test.html | head -30
```

**典型结构**：引用是 `<sup><a href="#fn:1" id="fnref:1">1</a></sup>`，定义在 `<div class="footnotes"><ol><li id="fn:1">…</li></ol></div>`。如果实际不同，调整下面的 selectors。

- [ ] **Step 2: 写 `js/footnote.js`**

```javascript
/**
 * Footnote popover — hover a footnote ref to see its content without scrolling.
 *
 * DOM contract (verify against actual Typora HTML export):
 *   - Ref:  <sup><a href="#fn:N" id="fnref:N">N</a></sup>
 *   - Body: <div class="footnotes"><ol><li id="fn:N">…content…</li></ol></div>
 */

const HOVER_DELAY_MS = 400;

function findFootnoteBody(refHref) {
  // refHref like "#fn:1"
  const id = refHref.replace(/^#/, '');
  const li = document.getElementById(id);
  if (!li) return null;
  // Strip the "back-jump" arrow link Typora appends; clone to avoid mutating original.
  const clone = li.cloneNode(true);
  clone.querySelectorAll('a.footnote-backref, a[href^="#fnref"]').forEach((a) => a.remove());
  return clone.innerHTML.trim();
}

let popover;
let hoverTimer = null;

function ensurePopover() {
  if (popover) return popover;
  popover = document.createElement('div');
  popover.className = 'claude-footnote-popover';
  popover.addEventListener('mouseleave', hide);
  document.body.appendChild(popover);
  return popover;
}

function show(anchor, html) {
  const pop = ensurePopover();
  pop.innerHTML = html;
  const rect = anchor.getBoundingClientRect();
  pop.style.left = `${Math.min(rect.left + window.scrollX, window.innerWidth - 360)}px`;
  pop.style.top = `${rect.bottom + window.scrollY + 6}px`;
  pop.classList.add('is-open');
}

function hide() {
  if (!popover) return;
  popover.classList.remove('is-open');
}

export default {
  name: 'footnote',
  init(ctx) {
    if (!document.querySelector('.footnotes, .footnote-section')) {
      ctx.log('footnote: no footnote section, skipping');
      return;
    }
    const refs = document.querySelectorAll('sup > a[href^="#fn"], a.footnote-ref');
    if (refs.length === 0) {
      ctx.log('footnote: no refs, skipping');
      return;
    }
    refs.forEach((a) => {
      a.addEventListener('mouseenter', () => {
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => {
          const html = findFootnoteBody(a.getAttribute('href'));
          if (html) show(a, html);
        }, HOVER_DELAY_MS);
      });
      a.addEventListener('mouseleave', () => {
        clearTimeout(hoverTimer);
        // Don't hide immediately — user may be moving toward the popover.
        setTimeout(() => {
          if (!popover?.matches(':hover')) hide();
        }, 200);
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hide();
    });
    ctx.log(`footnote attached to ${refs.length} ref(s)`);
  },
};
```

- [ ] **Step 3: 在 `_bootstrap.js` 中注册**

```javascript
import themeSwitcher from './theme-switcher.js';
import codeEnhance from './code-enhance.js';
import imageLightbox from './image-lightbox.js';
import footnote from './footnote.js';

const modules = [
  themeSwitcher,
  codeEnhance,
  imageLightbox,
  footnote,
];
```

- [ ] **Step 4: 在 `scss/plugin.scss` 末尾追加 CSS**

```scss

// ----- Footnote popover -----
.claude-footnote-popover {
    position: absolute;
    z-index: 200;
    max-width: 360px;
    padding: 12px 16px;
    background: var(--bg-color);
    color: var(--text-color);
    border-left: 3px solid var(--accent-color);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    font: 0.92em/1.5 var(--font-body);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.18s ease;

    &.is-open {
        opacity: 1;
        pointer-events: auto;
    }

    p { margin: 0.3em 0; }
    p:first-child { margin-top: 0; }
    p:last-child { margin-bottom: 0; }
}

html[data-theme="dark"] .claude-footnote-popover,
html[data-theme="grey"] .claude-footnote-popover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.32);
}
```

- [ ] **Step 5: 构建并手测**

```bash
npm run build:plugin
```

用带脚注的样本导出 → 拼接 → 浏览器打开。

验证：
- [ ] 鼠标 hover 一个脚注引用，等约 0.4 秒后浮层出现
- [ ] 浮层内容是脚注定义文本（不含 Typora 默认那个返回箭头）
- [ ] 鼠标移开 → 浮层关闭
- [ ] 鼠标从引用移动到浮层上 → 浮层不关闭（你能选浮层里的文字）
- [ ] 按 Esc 关闭浮层
- [ ] 点击引用仍然跳转到底部脚注定义（原生行为没被破坏）

- [ ] **Step 6: 提交**

```bash
git add js/footnote.js js/_bootstrap.js scss/plugin.scss
git commit -m "feat(plugin): footnote 模块 — hover popover"
```

---

## Task 9: toc.js（浮动 TOC + 章节高亮 + 响应式）

**目标:** 左侧浮动 TOC 面板，滚动联动高亮当前章节，窄屏自动折叠。这是 5 个模块里最大的一个，分 3 个子步骤实现。

**Files:**
- Create: `js/toc.js`
- Modify: `js/_bootstrap.js`、`scss/plugin.scss`

- [ ] **Step 1: 写 `js/toc.js` —— 树构建 + 渲染**

```javascript
/**
 * Floating TOC + active-section highlight.
 *
 * Algorithm:
 *   1. Scan #write h1..h6, assign stable ids (use existing or slugify).
 *   2. Build nested tree by heading level.
 *   3. Render as <ol> nested list in <aside class="claude-toc">.
 *   4. Use IntersectionObserver to track which heading is currently "active".
 *   5. Click TOC item → smooth scrollIntoView + update location.hash.
 *   6. On viewports < 1100px, collapse panel to a hamburger.
 */

const MAX_LEVEL = 3; // show h1-h3 only

function slugify(text) {
  return (text || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w一-龥 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function collectHeadings(root) {
  const all = root.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const used = new Set();
  const items = [];
  for (const h of all) {
    const level = Number(h.tagName.slice(1));
    if (level > MAX_LEVEL) continue;
    let id = h.id || slugify(h.textContent);
    if (!id) continue;
    let unique = id;
    let n = 1;
    while (used.has(unique)) unique = `${id}-${++n}`;
    used.add(unique);
    if (!h.id) h.id = unique;
    items.push({ level, id: unique, text: h.textContent.trim(), el: h });
  }
  return items;
}

function renderList(items) {
  // Convert flat list with levels to nested <ol>.
  const root = document.createElement('ol');
  root.className = 'claude-toc__list';
  const stack = [{ level: 0, ol: root }];

  for (const it of items) {
    while (stack[stack.length - 1].level >= it.level) stack.pop();
    const parent = stack[stack.length - 1].ol;
    const li = document.createElement('li');
    li.className = `claude-toc__item is-level-${it.level}`;
    li.dataset.targetId = it.id;
    const a = document.createElement('a');
    a.href = `#${it.id}`;
    a.textContent = it.text;
    a.className = 'claude-toc__link';
    li.appendChild(a);
    parent.appendChild(li);
    const childOl = document.createElement('ol');
    li.appendChild(childOl);
    stack.push({ level: it.level, ol: childOl });
  }
  return root;
}

function attachScrollSpy(items) {
  if (!('IntersectionObserver' in window)) return; // graceful skip
  const tocItems = new Map(); // id → li
  document.querySelectorAll('.claude-toc__item').forEach((li) => {
    tocItems.set(li.dataset.targetId, li);
  });

  const visible = new Set();
  const obs = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) visible.add(e.target.id);
      else visible.delete(e.target.id);
    }
    // Pick the topmost visible heading (in document order).
    let activeId = null;
    for (const it of items) {
      if (visible.has(it.id)) { activeId = it.id; break; }
    }
    tocItems.forEach((li, id) => li.classList.toggle('is-active', id === activeId));
  }, { rootMargin: '0px 0px -65% 0px', threshold: 0 });
  items.forEach((it) => obs.observe(it.el));
}

function buildToggle(panel) {
  const btn = document.createElement('button');
  btn.className = 'claude-toc__toggle';
  btn.type = 'button';
  btn.setAttribute('aria-label', '展开/收起目录');
  btn.textContent = '≡';
  btn.addEventListener('click', () => panel.classList.toggle('is-collapsed'));
  return btn;
}

function buildPanel(items) {
  const aside = document.createElement('aside');
  aside.className = 'claude-toc';
  // Default-collapsed on narrow viewports.
  if (window.matchMedia('(max-width: 1100px)').matches) aside.classList.add('is-collapsed');
  aside.appendChild(buildToggle(aside));
  const header = document.createElement('div');
  header.className = 'claude-toc__header';
  header.textContent = '目录';
  aside.appendChild(header);
  aside.appendChild(renderList(items));
  return aside;
}

export default {
  name: 'toc',
  init(ctx) {
    const root = document.getElementById('write') || document.body;
    const items = collectHeadings(root);
    if (items.length === 0) {
      ctx.log('toc: no headings, skipping');
      return;
    }
    const panel = buildPanel(items);
    document.body.appendChild(panel);

    // Smooth-scroll behavior on TOC links (let location.hash update naturally).
    panel.addEventListener('click', (e) => {
      const a = e.target.closest('a.claude-toc__link');
      if (!a) return;
      e.preventDefault();
      const id = a.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', `#${id}`);
      }
    });

    attachScrollSpy(items);

    ctx.log(`toc rendered with ${items.length} heading(s)`);
  },
};
```

- [ ] **Step 2: 在 `_bootstrap.js` 中注册（放最后）**

```javascript
import themeSwitcher from './theme-switcher.js';
import codeEnhance from './code-enhance.js';
import imageLightbox from './image-lightbox.js';
import footnote from './footnote.js';
import toc from './toc.js';

const modules = [
  themeSwitcher,
  codeEnhance,
  imageLightbox,
  footnote,
  toc,
];
```

- [ ] **Step 3: 在 `scss/plugin.scss` 末尾追加 TOC CSS**

```scss

// ----- Floating TOC -----
.claude-toc {
    position: fixed;
    top: 60px;
    left: 16px;
    bottom: 16px;
    width: 220px;
    overflow-y: auto;
    padding: 16px 14px 16px 16px;
    background: var(--bg-color);
    color: var(--text-color);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    font: 13px/1.5 var(--font-ui);
    z-index: 100;
    transition: width 0.18s ease, padding 0.18s ease;

    &__toggle {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 24px;
        height: 24px;
        background: transparent;
        border: 0;
        cursor: pointer;
        color: var(--control-text-color);
        font-size: 18px;
        line-height: 1;
    }

    &__header {
        margin-bottom: 10px;
        font-weight: 600;
        color: var(--heading-color);
        font-size: 14px;
    }

    &__list, ol {
        list-style: none;
        margin: 0;
        padding-left: 12px;
    }
    > .claude-toc__list { padding-left: 0; }

    &__item {
        margin: 2px 0;
        &.is-level-1 > .claude-toc__link { font-weight: 600; }
        &.is-active > .claude-toc__link {
            color: var(--accent-color);
            border-left-color: var(--accent-color);
        }
    }

    &__link {
        display: block;
        padding: 3px 8px;
        color: var(--control-text-color);
        text-decoration: none;
        border-left: 2px solid transparent;
        transition: color 0.12s ease, border-color 0.12s ease;

        &:hover { color: var(--heading-color); }
    }

    &.is-collapsed {
        width: 28px;
        padding: 8px;
        overflow: hidden;

        .claude-toc__header,
        .claude-toc__list { display: none; }
    }
}

html[data-theme="dark"] .claude-toc,
html[data-theme="grey"] .claude-toc {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.32);
}

// 窄屏 overlay 模式(展开时盖在正文上)
@media (max-width: 1100px) {
    .claude-toc {
        top: 12px;
        left: 12px;
        bottom: auto;
        max-height: calc(100vh - 24px);
        // 展开时给个半透明背景
        &:not(.is-collapsed) {
            background: var(--bg-color);
        }
    }
}
```

- [ ] **Step 4: 构建并手测**

```bash
npm run build:plugin
```

用一个含多级标题的文档导出（`try.md` 已经够；或用 `test/sample.md` Task 10 的更全样本）。

验证：
- [ ] 页面左侧出现 TOC 面板，列出 h1-h3
- [ ] 滚动文档，当前可见章节在 TOC 里高亮（强调色文字 + 左竖条）
- [ ] 点击 TOC 项 → 平滑滚动到对应位置，URL hash 更新
- [ ] 浏览器缩到 < 1100px 宽 → TOC 自动折叠为窄条
- [ ] 点 TOC 的 ≡ 按钮 → 展开/收起切换
- [ ] 三个主题切换时 TOC 视觉一致（背景/阴影都对）

- [ ] **Step 5: 提交**

```bash
git add js/toc.js js/_bootstrap.js scss/plugin.scss
git commit -m "feat(plugin): toc 模块 — 浮动目录 + 章节高亮 + 响应式折叠"
```

---

## Task 10: test/sample.md + CHECKLIST.md

**目标:** 把测试材料正式化，方便后续每次发版前手测。

**Files:**
- Create: `test/sample.md`、`test/CHECKLIST.md`

- [ ] **Step 1: 写 `test/sample.md`**

```markdown
---
title: Claude-Like Theme — Sample Document
---

# 一级标题：测试文档总览

本文档用于综合验证 HTML 增强功能。每次发版前请用三个主题各导出一份 HTML。

## 二级标题：基础排版

正文段落。这是一段用来验证字号、行距、字体的中文文本，*斜体*、**加粗**、`inline code`、混合 English text 都应在视觉上和谐。

> 单行引用：左侧应有 3px 强调色竖线，无背景填充，无圆角。

> 多行引用：
> 第二行。
> 第三行混入 `inline code`、**加粗**。

### 三级标题：列表

- 无序项一
- 无序项二
  - 嵌套
- 无序项三

1. 有序项一
2. 有序项二
3. 有序项三

#### 四级标题不应该出现在 TOC

正文……

##### 五级标题不应出现在 TOC

##### 六级标题不应出现在 TOC

## 二级标题：表格

| 列 A | 列 B | 列 C |
| ---- | ---- | ---- |
| 单元 1 | 单元 2 | 单元 3 |
| 长一些的内容,看 padding 是否撑开 | 中等 | 短 |

## 二级标题：代码块

Python：

\`\`\`python
def fibonacci(n):
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

for i in range(10):
    print(fibonacci(i))
\`\`\`

JavaScript：

\`\`\`javascript
const x = 1;
const y = 2;
console.log(x + y);
\`\`\`

Bash：

\`\`\`bash
echo "hello"
ls -la
\`\`\`

## 二级标题：图片

![一张测试图，alt 文本会作为 caption](image/2026-03-11-claude-like-theme/light.png)

## 二级标题：脚注

正文里有一个脚注[^1]，再来一个[^second]，验证 hover 弹窗工作。

[^1]: 这是第一个脚注的内容。可以包含 `inline code` 和 **加粗**。
[^second]: 这是第二个脚注，看不同 id 是否正确取到。

## 二级标题：数学（如主题支持）

行内公式 $E = mc^2$ 应渲染。

块级：

$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$
```

注意：`image/2026-03-11-claude-like-theme/light.png` 已存在于仓库；如果你的样本要在仓库外测试，先复制图。

- [ ] **Step 2: 写 `test/CHECKLIST.md`**

```markdown
# 发版前手测清单

打开 `test/sample.md` 在 Typora 里,用 light/grey/dark 三个主题各导出一份 HTML,
然后把构建出的 `dist/claude-like-plugin.html` 内容粘到 Typora 的「导出设置 ▸ HTML ▸ 在 <head/> 中添加」。
重新导出后,在浏览器打开,对照本清单。

## 基础渲染(主题 CSS 本身)

- [ ] 三个主题都能正常打开 HTML,无 console error
- [ ] 标题层级清晰,字体为 Anthropic Serif(或 fallback)
- [ ] 表格胶囊化:表头深米色,正文浅米色,行间无线
- [ ] 引用块只有左竖线,无背景填充,无圆角
- [ ] Inline code 是 4px 圆角矩形,不是胶囊形

## Theme switcher

- [ ] 右上角三个圆点出现
- [ ] 当前主题对应的圆点高亮
- [ ] 点击切换:三套配色生效
- [ ] 刷新页面,选择被记住
- [ ] 隐私模式打开仍可切换,只是不持久化(无 console error)

## TOC

- [ ] 左侧 TOC 出现,显示 h1-h3
- [ ] h4-h6 不出现在 TOC
- [ ] 滚动时当前章节高亮
- [ ] 点击 TOC 项平滑滚动到对应位置
- [ ] URL hash 更新
- [ ] 视口缩到 < 1100px,TOC 自动折叠
- [ ] 点 ≡ 按钮可展开/收起

## Code

- [ ] 代码块右上角 hover 出"复制"按钮
- [ ] 点击复制 → 显 ✓ 2 秒后回弹
- [ ] 系统级 Cmd+C 复制代码 → 粘贴不含行号
- [ ] 行号显示在每行左侧(若降级方案则用 JS gutter)
- [ ] 长代码块滚动正常

## Images

- [ ] 图片下方显示 caption(alt 文本)
- [ ] 鼠标移到图片 cursor 变 zoom-in
- [ ] 点击图片 → 全屏 overlay 弹出
- [ ] overlay 中图片居中,caption 在下方
- [ ] Esc 关闭 overlay
- [ ] 点 overlay 黑色背景关闭

## Footnotes

- [ ] hover 脚注 0.4 秒后浮窗出现
- [ ] 浮窗显示对应脚注内容,不含返回箭头
- [ ] 鼠标从引用移到浮窗,浮窗不关闭
- [ ] Esc 关闭浮窗
- [ ] 点击脚注仍能跳转到底部
```

- [ ] **Step 3: 验证文件可被 Typora 打开**

```bash
ls -lah test/sample.md test/CHECKLIST.md
```

预期：两个文件都存在。手工：在 Typora 中 File → Open `test/sample.md`，能正常渲染。

- [ ] **Step 4: 提交**

```bash
git add test/sample.md test/CHECKLIST.md
git commit -m "test: 添加综合样本 markdown 与手测清单"
```

---

## Task 11: README 更新

**目标:** 在 README 里新增"HTML 增强"章节，说明安装和使用方式；末尾追加 Acknowledgments。

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 读取现有 README**

```bash
cat README.md
```

记下结构，确定新章节插入位置（"安装方式"那节之后，"特点"之前或之后）。

- [ ] **Step 2: 在适当位置插入新章节**

在 README 的安装说明之后，插入：

```markdown
## HTML 增强（可选）

主题除了 Typora 编辑器内的样式之外，还提供一份**浏览器端**的 HTML 增强插件。
它给导出的 HTML 加上浮动目录、代码复制按钮、图片放大、脚注 hover 浮窗、
light/grey/dark 主题切换器等阅读体验。

### 安装

1. 从 [Releases](https://github.com/<owner>/<repo>/releases) 下载最新的 `claude-like-plugin.html`
2. 在 Typora：偏好设置 ▸ 导出 ▸ 新建一个 HTML 配置（例如命名为 "Claude HTML"）
3. 在该配置的「在 `<head/>` 中添加」字段，粘贴整个 `claude-like-plugin.html` 的内容
4. 从此配置导出文档时，HTML 自动带增强

### 自己构建

```bash
git clone <repo>
cd <repo>
npm install
npm run build
# 产出在 dist/claude-like-plugin.html
```

详见 [docs/specs/2026-05-19-html-enhancement-design.md](docs/specs/2026-05-19-html-enhancement-design.md) 与 [docs/plans/2026-05-19-html-enhancement-implementation.md](docs/plans/2026-05-19-html-enhancement-implementation.md)。
```

- [ ] **Step 3: 在文件末尾追加 Acknowledgments**

如果 README 末尾已有 Star History 等节，在其前插入；否则文件末尾追加：

```markdown
## Acknowledgments

- 派生自 [Muyiiiii/Typora_Claude-Like_Theme](https://github.com/Muyiiiii/Typora_Claude-Like_Theme)（MIT License）
- HTML 增强模块设计与实现参考 [MadMaxChow/VLOOK](https://github.com/MadMaxChow/VLOOK)（MIT License）
```

- [ ] **Step 4: 提交**

```bash
git add README.md
git commit -m "docs: README 新增 HTML 增强章节与 Acknowledgments"
```

---

## Task 12: LICENSE-VLOOK 文件

**目标:** 把 VLOOK 仓库的 LICENSE 文件逐字拷贝到本仓库根目录，满足 MIT 的"保留版权和许可证文本"要求。

**Files:**
- Create: `LICENSE-VLOOK`

- [ ] **Step 1: 拉取 VLOOK 的 LICENSE**

```bash
curl -fsSL https://raw.githubusercontent.com/MadMaxChow/VLOOK/master/LICENSE -o LICENSE-VLOOK
head -3 LICENSE-VLOOK
```

预期：内容以 `MIT License` 开头，`Copyright (c) 2016-2021 MAX°DESIGN | Max Chow` 类似。

- [ ] **Step 2: 在文件顶部插入说明**

用编辑器在文件最顶部加一个注释段（MIT 协议本身允许这样做，但要保留原文）：

```bash
# 在文件顶部插入说明（保留原 LICENSE 全文）
python3 - <<'PY'
with open('LICENSE-VLOOK', 'r') as f:
    original = f.read()
prefix = """\
==============================================================================
This file is a verbatim copy of the LICENSE from MadMaxChow/VLOOK,
preserved here because portions of js/*.js are adapted from that project.

Upstream: https://github.com/MadMaxChow/VLOOK
==============================================================================

"""
with open('LICENSE-VLOOK', 'w') as f:
    f.write(prefix + original)
PY
head -10 LICENSE-VLOOK
```

预期：顶部插入了一段说明，下方是原 LICENSE 全文。

- [ ] **Step 3: 提交**

```bash
git add LICENSE-VLOOK
git commit -m "legal: 添加 LICENSE-VLOOK,保留 VLOOK 上游 MIT 版权声明"
```

---

## Task 13: CI workflow 扩展

**目标:** 让 GitHub Actions 在 push 时同时构建 SCSS 和 plugin，并做产物烟测（存在性 + 大小检查）。

**Files:**
- Modify: `.github/workflows/sync-css.yml`

- [ ] **Step 1: 替换 workflow 内容**

把 `.github/workflows/sync-css.yml` 整个改写为（保留原名以保留历史，或重命名为 `build.yml` 二选一；这里**保留原名**避免链接断）：

```yaml
name: Build & Sync

on:
  push:
    branches: [master]
    paths:
      - 'scss/**'
      - 'js/**'
      - 'plugin/**'
      - 'scripts/**'
      - 'package.json'
      - 'package-lock.json'
      - '.github/workflows/sync-css.yml'

permissions:
  contents: write

concurrency:
  group: build-${{ github.ref }}
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    if: github.actor != 'github-actions[bot]'

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build (CSS + plugin)
        run: npm run build

      - name: Smoke check plugin artifact
        run: |
          test -f dist/claude-like-plugin.html || { echo "::error::dist/claude-like-plugin.html missing"; exit 1; }
          SIZE=$(wc -c < dist/claude-like-plugin.html)
          echo "Plugin size: $SIZE bytes"
          if [ "$SIZE" -lt 51200 ] || [ "$SIZE" -gt 307200 ]; then
            echo "::error::Plugin size $SIZE outside [50KB, 300KB] range"
            exit 1
          fi
          if grep -q "{{" dist/claude-like-plugin.html; then
            echo "::error::Unsubstituted placeholders remain in plugin output"
            grep -n "{{" dist/claude-like-plugin.html | head
            exit 1
          fi

      - name: Commit & push regenerated CSS
        run: |
          if git diff --quiet -- claude-like.css claude-like-dark.css claude-like-grey.css; then
            echo "CSS already up to date with SCSS — nothing to commit."
            exit 0
          fi
          git config user.name 'github-actions[bot]'
          git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
          git add claude-like.css claude-like-dark.css claude-like-grey.css
          git commit -m "ci: 自动同步 SCSS → CSS [skip ci]"
          git push
```

**关键改动相对原 workflow**：
- `paths:` 过滤新增 `js/`、`plugin/`、`scripts/`
- 新增 `Smoke check plugin artifact` step：验证 dist 文件存在、大小在 50–300KB、无 `{{...}}` 残留
- 顶层 name 改为 `Build & Sync`，job name 改为 `build`
- 因为 `dist/` 被 `.gitignore`，CI 构建的 plugin **不会**提交回仓库；只做烟测。release 时再把 plugin 文件附进去（由 `release-latest.yml` 单独处理，本任务不动）

- [ ] **Step 2: 检查 release workflow 是否需要同步**

```bash
cat .github/workflows/release-latest.yml
```

阅读现有 release workflow。如果它已经在打 release zip，确认是否需要把 `dist/claude-like-plugin.html` 也打进去。**如需要**，在该 workflow 的打包步骤里新增：

```yaml
- name: Build plugin
  run: npm run build:plugin

- name: Add plugin to release asset
  run: cp dist/claude-like-plugin.html "$RELEASE_DIR/"
```

具体位置依赖现有 release workflow 结构；本任务**先不强制修改 release workflow**，留到后续 follow-up（写到 Issue 或 TODO）。

- [ ] **Step 3: 本地验证 workflow 文件语法**

```bash
# 安装 actionlint(可选)
# brew install actionlint
# actionlint .github/workflows/sync-css.yml
# 没有 actionlint 也可以用 yamllint 或人工 review
```

- [ ] **Step 4: 提交**

```bash
git add .github/workflows/sync-css.yml
git commit -m "ci: workflow 扩展 — 同时构建 plugin + 产物烟测"
```

- [ ] **Step 5: push 后观察 CI**

```bash
git push
# 然后到 GitHub Actions 页面看运行状态
```

预期：workflow 跑通；如果失败，常见原因：
- esbuild 没装 → 检查 `package-lock.json` 是否提交且包含 esbuild
- 大小超过 300KB → 看 plugin 体积，必要时调阈值或检查是否误打入大文件
- `{{` 残留 → 看 template 是否有意外的双花括号字面量

---

## Self-Review

### 1. Spec 覆盖

| Spec 章节 | 由哪些 task 实现 |
|---|---|
| §3.1 注入机制 | Task 2（template.html） |
| §3.2 仓库布局 | 所有 task 累计 |
| §3.3 构建管道 | Task 2、Task 4 |
| §3.4 用户安装流程 | Task 11（README） |
| §4.1 toc.js | Task 9 |
| §4.2 code-enhance.js | Task 6 |
| §4.3 image-lightbox.js | Task 7 |
| §4.4 footnote.js | Task 8 |
| §4.5 theme-switcher.js | Task 5 |
| §5 SCSS 重构 | Task 1、Task 3 |
| §6 视觉设计语言 | 散布在 Task 5-9 的 CSS 段 |
| §7 错误处理 | Task 4（bootstrap try/catch）+ 每个模块的前置检查 |
| §8.1 sample.md | Task 10 |
| §8.2 CHECKLIST.md | Task 10 |
| §8.3 CI 烟测 | Task 13 |
| §9 归属 | Task 11 + Task 12 |

无遗漏。

### 2. Placeholder scan

无 TODO/TBD/FIXME。Task 6 中 "降级方案" 部分写明了触发条件和应对路径，不算 placeholder（是 conditional alternative）。Task 13 Step 2 显式注明 release workflow 改动延后，写明了"为什么延后",不算遗忘项。

### 3. Type / 命名一致性

- `claude-toc`、`claude-code-copy-btn`、`claude-figure`、`claude-lightbox-overlay`、`claude-footnote-popover`、`claude-theme-switcher` —— 所有控件 CSS class 都使用 `.claude-` 前缀（spec §6 要求），跨任务一致 ✓
- 各模块导出对象 schema 一致：`{ name: string, init(ctx) }`，跨任务一致 ✓
- `STORAGE_KEY = 'claude-theme'` 仅用于 theme-switcher，其他模块不复用，一致 ✓
- `data-theme` 属性名跨 SCSS 与 JS 一致 ✓

### 4. 已知风险点

- **Task 6 行号 CSS 方案**：纯 CSS 多行编号在 Typora 导出的 `<pre><code>` 结构下大概率不工作，已在该任务里写明降级到 JS gutter 的应对，但需要执行者真的去看导出 DOM 决定。
- **Task 8 footnote selector**：依赖 Typora 实际导出的 `<sup><a href="#fn:N">` 结构，已在 Step 1 加了"验证 selector"的步骤。
- **Task 13 release workflow**：明确延后，未在本计划中实施。

无阻塞项。
