/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 入驻路由 shim — v1（Legacy）/ v2（四阶段模块化）切换
 * 通过 localStorage key `onboarding_version` 控制：
 *   'v1' → 旧版 M1-M4 向导
 *   其他（默认） → v2 OnboardingShell
 */

import { OnboardingShell } from './v2/OnboardingShell';
import { Onboarding as OnboardingLegacy } from './OnboardingLegacy';

export function Onboarding({ userId, onComplete, onClose }: { userId: string; onComplete: () => void; onClose?: () => void }) {
  const useV2 = (() => {
    try {
      return localStorage.getItem('onboarding_version') !== 'v1';
    } catch {
      return true;
    }
  })();

  if (useV2) {
    return <OnboardingShell userId={userId} onComplete={onComplete} onClose={onClose} />;
  }
  return <OnboardingLegacy onComplete={onComplete} />;
}
