/**
 * PosterPage — 完整使用示例
 *
 * 展示从「页面内容」→「点击生成海报」→「预览 + 保存/分享」的完整流程。
 *
 * 文件依赖：
 * - PosterCanvas.tsx   (隐藏海报模板)
 * - usePosterGenerator.ts (生成 hook)
 *
 * 安装依赖：
 *   npm install html-to-image
 */

import { useState } from 'react';
import PosterCanvas, { type PosterData } from '../utils/poster/PosterCanvas';
import { usePosterGenerator, savePosterToAlbum } from '../utils/poster/usePosterGenerator';

// ─── 模拟数据（实际从后端 /onboarding/poster 接口获取）────
const MOCK_POSTER_DATA: PosterData = {
  elfName: '栖光鹿',
  elfCode: 'ELF-01',
  primaryColor: '#FF6B6B',
  secondaryColor: '#7C5CFC',
  declaration: '我不急着改变世界，只想把温度传给你。',
  personalKeywords: ['温暖', '倾听', '稳定', '活在当下', '真诚'],
  idealKeywords: ['情感确认', '边界感', '有话直说', '不隔夜'],
};

export default function PosterPage() {
  const { posterRef, generate, status, imageUrl, error, reset } = usePosterGenerator();
  const [showPreview, setShowPreview] = useState(false);

  const handleGenerate = async () => {
    const url = await generate();
    if (url) {
      setShowPreview(true);
    }
  };

  const handleSave = async () => {
    if (!imageUrl) return;
    await savePosterToAlbum(imageUrl);
    // 可选 toast："已保存到相册"
  };

  const handleClosePreview = () => {
    setShowPreview(false);
    reset(); // 重置状态，下次可重新生成
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-8">
      {/* ======== 页面上半部分：用户看到的结果页 ======== */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm p-6 mb-8">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ background: MOCK_POSTER_DATA.primaryColor }}
            >
              E
            </div>
            <span className="font-bold text-lg" style={{ color: MOCK_POSTER_DATA.primaryColor }}>
              Echo
            </span>
          </div>
          <span className="text-xs text-gray-400 bg-white/60 px-3 py-1 rounded-full">
            Phase 1 入驻结果
          </span>
        </div>

        {/* 精灵名 */}
        <div className="text-center mb-4">
          <h2 className="text-5xl font-extrabold" style={{ color: MOCK_POSTER_DATA.primaryColor }}>
            {MOCK_POSTER_DATA.elfName}
          </h2>
          <p className="text-sm text-gray-400 mt-1 tracking-wider">{MOCK_POSTER_DATA.elfCode}</p>
        </div>

        {/* 精灵占位图 */}
        <div
          className="w-40 h-40 rounded-full mx-auto mb-6 flex items-center justify-center text-6xl"
          style={{ background: `${MOCK_POSTER_DATA.primaryColor}22` }}
        >
          🦌
        </div>

        {/* 宣言 */}
        <div className="bg-white/70 rounded-2xl p-5 text-center mb-4 shadow-sm">
          <p className="text-xs text-gray-400 mb-2">你的回声</p>
          <p className="text-lg leading-relaxed font-medium">
            <span className="text-xl opacity-30" style={{ color: MOCK_POSTER_DATA.primaryColor }}>
              "
            </span>
            {MOCK_POSTER_DATA.declaration}
            <span className="text-xl opacity-30" style={{ color: MOCK_POSTER_DATA.primaryColor }}>
              "
            </span>
          </p>
        </div>

        {/* 我的关键字 */}
        <div className="bg-white/70 rounded-2xl p-4 mb-3 shadow-sm">
          <p className="text-xs text-gray-400 mb-3">我的关键字</p>
          <div className="flex flex-wrap gap-2">
            {MOCK_POSTER_DATA.personalKeywords.map((kw) => (
              <span
                key={kw}
                className="text-sm px-4 py-2 rounded-full font-medium"
                style={{
                  background: `${MOCK_POSTER_DATA.primaryColor}18`,
                  color: MOCK_POSTER_DATA.primaryColor,
                }}
              >
                {kw}
              </span>
            ))}
          </div>
        </div>

        {/* 我想遇见 */}
        <div className="bg-white/70 rounded-2xl p-4 mb-6 shadow-sm">
          <p className="text-xs text-gray-400 mb-3">我想遇见</p>
          <div className="flex flex-wrap gap-2">
            {MOCK_POSTER_DATA.idealKeywords.map((kw) => (
              <span
                key={kw}
                className="text-sm px-4 py-2 rounded-full font-medium"
                style={{
                  background: `${MOCK_POSTER_DATA.secondaryColor}18`,
                  color: MOCK_POSTER_DATA.secondaryColor,
                }}
              >
                {kw}
              </span>
            ))}
          </div>
        </div>

        {/* CTA 按钮 */}
        <button
          onClick={handleGenerate}
          disabled={status === 'generating'}
          className="w-full py-4 rounded-full text-white font-bold text-lg shadow-lg transition-all active:scale-95 disabled:opacity-60"
          style={{
            background: `linear-gradient(135deg, ${MOCK_POSTER_DATA.primaryColor}, ${MOCK_POSTER_DATA.primaryColor}dd)`,
            boxShadow: `0 8px 24px ${MOCK_POSTER_DATA.primaryColor}44`,
          }}
        >
          {status === 'generating' ? '正在生成海报...' : '生成我的海报'}
        </button>

        {error && <p className="text-red-500 text-sm text-center mt-3">生成失败：{error}</p>}

        <p className="text-xs text-gray-400 text-center mt-4">这些词是你此刻的回声，不是定义。</p>
      </div>

      {/* ======== 隐藏海报模板（必须挂载在 DOM 中）======== */}
      <PosterCanvas ref={posterRef} data={MOCK_POSTER_DATA} />

      {/* ======== 海报预览遮罩 ======== */}
      {showPreview && imageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex flex-col items-center justify-center p-6"
          onClick={handleClosePreview}
        >
          {/* 海报图片 */}
          <div
            className="rounded-3xl overflow-hidden shadow-2xl max-h-[70vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imageUrl}
              alt="回声精灵海报"
              className="w-full h-full object-contain"
              style={{ maxWidth: '340px' }}
            />
          </div>

          {/* 操作按钮 */}
          <div className="mt-6 flex gap-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleSave}
              className="px-8 py-3 rounded-full text-white font-bold text-base shadow-lg active:scale-95 transition-all"
              style={{
                background: `linear-gradient(135deg, ${MOCK_POSTER_DATA.primaryColor}, ${MOCK_POSTER_DATA.primaryColor}dd)`,
              }}
            >
              保存到相册
            </button>
            <button
              onClick={handleClosePreview}
              className="px-8 py-3 rounded-full border border-white/30 text-white font-bold text-base active:scale-95 transition-all"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
