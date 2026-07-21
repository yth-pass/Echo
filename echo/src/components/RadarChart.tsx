/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * RadarChart — 4 维理想型雷达图
 * 零依赖手写 SVG，仿 ProgressRing.tsx 模式。
 * 值域 -1 ~ +1 映射到 0 ~ maxRadius。
 * 维度顺序：情感安全感 / 独立空间 / 直接沟通 / 冲突处理（顺时针，从顶部起）。
 */

import { motion } from 'motion/react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIM_KEYS = [
  'emotionalSafety',
  'spaceRespect',
  'directCommunication',
  'conflictResolution',
] as const;

const DIM_LABELS: Record<string, string> = {
  emotionalSafety: '情感安全感',
  spaceRespect: '独立空间',
  directCommunication: '直接沟通',
  conflictResolution: '冲突处理',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RadarChartProps {
  /** 4 维理想型维度数据，值域 -1 ~ +1。 */
  dimensions: Record<string, number>;
  /** 整体尺寸（像素），默认 240。 */
  size?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RadarChart({ dimensions, size = 240 }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = Math.floor(size / 3); // 80 for size=240
  const numAxes = DIM_KEYS.length;
  const angleStep = (2 * Math.PI) / numAxes; // PI/2 = 90°

  // 4 轴角度：从顶部顺时针（top=emotionalSafety, right=spaceRespect, bottom=directCommunication, left=conflictResolution）
  const angles = DIM_KEYS.map((_, i) => -Math.PI / 2 + i * angleStep);

  // 根据半径 r 计算多边形各顶点坐标
  const ringPoints = (r: number) =>
    angles.map((a) => ({
      x: cx + r * Math.cos(a),
      y: cy + r * Math.sin(a),
    }));

  const maxPoints = ringPoints(maxRadius);

  // 数据点：把 -1 ~ +1 的值映射到 0 ~ maxRadius，缺失维度视作 0
  const dataPoints = DIM_KEYS.map((key, i) => {
    const value = dimensions[key] ?? 0;
    const r = ((value + 1) / 2) * maxRadius;
    return {
      ...ringPoints(r)[i],
      value,
    };
  });

  // SVG path 字符串
  const polyPoints = (pts: { x: number; y: number }[]) =>
    pts.map((p) => `${p.x},${p.y}`).join(' ');

  // 标签位置（maxRadius 外 20px）
  const labelPoints = ringPoints(maxRadius + 20);

  return (
    <div className="flex justify-center py-2">
      <motion.svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        {/* ---- 背景网格多边形（虚线框） ---- */}
        <polygon
          points={polyPoints(maxPoints)}
          fill="none"
          stroke="#d9e3f4"
          strokeWidth={1}
          strokeDasharray="4,3"
        />

        {/* ---- 轴线 ---- */}
        {angles.map((_, i) => (
          <line
            key={`axis-${i}`}
            x1={cx}
            y1={cy}
            x2={maxPoints[i].x}
            y2={maxPoints[i].y}
            stroke="#d9e3f4"
            strokeWidth={1}
          />
        ))}

        {/* ---- 辅助环（50% / 中间值 0 的圆） ---- */}
        <circle
          cx={cx}
          cy={cy}
          r={maxRadius / 2}
          fill="none"
          stroke="#d9e3f4"
          strokeWidth={0.5}
          strokeDasharray="2,4"
        />

        {/* ---- 数据多边形（带入场动画） ---- */}
        <motion.polygon
          points={polyPoints(
            dataPoints.map(({ x, y }) => ({ x, y })),
          )}
          fill="rgba(43, 138, 239, 0.12)"
          stroke="#2B8AEF"
          strokeWidth={2}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        {/* ---- 数据点圆点 ---- */}
        {dataPoints.map((p, i) => (
          <motion.circle
            key={`dot-${i}`}
            cx={p.x}
            cy={p.y}
            r={4}
            fill="#2B8AEF"
            initial={{ opacity: 0, r: 0 }}
            animate={{ opacity: 1, r: 4 }}
            transition={{ duration: 0.25, delay: 0.35 + i * 0.08 }}
          />
        ))}

        {/* ---- 维度标签 + 数值 ---- */}
        {labelPoints.map((lp, i) => {
          const v = dataPoints[i].value;
          return (
            <g key={`label-${i}`}>
              <text
                x={lp.x}
                y={lp.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={10}
                fill="#7b7487"
              >
                <tspan x={lp.x} dy="-0.5em">
                  {DIM_LABELS[DIM_KEYS[i]]}
                </tspan>
                <tspan x={lp.x} dy="1.3em" fill="#2B8AEF" fontWeight={600} fontSize={11}>
                  {v >= 0 ? '+' : ''}{v.toFixed(2)}
                </tspan>
              </text>
            </g>
          );
        })}
      </motion.svg>
    </div>
  );
}
