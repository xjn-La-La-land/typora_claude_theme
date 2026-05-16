# Claude-Like Theme

> [English Version Below](#english-version)

![light](image/2026-03-11-claude-like-theme/light.png)

![grey](image/2026-03-11-claude-like-theme/grey.png)

![dark](image/2026-03-11-claude-like-theme/dark.png)

一个以 Claude-like 阅读体验为灵感、并针对中文写作重新打磨的 Typora 主题。现提供浅色、Morandi 灰蓝、深色三个版本。

## 文件说明

- `claude-like.css`：浅色主题
- `claude-like-grey.css`：Morandi 灰蓝主题
- `claude-like-dark.css`：深色主题

以上三个 CSS 文件由 `scss/` 目录下的 SCSS 源文件编译生成。每个变体只维护自己的 `:root` 调色板，所有结构样式集中在 `scss/_base.scss`。

## 开发与构建

```bash
npm install         # 安装 sass
npm run build       # 编译一次，输出三个 CSS 文件
npm run watch       # 监听源文件变化，自动编译
```

修改主题时只需要编辑 `scss/` 下的源文件，提交前运行 `npm run build` 重新生成根目录的 CSS。

## 协议

本项目基于 MIT 协议开源，详见根目录 [LICENSE](LICENSE) 文件。

---

`<a id="english-version"></a>`

# Claude-like Theme

A Typora theme inspired by a Claude-like reading experience, refined for Chinese writing and technical Markdown workflows. It ships in three variants: light, a Morandi gray-blue grey, and dark.

## Installation

You can also download the latest theme files directly from the GitHub Releases page.

1. Open Typora.
2. Go to `Preferences -> Appearance -> Open Theme Folder`.
3. Copy the following files into the theme folder:

   - `claude-like.css`
   - `claude-like-grey.css`
   - `claude-like-dark.css`
4. Restart Typora.
5. Choose one of the following from the Theme menu:

   - `Claude-like`
   - `Claude-like Grey`
   - `Claude-like Dark`

> **Recommended setting (Windows)**: Go to `Preferences -> Appearance` and set **Window Style** to **Unibody** (restart Typora to apply). The theme is optimized for Unibody mode on Windows.

It is not a direct clone of a webpage. Instead, it keeps the calm, restrained, long-form reading atmosphere associated with a Claude-like style, while reworking typography, tables, code blocks, and export behavior for practical Markdown use.


## Files

- `claude-like.css`: light theme
- `claude-like-grey.css`: Morandi gray-blue theme
- `claude-like-dark.css`: dark theme

The three CSS files are compiled from SCSS sources under `scss/`. Each variant only maintains its own `:root` palette; all structural styles live in `scss/_base.scss`.

## Development

```bash
npm install         # install sass
npm run build       # compile once
npm run watch       # rebuild on change
```

When editing the theme, modify the files in `scss/` and run `npm run build` to regenerate the top-level CSS files before committing.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.