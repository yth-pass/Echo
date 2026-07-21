/**
 * PhaseStepper — Onboarding 顶部水平进度条
 *
 * 显示所有 phase 的总结性标签（从 phase-labels 读取），
 * 已完成 phase 可点击跳回修改。移动端折叠为紧凑模式。
 */

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { PHASE_ORDER, type OnboardingPhase } from '../onboarding-v2.types';
import { PHASE_LABELS } from '../phase-labels';

interface PhaseStepperProps {
  currentPhase: OnboardingPhase;
  completedPhases: OnboardingPhase[];
  /** 用户主动跳回的目标 phase（null = 未跳回） */
  userSelectedPhase: OnboardingPhase | null;
  onJumpTo: (phase: OnboardingPhase) => void;
}

export function PhaseStepper({
  currentPhase,
  completedPhases,
  userSelectedPhase,
  onJumpTo,
}: PhaseStepperProps) {
  const [expanded, setExpanded] = useState(false);

  // 实际显示的 phase：用户跳回时显示跳回的 phase，否则显示 currentPhase
  const displayPhase = userSelectedPhase ?? currentPhase;
  const currentIdx = PHASE_ORDER.indexOf(displayPhase);

  return (
    <>
      {/* 移动端紧凑模式（< 640px） */}
      <div
        className="sm:hidden flex items-center gap-2 py-1 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-xs" style={{ color: '#7b7487' }}>
          第 {currentIdx + 1} / {PHASE_ORDER.length} 步
        </span>
        <span className="text-sm font-medium" style={{ color: '#4a4455' }}>
          {PHASE_LABELS[displayPhase].short}
        </span>
        <ChevronDown
          className="w-4 h-4 transition-transform"
          style={{
            color: '#7b7487',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
          }}
        />
      </div>

      {/* 桌面端完整模式（≥ 640px） + 移动端展开时 */}
      <div
        className={`${expanded ? 'flex' : 'hidden'} sm:flex items-center justify-center gap-1 sm:gap-2 py-1 overflow-x-auto`}
      >
        {PHASE_ORDER.map((phase, idx) => {
          const isCompleted = completedPhases.includes(phase);
          const isCurrent = displayPhase === phase;
          const isClickable = isCompleted;
          const label = PHASE_LABELS[phase].short;

          return (
            <div key={phase} className="flex items-center">
              {idx > 0 && (
                <div
                  className="h-px w-3 sm:w-6"
                  style={{ backgroundColor: isCompleted ? '#9b8aff' : '#d9e3f4' }}
                />
              )}
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onJumpTo(phase)}
                className="flex flex-col items-center gap-1 transition-transform"
                style={{
                  cursor: isClickable ? 'pointer' : 'default',
                  transform: isCurrent ? 'scale(1.1)' : 'scale(1)',
                }}
                title={PHASE_LABELS[phase].description}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all"
                  style={{
                    backgroundColor: isCompleted ? '#9b8aff' : 'transparent',
                    border: isCurrent ? '2px solid #9b8aff' : '2px solid #d9e3f4',
                    color: isCompleted ? '#fff' : '#7b7487',
                  }}
                >
                  {isCompleted ? '\u2713' : idx + 1}
                </div>
                <span
                  className="text-[10px] sm:text-xs whitespace-nowrap"
                  style={{ color: isCurrent ? '#4a4455' : '#7b7487' }}
                >
                  {label}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
