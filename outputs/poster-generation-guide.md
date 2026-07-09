# Echo 海报一键生成 — 集成指南

## 架构图

```
用户看到的结果页 (响应式, 宽度自适应)
         │
         │ [用户点击 "生成我的海报"]
         ▼
   usePosterGenerator.generate()
         │
         │ 1. 将隐藏的 PosterCanvas (1080×1920) 临时移入视口
         │ 2. 等一帧让浏览器渲染
         │ 3. html-to-image 截图
         │ 4. 恢复隐藏
         │
         ▼
   拿到 data URL (PNG, 1080×1920)
         │
         │ 设为 <img src={dataUrl}>
         ▼
   全屏预览遮罩
         │
         ├── [保存到相册] → navigator.share (Web Share API)
         │                 └─ 降级 → <a download>
         │
         └── [分享给朋友] → navigator.share({ files: [blob] })
```

## 为什么不用 html2canvas？

| 方案 | 图片质量 | 字体处理 | CORS | 维护状态 |
|------|---------|---------|------|---------|
| **html-to-image** ✅ | 高 (SVG foreignObject) | 系统字体自动 | 同域无问题 | 活跃 |
| html2canvas | 中等 (Canvas 重绘) | 容易丢失 | 复杂 | 维护慢 |
| 后端 Puppeteer | 最高 | 完美 | 无限制 | 需服务器 |

推荐 `html-to-image`：轻量、前端独立、质量足够、无服务器成本。

## 关键设计决策

### 1. 为什么要有 PosterCanvas？

- 用户当前看到的是**响应式布局**（375px 宽的自适应页面）
- 海报需要**固定分辨率**（1080×1920，9:16）
- 同一个页面不可能同时满足两种布局 → **拆成两个 DOM 节点**

### 2. PosterCanvas 为什么是隐藏的？

- `position: fixed; left: -9999px` — 不占视口空间
- `opacity: 0` — 肉眼不可见
- `pointer-events: none` — 不可交互
- 但 **必须在 DOM 树中** — `html-to-image` 需要完整的布局计算

### 3. generate() 时的处理

```
// 截图前几步关键操作：
1. node.style.left = '0px'       // 暂时拉入视口，确保渲染引擎工作
2. await requestAnimationFrame()  // 等一帧完成布局
3. await setTimeout(300ms)        // 额外等图片/emoji/字体加载
4. toPng(node, { pixelRatio: 1 }) // 截图（PosterCanvas 本身已是 1080 原生尺寸）
5. 恢复 left = '-9999px'
```

## 安装与使用

### 1. 安装依赖

```bash
cd Echo && npm install html-to-image
```

### 2. 三个文件

| 文件 | 作用 |
|------|------|
| `src/utils/poster/PosterCanvas.tsx` | 隐藏海报模板组件 |
| `src/utils/poster/usePosterGenerator.ts` | 生成逻辑 hook + 保存函数 |
| `src/utils/poster/PosterPage.tsx` | 完整使用示例（可参考改写） |

### 3. 在路由中注册

```tsx
// App.tsx 或路由配置
import PosterPage from './utils/poster/PosterPage';

<Route path="/onboarding/poster" element={<PosterPage />} />
```

### 4. 接入真实数据

```tsx
// 从后端 GET /onboarding/poster 获取数据
useEffect(() => {
  fetch('/api/onboarding/poster')
    .then(r => r.json())
    .then(setPosterData);
}, []);

// 传给 PosterCanvas
<PosterCanvas ref={posterRef} data={posterData} />
```

## 海报内图片/资源的注意事项

### Emoji 可以正常渲染
PosterCanvas 中的 🦌 等 emoji 会被 html-to-image 正常截取。

### 自定义图片需要同源
如果需要放精灵形象 PNG：
- 放在 `Echo/public/` 下（Vite 同源）
- 或确保 CDN 配置了 CORS

### 字体
PosterCanvas 使用系统字体栈，不依赖外部字体文件，截图稳定性高。

## 兼容性

| 平台 | 截图 | 保存 |
|------|------|------|
| iOS Safari 15+ | ✅ | ✅ Web Share API |
| Android Chrome 100+ | ✅ | ✅ Web Share API |
| Android WebView | ✅ | ⚠️ 需要原生桥接 `savePosterInWebView()` |
| PC Chrome | ✅ | ✅ 触发下载 |

## 后续优化

1. **骨架屏/loading**：`status === 'generating'` 时显示精美 loading 动画
2. **二维码**：在海报底部加小程序/App 下载二维码（`qrcode` npm）
3. **精灵形象预置图**：从 <emoji> 占位替换为 12 个原型的实际 PNG
4. **分享统计**：埋点记录海报生成量、分享量、转化率
