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
import { COPY } from '../../copy';

type AuthMode = 'login' | 'register';

const AUTH_COPY = {
  tagline: 'AI 替你破冰',
  titleLogin: '欢迎回来',
  titleRegister: '创建你的 Echo 账号',
  subtitleLogin:
    '使用已绑定的手机号登录，继续查看匹配与分身动态。',
  subtitleRegister:
    '用手机号注册，接下来几分钟即可创建你的 AI 分身，帮你在广场破冰、筛选缘分。',
  tabLogin: '登录',
  tabRegister: '注册',
  labelPhone: '手机号码',
  labelOtp: '短信验证码',
  placeholderPhone: '请输入 11 位手机号',
  placeholderOtp: '请输入 4 位验证码',
  otpSentHint: '验证码已发送至你的手机，请注意查收',
  sendOtp: '获取验证码',
  resendOtp: '重新发送验证码',
  submitLogin: '登录',
  submitRegister: '创建账号并继续',
  loading: COPY.loading.auth,
  errorOtpSend: COPY.error.otpSend,
  errorLogin: COPY.error.loginOtpError,
} as const;

const labelClass = 'block text-left text-sm font-medium text-gray-400 mb-2';

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
  const [otpSentInfo, setOtpSentInfo] = useState(false);
  const hasApi = Boolean(getApiBaseUrl());

  const canContinue = phone.replace(/\D/g, '').length >= 11;

  const subtitle = mode === 'register'
      ? AUTH_COPY.subtitleRegister
      : AUTH_COPY.subtitleLogin;

  const sendOtp = async () => {
    setError(null);
    setOtpSentInfo(false);
    if (!hasApi) {
      setOtpSent(true);
      return;
    }
    setLoading(true);
    try {
      if (mode === 'register') {
        try {
          await registerPhone(phone);
        } catch {
          // 注册失败（如手机号已存在）不阻塞 —— 继续发送验证码
        }
      }
      const otpResult = await requestOtp(phone);
      if (!otpResult.sent) {
        setError(otpResult.error ?? AUTH_COPY.errorOtpSend);
        return;
      }
      setOtpSent(true);
      setOtpSentInfo(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : COPY.error.otpSend);
    } finally {
      setLoading(false);
    }
  };

  const enter = async () => {
    setError(null);
    setOtpSentInfo(false);
    if (!hasApi) {
      onComplete(null);
      return;
    }
    // 【缺陷1修复】移除 || '123456' 默认值，code 为空时不发送请求
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      return;
    }
    setLoading(true);
    try {
      const session = await loginWithOtp(phone, trimmedCode);
      if (!session) {
        setError(AUTH_COPY.errorLogin);
        return;
      }
      onComplete(session);
    } catch (e) {
      setError(e instanceof Error ? e.message : COPY.error.login);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-echo-dark flex flex-col p-8 justify-center max-w-md mx-auto">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 text-echo-blue mb-2">
          <Smartphone className="w-8 h-8 shrink-0" />
          <span className="text-sm font-medium text-echo-blue">{AUTH_COPY.tagline}</span>
        </div>
        <h1 className="text-2xl font-bold mb-2">
          {mode === 'login' ? AUTH_COPY.titleLogin : AUTH_COPY.titleRegister}
        </h1>
        <p className="text-sm text-gray-500 leading-relaxed">{subtitle}</p>
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
          {AUTH_COPY.tabLogin}
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
          {AUTH_COPY.tabRegister}
        </button>
      </div>

      <label className={labelClass}>{AUTH_COPY.labelPhone}</label>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        placeholder={AUTH_COPY.placeholderPhone}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full bg-echo-card border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-gray-600 mb-4 focus:outline-none focus:ring-2 focus:ring-echo-blue/40"
      />

      {hasApi && otpSent && (
        <>
          <label className={labelClass}>{AUTH_COPY.labelOtp}</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder={AUTH_COPY.placeholderOtp}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full bg-echo-card border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-gray-600 mb-2 focus:outline-none focus:ring-2 focus:ring-echo-blue/40"
          />
          {otpSentInfo && !error && (
            <p className="text-xs text-gray-500 mb-4 text-left">{AUTH_COPY.otpSentHint}</p>
          )}
        </>
      )}

      {error && (
        <div className="mb-3 text-left">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <button
        type="button"
        disabled={!canContinue || loading}
        onClick={() => void sendOtp()}
        className="w-full py-3 rounded-2xl font-bold text-sm bg-white/5 border border-white/10 text-gray-300 disabled:opacity-40 mb-3"
      >
        {loading ? AUTH_COPY.loading : otpSent ? AUTH_COPY.resendOtp : AUTH_COPY.sendOtp}
      </button>

      <button
        type="button"
        disabled={!canContinue || loading || (hasApi && otpSent && !code.trim())}
        onClick={() => void enter()}
        className="w-full bg-echo-blue text-echo-dark font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40"
      >
        {loading
          ? AUTH_COPY.loading
          : mode === 'register'
            ? AUTH_COPY.submitRegister
            : AUTH_COPY.submitLogin}
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
}
