/**
 * ResumeOnboardingDialog — 登录后检测到未完成 Onboarding 时弹出恢复提示
 *
 * 列出已完成的 phase（带总结性标签），提示下一步，让用户选择"继续"或"回去改改"。
 * 仅当 completedPhases.length > 0 且 currentPhase !== 'finalize' 时触发。
 */

import { PHASE_ORDER, type OnboardingPhase } from '../onboarding-v2.types';
import { PHASE_LABELS } from '../phase-labels';

interface ResumeOnboardingDialogProps {
  open: boolean;
  currentPhase: OnboardingPhase;
  completedPhases: OnboardingPhase[];
  onResume: () => void;
  onEditPrevious: () => void;
}

export function ResumeOnboardingDialog({
  open,
  currentPhase,
  completedPhases,
  onResume,
  onEditPrevious,
}: ResumeOnboardingDialogProps) {
  if (!open) return null;

  const nextPhaseLabel = PHASE_LABELS[currentPhase];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center"
      style={{ backgroundColor: 'rgba(74, 68, 85, 0.5)' }}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: '#fff',
          boxShadow: '0 24px 80px rgba(74, 68, 85, 0.2)',
        }}
      >
        <h2 className="text-2xl font-semibold mb-1" style={{ color: '#4a4455' }}>
          欢迎回到 Echo
        </h2>
        <p className="text-sm mb-6" style={{ color: '#7b7487' }}>
          上次你已完成：
        </p>

        {/* 已完成 phase 列表 */}
        <div className="flex flex-wrap gap-2 mb-6">
          {completedPhases.map((phase) => (
            <div
              key={phase}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: '#f0ebff', color: '#6b5aff' }}
            >
              <span>&#10003;</span>
              <span>{PHASE_LABELS[phase].short}</span>
            </div>
          ))}
        </div>

        {/* 下一步提示 */}
        <div
          className="rounded-2xl p-4 mb-6"
          style={{ backgroundColor: '#f8f9ff', border: '1px solid #e8e0f5' }}
        >
          <p className="text-xs mb-1" style={{ color: '#7b7487' }}>下一步</p>
          <p className="text-base font-medium" style={{ color: '#4a4455' }}>
            {nextPhaseLabel.full}
          </p>
          <p className="text-xs mt-1" style={{ color: '#7b7487' }}>
            {nextPhaseLabel.description}
          </p>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-3.5 rounded-xl font-medium transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: '#9b8aff', color: '#fff' }}
          >
            从这里继续
          </button>
          <button
            type="button"
            onClick={onEditPrevious}
            className="w-full py-3.5 rounded-xl font-medium transition-colors"
            style={{
              backgroundColor: 'transparent',
              color: '#7b7487',
              border: '1px solid #d9e3f4',
            }}
          >
            回去改改前面
          </button>
        </div>
      </div>
    </div>
  );
}
