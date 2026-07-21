/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Camera, Trash2, Loader2 } from 'lucide-react';
import { uploadAvatar, deleteAvatar, getAvatar, cacheAvatar, getCachedAvatar, clearAvatarCache, notifyAvatarChanged } from '../../api/settings';
import { COPY } from '../../copy';

const DICEBEAR_FALLBACK = 'https://api.dicebear.com/7.x/notionists/svg?seed=Felix';

/** 将图片压缩为 256×256 JPEG 80%（通常 <30KB），大幅减少 DB 存储和传输开销 */
function compressAvatar(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      // 居中裁切为正方形
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('compress failed'))),
        'image/jpeg',
        0.8,
      );
    };
    img.onerror = () => reject(new Error('image load failed'));
    img.src = URL.createObjectURL(file);
  });
}

export function AvatarSettings({ onBack }: { onBack: () => void }) {
  // 先从缓存秒显，再异步刷新 API 并更新缓存
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => getCachedAvatar());
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      const r = await getAvatar();
      if (r.ok && r.data.avatarUrl) {
        cacheAvatar(r.data.avatarUrl);
        setAvatarUrl(r.data.avatarUrl);
      }
    })();
  }, []);

  const src = avatarUrl ?? DICEBEAR_FALLBACK;

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const compressed = await compressAvatar(file);
      const compressedFile = new File([compressed], 'avatar.jpg', { type: 'image/jpeg' });
      const r = await uploadAvatar(compressedFile);
      setUploading(false);
      if (r.ok) {
        cacheAvatar(r.data.avatarUrl);
        notifyAvatarChanged();
        setAvatarUrl(r.data.avatarUrl);
        onBack();
      } else {
        const err = r as { ok: false; status: number; message: string };
        setError(err.message || COPY.error.uploadFailed);
      }
    } catch {
      setUploading(false);
      setError('图片压缩失败，请换一张更小的图片');
    }
  }, [onBack]);

  const handleDelete = useCallback(async () => {
    if (!avatarUrl) return;
    setUploading(true);
    const r = await deleteAvatar();
    setUploading(false);
    if (r.ok) {
      clearAvatarCache();
      notifyAvatarChanged();
      setAvatarUrl(null);
      onBack();
    } else {
      setError(COPY.error.deleteFailed);
    }
  }, [avatarUrl, onBack]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      className="fixed inset-0 z-[100] flex justify-center"
    >
      <div className="w-full max-w-[375px] flex flex-col h-full relative" style={{ backgroundColor: '#f8f9ff' }}>
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-3 px-4 h-14" style={{ borderBottom: '1px solid #d9e3f4' }}>
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-2 rounded-xl active:opacity-80"
          style={{ color: '#121c28' }}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold" style={{ color: '#121c28' }}>头像</h1>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-8">
        <div className="relative">
          <img
            src={src}
            alt="avatar"
            className="w-48 h-48 rounded-full object-cover"
            style={{ backgroundColor: '#E8F4FF', border: '2px solid #d9e3f4' }}
          />
          {uploading && (
            <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#2B8AEF' }} />
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm" style={{ color: '#ba1a1a' }}>{error}</p>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = '';
          }}
        />

        <div className="w-full space-y-3 max-w-xs">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="w-full py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-50 transition-all"
            style={{ backgroundColor: '#2B8AEF', color: '#ffffff' }}
          >
            <Camera className="w-5 h-5" />
            从相册选择
          </button>

          {avatarUrl && (
            <button
              type="button"
              disabled={uploading}
              onClick={handleDelete}
              className="w-full py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
              style={{ backgroundColor: 'rgba(186,26,26,0.08)', color: '#ba1a1a', border: '1px solid rgba(186,26,26,0.15)' }}
            >
              <Trash2 className="w-5 h-5" />
              删除头像
            </button>
          )}
        </div>

        <p className="text-[10px] text-center" style={{ color: '#7b7487' }}>
          支持 JPEG、PNG、WebP 格式，最大 2MB
        </p>
      </div>
      </div>
    </motion.div>
  );
}
