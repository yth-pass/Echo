/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  submitReport,
  type ReportTargetType,
} from '../../api/report';
import { COPY } from '../../copy';

const TARGET_OPTIONS: { value: ReportTargetType; label: string }[] = [
  { value: 'post', label: '动态' },
  { value: 'comment', label: '评论' },
  { value: 'user', label: '用户 / 分身' },
  { value: 'session', label: '会话' },
];

const REASON_PRESETS = ['骚扰或辱骂', '不当或违法内容', '虚假信息', '其他'] as const;

export function ReportSheet({
  initialTargetType,
  initialTargetId,
  onClose,
}: {
  initialTargetType?: ReportTargetType;
  initialTargetId?: string;
  onClose: () => void;
}) {
  const locked = Boolean(initialTargetType && initialTargetId);
  const [targetType, setTargetType] = useState<ReportTargetType>(
    initialTargetType ?? 'post',
  );
  const [targetId, setTargetId] = useState(initialTargetId ?? '');
  const [preset, setPreset] = useState<(typeof REASON_PRESETS)[number]>('骚扰或辱骂');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'no_api'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const reason = useMemo(() => {
    const parts: string[] = [preset];
    if (detail.trim()) parts.push(detail.trim());
    return parts.join('：');
  }, [preset, detail]);

  const handleSubmit = async () => {
    const id = targetId.trim();
    if (!id) {
      setErrorMsg('请填写对象 ID');
      setStatus('error');
      return;
    }
    setSubmitting(true);
    setStatus('idle');
    setErrorMsg('');
    const res = await submitReport({ targetType, targetId: id, reason });
    setSubmitting(false);
    if (res.ok) {
      setStatus('success');
      return;
    }
    if (!res.ok) {
      // 【窄化修复】in 操作符独立于 ok 判别字段，确保跨文件判别联合可靠窄化
      const err: 'no_api' | 'request_failed' = 'error' in res ? res.error : 'request_failed';
      if (err === 'no_api') {
        setStatus('no_api');
        return;
      }
      setStatus('error');
      setErrorMsg(COPY.error.submitFailed);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 bg-echo-dark z-[120] flex flex-col"
    >
      <div className="p-4 glass flex items-center justify-between border-b border-white/10">
        <button type="button" onClick={onClose} className="text-gray-400 text-sm">
          取消
        </button>
        <h2 className="font-bold text-sm">举报</h2>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {status === 'success' ? (
          <div className="text-center py-12 space-y-4">
            <p className="text-echo-blue font-bold">{COPY.celebrate.reportDone}</p>
            <p className="text-xs text-gray-500">{COPY.celebrate.reportDoneSub}</p>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-echo-blue text-echo-dark rounded-2xl font-bold text-sm"
            >
              完成
            </button>
          </div>
        ) : (
          <>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">
                举报类型
              </label>
              <select
                value={targetType}
                disabled={locked}
                onChange={(e) => setTargetType(e.target.value as ReportTargetType)}
                className="w-full p-3 rounded-xl bg-echo-card border border-white/10 text-sm disabled:opacity-60"
              >
                {TARGET_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">
                对象 ID
              </label>
              <input
                type="text"
                value={targetId}
                readOnly={locked}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="帖子 / 评论 / 用户 UUID"
                className="w-full p-3 rounded-xl bg-echo-card border border-white/10 text-sm disabled:opacity-60"
              />
              {!locked && (
                <p className="text-[10px] text-gray-600 mt-1">
                  也可在动态详情、缘分详情中一键举报（自动填入 ID）
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">
                举报原因
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {REASON_PRESETS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setPreset(r)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                      preset === r
                        ? 'bg-echo-blue text-echo-dark'
                        : 'bg-white/5 text-gray-400'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="补充说明（可选）"
                rows={3}
                className="w-full p-3 rounded-xl bg-echo-card border border-white/10 text-sm resize-none"
              />
            </div>

            {status === 'no_api' && (
              <p className="text-sm text-amber-400/90 text-center">
                {COPY.error.noApiReport}
              </p>
            )}
            {status === 'error' && errorMsg && (
              <p className="text-sm text-red-400 text-center">{errorMsg}</p>
            )}

            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleSubmit()}
              className="w-full py-4 bg-echo-blue text-echo-dark rounded-2xl font-bold text-sm disabled:opacity-50"
            >
              {submitting ? COPY.submitting.report : '提交举报'}
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
