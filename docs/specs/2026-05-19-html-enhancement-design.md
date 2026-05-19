# Claude-Like Theme — HTML 增强设计文档

- **创建日期**：2026-05-19
- **状态**：Brainstorming 阶段已批准，待进入 writing-plans
- **参考项目**：[VLOOK](https://github.com/MadMaxChow/VLOOK)（MIT）

---

## 1. 目标

为本 Typora 主题在**导出 HTML**场景下提供与 Claude.ai 阅读体验风格统一的浏览端增强。读者在浏览器里打开导出文件时，能获得目录导航、代码工具、图片放大、脚注预览、主题切换这些 SPA 级别的体验，而无需依赖 Typora 本身。

**成功标准**：

- 安装路径：用户只需把 `dist/claude-like-plugin.html` 复制粘贴到 Typora 的 "导出设置 ▸ HTML ▸ 在 `<head/>` 中添加" 一次
- 视觉一致性：导出后的控件（TOC、按钮、popover、lightbox）与现有三套主题（light/grey/dark）的色板、圆角、阴影完全协调
- 离线可用：导出 HTML 在无网络环境下功能完整
- 单模块故障不影响整页加载与渲染

---

## 2. 非目标 / 范围外

下列 VLOOK 提供的功能 **MVP 不做**，理由是占代码量大且使用场景小众：

- 演示模式（presentation mode）
- 水印
- 自定义封面
- 文档全文搜索
- 图片拖拽与缩放交互（lightbox 仅支持点开看大图）
- 多语言（i18n）：UI 文案直接使用中文，后期若开源覆盖海外用户再考虑英文
- 标题自动编号（h1 → 1，h1.h2 → 1.1）—— 不做
- Live 分发模式（CDN 加载主 JS）—— 仅做 Standalone

---

## 3. 架构

### 3.1 注入机制

Typora 的「自定义 HTML 导出配置」支持 **"Append in `<head/>`"** 字段：用户粘贴任意 HTML/JS/CSS 到此处，Typora 导出时将其原样拼到生成的 HTML 的 `<head>` 内。

我们利用这一点，将一整段包含 inline `<style>` 与 `<script>` 的 HTML 提供给用户粘贴。读者打开导出文件时，浏览器执行内嵌 JS，扫描 Typora 已经渲染好的 DOM，注入增强控件。

**关键属性**：JS 完全跑在浏览器侧，不依赖 Typora 运行时；与现有 CSS 主题（在 Typora 编辑器内生效）解耦，是两套独立产物。

### 3.2 仓库布局

```
.
├── claude-like.css                  # 现有 CSS 产物，不变
├── claude-like-grey.css
├── claude-like-dark.css
├── scss/
│   ├── _base.scss                   # 现有结构 CSS（用 var(--xxx)）
│   ├── _palettes.scss               # 【新增】三套色值 mixin
│   ├── claude-like.scss             # 重构：@include palettes.light
│   ├── claude-like-grey.scss
│   ├── claude-like-dark.scss
│   └── plugin.scss                  # 【新增】[data-theme] 变体 + 控件 CSS
├── js/                              # 【新增】JS 模块
│   ├── _bootstrap.js
│   ├── toc.js
│   ├── code-enhance.js
│   ├── image-lightbox.js
│   ├── footnote.js
│   └── theme-switcher.js
├── plugin/
│   └── template.html                # 【新增】<head/> 注入模板
├── scripts/
│   └── build-plugin.mjs             # 【新增】构建脚本
├── dist/                            # 【新增】gitignored；release 时附带
│   └── claude-like-plugin.html
├── test/                            # 【新增】测试材料
│   ├── sample.md
│   └── CHECKLIST.md
├── LICENSE                          # 现有（Muyiiiii MIT）
├── LICENSE-VLOOK                    # 【新增】VLOOK MIT 副本
├── package.json
└── ...
```

### 3.3 构建管道

`package.json` 在现有 `sass` 命令基础上追加：

```jsonc
{
  "scripts": {
    "build": "npm run build:css && npm run build:plugin",
    "build:css": "<现有 sass 命令>",
    "build:plugin": "node scripts/build-plugin.mjs"
  },
  "devDependencies": {
    "sass": "^1.77.0",
    "esbuild": "^0.21.0"
  }
}
```

`scripts/build-plugin.mjs` 流程：

1. 用 `sass` Node API 编译 `scss/plugin.scss` → CSS 字符串
2. 用 `esbuild` 合并 + minify `js/*.js`（`_bootstrap.js` 排首位）→ JS 字符串
3. 读 `plugin/template.html`，替换 `{{PLUGIN_CSS}}`、`{{PLUGIN_JS}}`、`{{VERSION}}` 三个占位符
4. 写到 `dist/claude-like-plugin.html`

### 3.4 用户安装流程

1. 主题 CSS：拷 `claude-like.css` / `claude-like-grey.css` / `claude-like-dark.css` 到 Typora 主题目录（同现状）
2. HTML 增强：
   - 打开 release 附带的 `claude-like-plugin.html`，全选复制
   - Typora 偏好设置 ▸ 导出 ▸ 新建 HTML 配置 ▸ 在 `<head/>` 中添加：粘贴
3. 从这个自定义导出配置导出文档时，HTML 自动带增强

---

## 4. 模块设计

5 个模块均以 `init(ctx)` 为入口，由 `_bootstrap.js` 在 `DOMContentLoaded` 时按顺序调用。`ctx` 提供共享对象（logger、版本号、配置读取器）。所有控件 CSS 类名以 `.claude-` 前缀命名空间隔离。

### 4.1 `toc.js` — 浮动 TOC + 章节高亮

- **DOM 输入**：`#write h1, h2, h3, h4, h5, h6`
- **DOM 输出**：`<body>` 内注入 `<aside class="claude-toc">`，固定在**左侧**（宽 220px，可折叠成 28px 窄条）
- **滚动联动**：`IntersectionObserver` 监听各 heading；当前可见的最顶层标题对应的 TOC 项加 `.is-active`
- **点击**：`scrollIntoView({ behavior: 'smooth' })` + 更新 `location.hash`
- **响应式**：视口宽度 < 1100px 时默认折叠，点击展开为 overlay
- **DOM 选择器与 Typora 输出对齐**：导出 HTML 的 `#write` 容器结构与 Typora 编辑器内一致，可放心选

### 4.2 `code-enhance.js` — 复制按钮 + 行号

- **DOM 输入**：`pre[class*="language-"]` 或 `pre > code`（导出后 CodeMirror 已被 Typora 转为静态 `<pre>`；实际选择器需在原型阶段对真实导出验证）
- **复制按钮**：每个 `<pre>` 右上角注入 `<button class="claude-code-copy-btn">`，点击通过 `navigator.clipboard.writeText()` 复制；2 秒内按钮文本切换为 "✓"，然后回弹
- **行号**：通过 CSS `counter-reset` + `pre code > span::before`（或类似伪元素）渲染，**不改动 DOM 节点**，保证用户复制时不带行号
- 后续可选：长代码块（> 600px）加"展开/收起"按钮 —— 不进 MVP

### 4.3 `image-lightbox.js` — 图片放大 + caption

- **DOM 输入**：`#write img:not(.no-lightbox)`
- **inline caption**：将每个 `<img alt="xxx">` 包裹为 `<figure>`，把 `alt` 文本渲染为 `<figcaption>` 显示在图片**下方**（居中，字号比正文小一档）
- **点击行为**：点图片 → 全屏 overlay 显示原图 + caption；Esc 键 / 点 overlay 空白区域关闭
- **MVP 限制**：不实现拖拽、缩放、键盘左右翻图；仅"点开看大图"。后期可补
- **图片懒加载**：通过 `loading="lazy"` 属性，无需 JS 参与

### 4.4 `footnote.js` — 脚注 popover

- **DOM 输入**：`sup > a[href^="#fn"]`（脚注引用）+ `section.footnotes`（脚注容器）—— 选择器需对 Typora 实际导出验证
- **行为**：鼠标 hover 0.4 秒后浮窗显示对应脚注内容；离开/按 Esc 关闭；移动端改为 tap toggle
- **样式**：圆角矩形 + 阴影 + 左侧 3px `var(--accent-color)` 强调条（与 blockquote 视觉语言一致）
- **跳转保留**：点击仍执行原生跳转到页脚位置

### 4.5 `theme-switcher.js` — light/grey/dark 切换器

- **DOM 输出**：`<body>` 注入 `<div class="claude-theme-switcher">`，右上角三色小圆点（或图标）
- **切换逻辑**：点击后给 `<html>` 设 `data-theme="light|grey|dark"`；plugin.scss 中对应的 `html[data-theme="..."]` 块接管色值
- **持久化**：选择写入 `localStorage` 的 `claude-theme` 键；下次打开同一域名下的导出 HTML 时自动恢复
- **初始状态**：如有 localStorage 值用之；否则不设 `data-theme`，沿用 Typora 导出时内嵌的 `:root` 主题

---

## 5. SCSS 重构（Option β）

将三套色值从单文件 `:root` 抽到共享 mixin，让 plugin.scss 也能复用，避免色值在两处维护不同步。

### 5.1 `scss/_palettes.scss`（新增）

```scss
@mixin light {
  --bg-color: #faf9f5;
  --heading-color: #1c1815;
  // ... 全部约 50 个变量
}

@mixin grey { /* 对应色值 */ }

@mixin dark { /* 对应色值 */ }
```

### 5.2 三个主题文件（重构）

```scss
// scss/claude-like.scss
@use 'palettes';
@use 'base';

:root {
  @include palettes.light;
}
```

`claude-like-grey.scss` / `claude-like-dark.scss` 同形结构。

### 5.3 `scss/plugin.scss`（新增）

```scss
@use 'palettes';

html[data-theme="light"] { @include palettes.light; }
html[data-theme="grey"]  { @include palettes.grey; }
html[data-theme="dark"]  { @include palettes.dark; }

// 控件 CSS
.claude-toc { /* ... */ }
.claude-code-copy-btn { /* ... */ }
.claude-lightbox-overlay { /* ... */ }
.claude-footnote-popover { /* ... */ }
.claude-theme-switcher { /* ... */ }
```

### 5.4 特异性推理

| 选择器 | 特异性 |
|---|---|
| `:root` | (0, 0, 1, 0) |
| `html[data-theme="light"]` | (0, 0, 1, 1) |

`html[data-theme]` 胜出。所以导出 HTML 的初始状态使用 Typora 内嵌的 `:root` 主题，用户点切换器后 plugin.scss 的 `[data-theme]` 块接管。

### 5.5 兼容性验证

重构后 Typora 编辑器内的渲染必须与重构前完全一致 —— 三个 `claude-like-*.scss` 单独编译时仍输出与之前 byte-level 接近的 CSS（仅是源码组织变化）。CI 可加 diff 校验。

---

## 6. 视觉设计语言

控件视觉与现有主题（圆角胶囊表格、左竖线 blockquote、4px 圆角 inline code）保持一致。

| 属性 | 取值 | 用途 |
|---|---|---|
| 控件字体 | `var(--font-ui)`（PingFang SC / Segoe UI） | 按钮、TOC 项、tooltip —— 用系统 UI 字体，正文 serif 不延伸到控件 |
| 圆角 | 6px | TOC 项、popover、按钮、lightbox 容器 |
| 浮层阴影 | `0 4px 16px rgba(0,0,0,0.08)` (light/grey) / `0 4px 16px rgba(0,0,0,0.32)` (dark) | TOC、popover、lightbox |
| 强调色 | `var(--accent-color)` | 当前章节高亮、按钮 hover、popover 左竖条 |
| 内边距 | 8px / 12px / 16px 三档 | 同表格 cell padding 模式 |
| 过渡 | `transition: all 0.18s ease` | TOC 折叠、popover 出现、按钮反馈 |
| z-index 分层 | TOC 100 / popover 200 / lightbox 999 | 互不遮挡 |

---

## 7. 错误处理与降级

`_bootstrap.js` 用 try/catch 包裹每个模块 `init()`，单模块异常不影响其他模块：

```js
const modules = [tocModule, codeEnhanceModule, imageLightboxModule, footnoteModule, themeSwitcherModule];
for (const mod of modules) {
  try {
    mod.init(ctx);
  } catch (e) {
    console.warn(`[claude-plugin] ${mod.name} failed:`, e);
  }
}
```

每个模块自带前置检查，缺失能力时安静退出（仅 `console.info`）：

| 模块 | 缺失能力 | 降级行为 |
|---|---|---|
| `toc.js` | `IntersectionObserver` 缺失 | TOC 仍渲染，无活动章节高亮 |
| `code-enhance.js` | `navigator.clipboard` 缺失 | 按钮变灰，tooltip 提示"浏览器不支持" |
| `image-lightbox.js` | 文档无 `<img>` | 不初始化 |
| `footnote.js` | 文档无 `section.footnotes` | 不初始化 |
| `theme-switcher.js` | `localStorage` 不可用（隐私模式） | 可切但不持久化 |

---

## 8. 测试

### 8.1 `test/sample.md`

一份覆盖全部特性的 markdown：

- 六级标题层级
- 多种语言的代码块（JS、Python、Bash、JSON）
- 含 caption 的图片
- 脚注引用与脚注定义
- 嵌套 blockquote
- 跨行表格、行内代码、加粗、斜体
- 数学公式（如主题 CSS 已支持）

每次发版前，**手工**在 Typora 用三个主题各导出一次 HTML，肉眼对照 `test/CHECKLIST.md`。

### 8.2 `test/CHECKLIST.md`

每个特性一条 checkbox，例：

- [ ] TOC 显示 h1–h3，h4+ 不显示
- [ ] 滚动时 TOC 高亮当前章节
- [ ] 视口 < 1100px 时 TOC 默认折叠
- [ ] 代码块右上角复制按钮，点击 2 秒内显 ✓
- [ ] 代码块左侧行号显示，复制时不带入
- [ ] 图片点击放大，Esc 关闭，alt 文本作 caption
- [ ] 脚注 hover 0.4s 出 popover，离开关闭
- [ ] 主题切换器在三色间循环，刷新后记忆选择
- [ ] 三种主题下控件视觉协调（无色板冲突）

### 8.3 CI 构建烟测

`.github/workflows/sync-css.yml` 追加：

- `npm run build:plugin` 必须成功
- `dist/claude-like-plugin.html` 必须存在
- 文件大小在 [50KB, 300KB] 范围内（防 build 静默坏）

### 8.4 未来可加（不进 MVP）

- jsdom + Vitest 对每个 JS 模块跑单元测试
- Playwright headless 加载真实导出 HTML 做 e2e

---

## 9. 归属与许可证

派生链条：**Muyiiiii**（原 Typora 主题，MIT）→ **当前仓库**（前期魔改 + 新加 HTML 增强）→ **VLOOK**（HTML 增强参考源，MIT）。

| 位置 | 内容 |
|---|---|
| `LICENSE`（现存） | 不动，Muyiiiii 的 MIT 声明保留 |
| `LICENSE-VLOOK`（新增） | 逐字拷贝 VLOOK 仓库的 LICENSE 文件，包含 MAX°Chow 的版权 |
| `README.md` 末尾 | Acknowledgments 章节：派生自 Muyiiiii 原主题（链接）+ HTML 增强参考 VLOOK（链接） |
| `js/*.js` 文件头 | 若模块逻辑参考了 VLOOK 的具体函数/模块，在 JSDoc 注释里写 `Adapted from VLOOK/plugin.txt - <module>`；纯自写的模块不写 |
| 运行时 UI | **完全不出现** "VLOOK" 字样 |

VLOOK MIT 协议硬性要求：保留版权声明与许可证文本。两条都通过 `LICENSE-VLOOK` 满足。

---

## 10. 未决问题与未来工作

- **Live 分发模式**：MVP 仅 Standalone；如未来有用户反馈需要 CDN 加载，架构兼容（plugin.template.html 拆出 bootloader 即可）
- **图片 lightbox 增强**：拖拽、缩放、键盘左右翻图，等 MVP 发布后看使用反馈
- **多语言**：UI 文案目前硬编中文。若海外用户增加，考虑 `data-lang` 属性 + 文案 map
- **标题自动编号**：VLOOK 提供，目前不做。如有需求可加 `numbering.js` 模块
- **演示模式 / 水印 / 封面**：明确不在 MVP，无近期计划
