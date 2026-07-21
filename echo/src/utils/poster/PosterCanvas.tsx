/**
 * PosterCanvas — 隐藏的海报模板组件
 *
 * 原理：在页面中渲染一个固定 1080×1920 的 DOM 节点（不可见但存在于 DOM 树），
 * 然后由 usePosterGenerator hook 用 html-to-image 截取 → 输出图片。
 *
 * 为什么这样做：
 * - 用户在手机上看的是响应式布局（自适应宽度）
 * - 海报需要固定的 9:16 高分辨率（1080×1920）
 * - 把两个布局分开：页面 UI 用 Tailwind 响应式；海报用绝对 px
 *
 * 用法：在所有页面内容下方渲染一个 <PosterCanvas data={...} ref={posterRef} />
 *       它不可见（position:fixed; opacity:0），但可以参与 DOM 截图。
 */

import { forwardRef, useMemo } from 'react';

export interface PosterData {
  elfName: string;
  elfCode: string;
  primaryColor: string;
  secondaryColor: string;
  declaration: string;
  personalKeywords: string[];
  idealKeywords: string[];
}

// ⚠️ 海报内的所有字号/间距都用 px，不要用 rem/em/%
//    因为在绝对定位的 1080×1920 容器内 rem 不可控。

const STYLE = {
  canvas: {
    position: 'fixed' as const,
    top: 0,
    left: '-9999px',       // 完全移出视口
    width: 1080,
    height: 1920,
    overflow: 'hidden' as const,
    pointerEvents: 'none' as const,
    opacity: 0,            // 备用人眼不可见
  } satisfies React.CSSProperties,
} as const;

function hexToRGBA(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const PosterCanvas = forwardRef<HTMLDivElement, { data: PosterData }>(
  function PosterCanvas({ data }, ref) {
    const { primaryColor, secondaryColor, elfName, elfCode, declaration, personalKeywords, idealKeywords } = data;

    const bgGradient = useMemo(
      () => `linear-gradient(170deg, ${hexToRGBA(primaryColor, 0.06)} 0%, ${hexToRGBA(primaryColor, 0.12)} 45%, ${hexToRGBA(primaryColor, 0.18)} 100%)`,
      [primaryColor],
    );

    return (
      <div ref={ref} style={STYLE.canvas}>
        <div
          style={{
            width: 1080,
            height: 1920,
            padding: '72px 80px 80px',
            display: 'flex',
            flexDirection: 'column',
            background: bgGradient,
            position: 'relative',
            fontFamily:
              '-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif',
            color: '#2D2A26',
            boxSizing: 'border-box' as const,
          }}
        >
          {/* === TOP BAR === */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 60 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  background: primaryColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 28,
                  fontWeight: 700,
                }}
              >
                E
              </div>
              <span style={{ fontSize: 32, fontWeight: 700, color: primaryColor }}>Echo</span>
            </div>
            <div
              style={{
                fontSize: 22,
                color: '#8A837C',
                background: 'rgba(255,255,255,0.7)',
                padding: '10px 24px',
                borderRadius: 999,
              }}
            >
              Phase 1 入驻结果
            </div>
          </div>

          {/* === HERO: 精灵名称 === */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontSize: 72, fontWeight: 800, color: primaryColor, margin: 0, lineHeight: 1.1 }}>
              {elfName}
            </h2>
            <div style={{ fontSize: 26, color: '#8A837C', marginTop: 12, letterSpacing: 4 }}>{elfCode}</div>
          </div>

          {/* === HERO: 精灵占位图 === */}
          <div
            style={{
              width: 360,
              height: 360,
              borderRadius: 180,
              margin: '0 auto 48px',
              background: hexToRGBA(primaryColor, 0.15),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 100,
            }}
          >
            🦌
          </div>

          {/* === 宣言 === */}
          <div
            style={{
              background: 'rgba(255,255,255,0.65)',
              borderRadius: 40,
              padding: '40px 48px',
              textAlign: 'center',
              marginBottom: 36,
            }}
          >
            <div style={{ fontSize: 22, color: '#8A837C', marginBottom: 12 }}>你的回声</div>
            <p style={{ fontSize: 36, lineHeight: 1.55, margin: 0, fontWeight: 500 }}>
              <span style={{ color: primaryColor, opacity: 0.4, fontSize: 48 }}>“</span>
              {declaration}
              <span style={{ color: primaryColor, opacity: 0.4, fontSize: 48 }}>”</span>
            </p>
          </div>

          {/* === 我的关键字 === */}
          <div
            style={{
              background: 'rgba(255,255,255,0.7)',
              borderRadius: 40,
              padding: '36px 40px',
              marginBottom: 28,
            }}
          >
            <div style={{ fontSize: 24, color: '#8A837C', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 12, height: 12, borderRadius: 6, background: primaryColor, display: 'inline-block' }}></span>
              我的关键字
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {personalKeywords.map((kw) => (
                <span
                  key={kw}
                  style={{
                    fontSize: 26,
                    padding: '14px 28px',
                    borderRadius: 999,
                    background: hexToRGBA(primaryColor, 0.12),
                    color: primaryColor,
                    fontWeight: 500,
                    whiteSpace: 'nowrap' as const,
                  }}
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>

          {/* === 我想遇见 === */}
          <div
            style={{
              background: 'rgba(255,255,255,0.7)',
              borderRadius: 40,
              padding: '36px 40px',
              marginBottom: 28,
            }}
          >
            <div style={{ fontSize: 24, color: '#8A837C', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 12, height: 12, borderRadius: 6, background: secondaryColor, display: 'inline-block' }}></span>
              我想遇见
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {idealKeywords.map((kw) => (
                <span
                  key={kw}
                  style={{
                    fontSize: 26,
                    padding: '14px 28px',
                    borderRadius: 999,
                    background: hexToRGBA(secondaryColor, 0.12),
                    color: secondaryColor,
                    fontWeight: 500,
                    whiteSpace: 'nowrap' as const,
                  }}
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>

          {/* === 免责声明 === */}
          <div style={{ marginTop: 'auto', textAlign: 'center' }}>
            <p style={{ fontSize: 20, color: '#8A837C', opacity: 0.7, margin: 0 }}>
              这些词是你此刻的回声，不是定义。
            </p>
          </div>
        </div>
      </div>
    );
  },
);

export default PosterCanvas;
