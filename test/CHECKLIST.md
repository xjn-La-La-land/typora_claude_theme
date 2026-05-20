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

- [ ] 左侧 TOC 出现,默认展开 h1-h3,h3 以下被折叠
- [ ] 每个有子项的节点左侧有 chevron,点击可展开/收起本枝
- [ ] 展开 h3 节点后能看到 h4-h6
- [ ] 滚动时当前章节高亮
- [ ] 点击 TOC 项平滑滚动到对应位置
- [ ] URL hash 更新
- [ ] 视口缩到 < 1100px,TOC 自动折叠为侧边 ≡
- [ ] 点 ≡ 按钮可展开/收起整个面板
- [ ] 拖右边缘可调整 TOC 宽度,刷新后宽度保留

## Code

- [ ] 代码块右上角 hover 出"复制"按钮
- [ ] 点击复制 → 显 ✓ 2 秒后回弹
- [ ] 系统级 Cmd+C 复制代码 → 粘贴不含行号
- [ ] 行号显示在每行左侧
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
