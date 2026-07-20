/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LottieLoader — 全局加载动画组件
 * 消费 public/animations/search-lottie.json
 * 替代各加载页面的 emoji / 图标占位
 */

import Lottie from 'lottie-react';
import searchLottie from '../assets/lottie/search-lottie.json';

/**
 * 通用 Lottie 加载动画。
 * - size: 宽度（像素），高度按动画原始宽高比自动计算
 * - className: 额外 Tailwind 类（如 mb-1）
 */
export function LottieLoader({
  size = 480,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  const ratio = (searchLottie as { h: number; w: number }).h / (searchLottie as { w: number }).w;
  const h = Math.round(size * ratio);

  return (
    <div
      className={`mx-auto ${className}`}
      style={{ width: size, height: h }}
    >
      <Lottie
        animationData={searchLottie}
        loop
        autoplay
        style={{ width: size, height: h }}
      />
    </div>
  );
}
