/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Smartphone, UserPlus } from 'lucide-react';
import { getApiBaseUrl } from '../../api/client';
import type { AuthSession } from '../../api/auth';
import { loginWithOtp, registerPhone, requestOtp } from '../../api/auth';

type AuthMode = 'login' | 'register';

/** Phone + OTP; routes new users to onboarding after login. */
export function AuthShell({
  onComplete,
}: {
  onComplete: (session: AuthSession | null) => void;
}) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasApi = Boolean(getApiBaseUrl());

  const canContinue = phone.replace(/\D/g, '').length >= 11;

  const sendOtp = async () => {
    setError(null);
    if (!hasApi) {
      setOtpSent(true);
      return;
    }
    setLoading(true);
    if (mode === 'register') {
      await registerPhone(phone);
    }
    const ok = await requestOtp(phone);
    setLoading(false);
    if (!ok) {
      setError('无法发送验证码，请确认 API 已启动');
      return;
    }
    setOtpSent(true);
  };

  const enter = async () => {
    setError(null);
    if (!hasApi) {
      onComplete(null);
      return;
    }
    setLoading(true);
    const session = await loginWithOtp(phone, code || '123456');
    setLoading(false);
    if (!session) {
      setError('登录失败，请检查验证码（开发环境可用 123456）');
      return;
    }
    onComplete(session);
  };

  return (
    <div className="min-h-screen bg-echo-dark flex flex-col p-8 justify-center max-w-md mx-auto">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 text-echo-blue mb-2">
          <Smartphone className="w-8 h-8" />
          <span className="text-xs font-bold uppercase tracking-widest">Foundation</span>
        </div>
        <h1 className="text-2xl font-bold mb-2">{mode === 'login' ? '登录' : '注册新账号'}</h1>
        <p className="text-sm text-gray-500 leading-relaxed">
          {hasApi
            ? mode === 'register'
              ? '新用户注册后需完成问卷，孵化你的语言风格分身。'
              : '老用户登录后将直接进入广场（已完成问卷）。'
            : '未配置 VITE_API_BASE_URL：跳过真实校验，直接进入演示。'}
        </p>
      </motion.div>

      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setError(null);
          }}
          className={`flex-1 py-2 rounded-xl text-sm font-bold ${
            mode === 'login' ? 'bg-echo-blue text-echo-dark' : 'bg-white/5 text-gray-400'
          }`}
        >
          登录
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setError(null);
          }}
          className={`flex-1 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-1 ${
            mode === 'register' ? 'bg-echo-blue text-echo-dark' : 'bg-white/5 text-gray-400'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          注册
        </button>
      </div>

      <label className="block text-left text-xs font-bold text-gray-500 uppercase mb-2">手机号</label>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        placeholder="11 位中国大陆手机号"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full bg-echo-card border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-gray-600 mb-4 focus:outline-none focus:ring-2 focus:ring-echo-blue/40"
      />

      {hasApi && otpSent && (
        <>
          <label className="block text-left text-xs font-bold text-gray-500 uppercase mb-2">验证码</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="6 位验证码"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full bg-echo-card border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-gray-600 mb-4 focus:outline-none focus:ring-2 focus:ring-echo-blue/40"
          />
        </>
      )}

      {error && <p className="text-sm text-red-400 mb-3 text-left">{error}</p>}

      <button
        type="button"
        disabled={!canContinue || loading}
        onClick={() => void sendOtp()}
        className="w-full py-3 rounded-2xl font-bold text-sm bg-white/5 border border-white/10 text-gray-300 disabled:opacity-40 mb-3"
      >
        {loading ? '处理中…' : otpSent ? '重新发送验证码' : '获取验证码'}
      </button>

      <button
        type="button"
        disabled={!canContinue || loading}
        onClick={() => void enter()}
        className="w-full bg-echo-blue text-echo-dark font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40"
      >
        {loading ? '处理中…' : mode === 'register' ? '注册并继续' : '登录'}
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
}
