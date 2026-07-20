/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DimensionBars — 理想伴侣维度条形图
 * 纯 Tailwind 实现，value 范围 -1 ~ +1 映射到 0% ~ 100%
 */

import type { IdealPartnerSketchDimensions } from '../onboarding-v2.types';

const DIMENSION_LABELS: Record<keyof IdealPartnerSketchDimensions, string> = {
  emotionalSafety: '情感安全感',
  spaceRespect: '独立空间',
  directCommunication: '直接沟通',
  conflictResolution: '冲突处理',
};

interface DimensionBarsProps {
  dimensions: IdealPartnerSketchDimensions;
}

export function DimensionBars({ dimensions }: DimensionBarsProps) {
  return (
    <div className="space-y-3">
      {(Object.keys(DIMENSION_LABELS) as (keyof IdealPartnerSketchDimensions)[]).map((key) => {
        const value = dimensions[key];
        const percent = Math.round(((value + 1) / 2) * 100);
        return (
          <div key={key}>
            <div className="flex justify-between text-sm mb-1" style={{ color: '#121c28' }}>
              <span>{DIMENSION_LABELS[key]}</span>
              <span>{percent}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#d9e3f4' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${percent}%`, backgroundColor: '#2B8AEF' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
