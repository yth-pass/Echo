/**
 * usePosterGenerator
 *
 * 把 PosterCanvas 的 DOM 节点截取为图片，管理生成状态和结果。
 *
 * 依赖：npm install html-to-image
 *
 * 用法：
 *   const { posterRef, generate, status, imageUrl, error } = usePosterGenerator();
 *   // 在 JSX 中：<PosterCanvas ref={posterRef} data={...} />
 *   // 点击按钮：await generate()
 *   // 拿到图片：<img src={imageUrl} />
 */

import { useRef, useState, useCallback } from 'react';
import { toPng, toJpeg } from 'html-to-image';

export type PosterStatus = 'idle' | 'generating' | 'ready' | 'error';

interface UsePosterGeneratorReturn {
  posterRef: React.RefObject<HTMLDivElement | null>;
  generate: () => Promise<string | null>;
  status: PosterStatus;
  imageUrl: string | null;
  error: string | null;
  reset: () => void;
}

export function usePosterGenerator(): UsePosterGeneratorReturn {
  const posterRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<PosterStatus>('idle');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setImageUrl(null);
    setError(null);
  }, []);

  const generate = useCallback(async (): Promise<string | null> => {
    const node = posterRef.current;
    if (!node) {
      setError('海报节点未挂载');
      setStatus('error');
      return null;
    }

    setStatus('generating');
    setError(null);

    try {
      // 先让节点可见（html-to-image 需要渲染内容）
      const originalStyle = {
        left: node.style.left,
        opacity: node.style.opacity,
        pointerEvents: node.style.pointerEvents,
      };

      // 暂时拉入视口（但仍保持不可交互），确保字体/图片已渲染
      node.style.left = '0px';
      node.style.opacity = '0';  // 仍不可见
      node.style.pointerEvents = 'none';

      // 等一帧让浏览器布局完成
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => setTimeout(r, 300)); // 额外等待图片/字体加载

      // 截图
      const dataUrl = await toPng(node, {
        quality: 0.95,
        pixelRatio: 1, // PosterCanvas 已经按 1080 原生尺寸渲染
        skipFonts: true, // 中文字体用系统字体，不内嵌
      });

      // 恢复原位
      node.style.left = originalStyle.left;
      node.style.opacity = originalStyle.opacity;
      node.style.pointerEvents = originalStyle.pointerEvents;

      setImageUrl(dataUrl);
      setStatus('ready');
      return dataUrl;
    } catch (e) {
      // 恢复原位
      const node = posterRef.current;
      if (node) {
        node.style.left = '-9999px';
        node.style.opacity = '0';
        node.style.pointerEvents = 'none';
      }

      const message = e instanceof Error ? e.message : '海报生成失败';
      setError(message);
      setStatus('error');
      return null;
    }
  }, []);

  return { posterRef, generate, status, imageUrl, error, reset };
}

/**
 * 保存图片到手机相册（Web）
 *
 * 移动端浏览器通常不能直接写入系统相册。
 * 策略：
 * 1. Web Share API（iOS Safari / Android Chrome 均支持）→ 调用系统分享菜单
 * 2. 降级：触发下载
 */
export async function savePosterToAlbum(dataUrl: string): Promise<void> {
  // 将 data URL 转为 Blob
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const file = new File([blob], 'echo-poster.png', { type: 'image/png' });

  // 方案 1：Web Share API（iOS/Android 原生分享菜单里可以选"保存图片"）
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: '我的回声精灵',
      });
      return; // 成功
    } catch {
      // 用户取消或失败时走降级
    }
  }

  // 方案 2：降级 → 触发下载
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = 'echo-poster.png';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 在 WebView 中保存（Android）
 *
 * 如果 App 是 WebView 套壳，可以 postMessage 给原生层：
 *
 *   window.Android.saveImage(dataUrl);
 *
 * 原生侧拿到 base64/dataUrl 后用 MediaStore API 写入相册。
 */
export function savePosterInWebView(dataUrl: string): void {
  // 去除 data:image/png;base64, 前缀
  const base64 = dataUrl.split(',')[1];

  // Android WebView 示例
  try {
    (window as any).Android?.saveImage?.(base64);
  } catch {
    // 原生桥接不可用
  }

  // iOS WKWebView 示例（需要原生侧注册 messageHandler）
  try {
    (window as any).webkit?.messageHandlers?.saveImage?.postMessage?.(base64);
  } catch {
    // 原生桥接不可用
  }
}
