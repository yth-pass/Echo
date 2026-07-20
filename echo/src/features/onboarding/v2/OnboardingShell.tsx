/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * OnboardingShell — v2 入驻状态机壳
 * 管理 phase 切换、session 持久化、退出/恢复
 */

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { LottieLoader } from '../../../components/LottieLoader';
import { Phase0Identity } from './Phase0Identity';
import { Phase1Cards } from './Phase1Cards';
import { Phase1_5Sketch } from './Phase1_5Sketch';
import { Phase1_6IdealSketch } from './Phase1_6IdealSketch';
import { Phase2Roleplay } from './Phase2Roleplay';
import { Finalize } from './Finalize';
import { useOnboardingSession } from './useOnboardingSession';
import type { OnboardingPhase, OnboardingSession } from './onboarding-v2.types';
import { PHASE_ORDER } from './onboarding-v2.types';
import { generateAgentProfiles, getOnboardingProgress } from './onboarding-v2.api';

function nextPhase(current: OnboardingPhase): OnboardingPhase | null {
  const idx = PHASE_ORDER.indexOf(current);
  return idx < PHASE_ORDER.length - 1 ? PHASE_ORDER[idx + 1] : null;
}

export function OnboardingShell({ userId, onComplete, onClose }: { userId: string; onComplete: () => void; onClose?: () => void }) {
  const { session, loading, restore, save, clear } = useOnboardingSession(userId);
  const [phase, setPhase] = useState<OnboardingPhase>('phase0');
  const [ready, setReady] = useState(false);
  const [phaseError, setPhaseError] = useState<string | null>(null);
  const [gender, setGender] = useState<string | undefined>();

  // phase 切换时重新读取性别（Phase 0 提交后才写入，mount 时读不到）
  useEffect(() => {
    try {
      const g = localStorage.getItem('echo_onboarding_gender');
      if (g) setGender(g);
    } catch { /* silent */ }
  }, [phase]);

  // mount → 恢复 session
  // D1 修复：优先调后端 getOnboardingProgress 拿权威 currentPhase + 字段，降级到 localStorage
  // 解决场景：跨设备/清缓存后 localStorage 丢失，但后端 OnboardingSession 仍 active
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const progress = await getOnboardingProgress();
        if (cancelled) return;

        if (progress.hasActiveSession && progress.currentPhase) {
          // 后端有 active session → 用后端的 phase（权威）
          const targetIdx = PHASE_ORDER.indexOf(progress.currentPhase);
          if (targetIdx >= 0) {
            const completedPhases = PHASE_ORDER.slice(0, targetIdx);
            const newSession: OnboardingSession = {
              phase: progress.currentPhase,
              completedPhases,
              savedAt: new Date().toISOString(),
            };
            save(newSession);
            // 把后端的字段数据缓存到 localStorage（让 Phase0Identity / Phase1Cards mount 时能读）
            if (progress.phase0Data) {
              try {
                localStorage.setItem(
                  `onboarding_phase0_formdata_${userId}`,
                  JSON.stringify(progress.phase0Data),
                );
              } catch { /* silent */ }
            }
            if (progress.phase1Responses && progress.phase1Responses.length > 0) {
              try {
                localStorage.setItem(
                  `onboarding_phase1_responses_${userId}`,
                  JSON.stringify({
                    index: 0, // 从第一卡开始，但 responses 已恢复
                    responses: progress.phase1Responses,
                  }),
                );
              } catch { /* silent */ }
            }
            // 同步 phase2CompletedRoles（让 Phase2Roleplay mount 时有初始值）
            if (progress.phase2CompletedRoles && progress.phase2CompletedRoles.length > 0) {
              try {
                localStorage.setItem(
                  `echo_phase2_completed_${userId}`,
                  JSON.stringify(progress.phase2CompletedRoles),
                );
              } catch { /* silent */ }
            }
            // 同时调 restore 让 useOnboardingSession 内部 state 与 newSession 同步
            await restore();
            setReady(true);
            return;
          }
        }
      } catch (e) {
        console.warn('[OnboardingShell] getOnboardingProgress failed, fallback to localStorage:', e);
      }
      // 降级：原有 localStorage 恢复
      await restore();
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [restore, save, userId]);

  // session 恢复后设置 phase（校验有效性）
  useEffect(() => {
    if (!ready) return;
    if (session?.phase) {
      const targetIdx = PHASE_ORDER.indexOf(session.phase);
      // 校验：当前 phase 之前的所有 phase 都必须在 completedPhases 中
      const allPriorDone = PHASE_ORDER.slice(0, targetIdx).every(
        (p) => session.completedPhases.includes(p),
      );
      if (allPriorDone) {
        setPhase(session.phase);
      } else {
        // session 数据不一致（可能是其他用户残留），从头开始
        clear();
        setPhase('phase0');
      }
    }
  }, [ready, session, clear]);

  // 保存并推进 phase
  const advancePhase = useCallback(
    (currentPhase: OnboardingPhase) => {
      const np = nextPhase(currentPhase);
      if (!np) {
        // 全部完成
        clear();
        onComplete();
        return;
      }

      // Phase 1.6 → Phase 2：后台生成个性化角色档案（静默，不阻塞）
      if (currentPhase === 'phase1_6') {
        generateAgentProfiles().catch((err) => {
          console.warn('[OnboardingShell] generateAgentProfiles failed:', err);
        });
      }

      const newSession: OnboardingSession = {
        phase: np,
        completedPhases: [...(session?.completedPhases ?? []), currentPhase],
        savedAt: new Date().toISOString(),
      };
      save(newSession);
      setPhase(np);
    },
    [session, save, clear, onComplete],
  );

  // 跳回指定阶段并携带错误信息
  const goBackToPhase = useCallback(
    (targetPhase: OnboardingPhase, errorMessage?: string) => {
      setPhaseError(errorMessage ?? null);
      setPhase(targetPhase);
      // 更新 session 以反映回退
      const newSession: OnboardingSession = {
        phase: targetPhase,
        completedPhases: (session?.completedPhases ?? []).filter(
          (p) => PHASE_ORDER.indexOf(p) < PHASE_ORDER.indexOf(targetPhase),
        ),
        savedAt: new Date().toISOString(),
      };
      save(newSession);
    },
    [session, save],
  );

  // 暂时离开
  const handleExit = () => {
    const currentSession: OnboardingSession = {
      phase,
      completedPhases: session?.completedPhases ?? [],
      savedAt: new Date().toISOString(),
    };
    save(currentSession);
    // 退出入驻，回到登录页
    if (onClose) {
      onClose();
    } else {
      onComplete();
    }
  };

  if (loading || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f8f9ff' }}>
        <LottieLoader size={640} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: '#f8f9ff' }}>
      {/* 非 Phase0 阶段的退出按钮 */}
      {phase !== 'finalize' && phase !== 'phase0' && (
        <button
          type="button"
          onClick={handleExit}
          className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
          style={{ backgroundColor: '#d9e3f4', color: '#4a4455' }}
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <AnimatePresence mode="wait">
        {phase === 'phase0' && (
          <motion.div key="phase0" exit={{ opacity: 0, x: -20 }}>
            <Phase0Identity userId={userId} onComplete={() => advancePhase('phase0')} onClose={handleExit} />
          </motion.div>
        )}
        {phase === 'phase1' && (
          <motion.div key="phase1" exit={{ opacity: 0, x: -20 }}>
            <Phase1Cards
              userId={userId}
              gender={gender}
              onComplete={() => {
                setPhaseError(null);
                advancePhase('phase1');
              }}
              initialError={phaseError ?? undefined}
            />
          </motion.div>
        )}
        {phase === 'phase1_5' && (
          <motion.div key="phase1_5" exit={{ opacity: 0, x: -20 }}>
            <Phase1_5Sketch
              onComplete={() => advancePhase('phase1_5')}
              onGoBack={goBackToPhase}
            />
          </motion.div>
        )}
        {phase === 'phase1_6' && (
          <motion.div key="phase1_6" exit={{ opacity: 0, x: -20 }}>
            <Phase1_6IdealSketch
              onComplete={() => advancePhase('phase1_6')}
              onGoBack={goBackToPhase}
            />
          </motion.div>
        )}
        {phase === 'phase2' && (
          <motion.div key="phase2" exit={{ opacity: 0, x: -20 }}>
            <Phase2Roleplay userId={userId} onComplete={() => advancePhase('phase2')} />
          </motion.div>
        )}
        {phase === 'finalize' && (
          <motion.div key="finalize" exit={{ opacity: 0 }}>
            <Finalize
              onComplete={() => advancePhase('finalize')}
              onGoBack={goBackToPhase}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
