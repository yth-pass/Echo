/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { UserPlus } from 'lucide-react';
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
  resendOtp: '重新发送',
  submitLogin: '登录',
  submitRegister: '创建账号并继续',
  loading: COPY.loading.auth,
  errorOtpSend: COPY.error.otpSend,
  errorLogin: COPY.error.loginOtpError,
} as const;

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
  const [agreed, setAgreed] = useState(false);
  const hasApi = Boolean(getApiBaseUrl());

  const canContinue = phone.replace(/\D/g, '').length >= 11;

  const subtitle =
    mode === 'register'
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
    <div
      className="min-h-screen antialiased flex flex-col items-center justify-start"
      style={{ backgroundColor: '#f8f9ff', color: '#121c28' }}
    >
      <div className="w-full max-w-[420px] min-h-screen relative flex flex-col">
        {/* Header */}
        <header className="w-full flex items-center justify-center px-6 h-16">
          <h1
            className="text-xl font-bold"
            style={{ color: '#2B8AEF' }}
          >
            Echo
          </h1>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col px-6 pt-6 pb-12 w-full">
          {/* Decorative Mascots */}
          <div className="flex justify-center items-center gap-3 mb-5">
            <img
              src="/illustrations/mascot-left.png"
              alt=""
              className="w-20 h-20 object-contain animate-[bounce_3s_ease-in-out_infinite] rounded-2xl"
            />
            <img
              src="/illustrations/mascot-right.png"
              alt=""
              className="w-20 h-20 object-contain animate-[bounce_3s_ease-in-out_infinite_0.5s] rounded-2xl"
            />
          </div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 text-center"
          >
            <h2
              className="text-3xl font-extrabold tracking-tight mb-2"
              style={{ color: '#121c28' }}
            >
              {mode === 'login'
                ? '欢迎来到 Echo'
                : AUTH_COPY.titleRegister}
            </h2>
            <p className="text-base" style={{ color: '#4a4455' }}>
              {subtitle}
            </p>
          </motion.div>

          {/* Login / Register Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className="flex-1 py-2.5 rounded-full text-sm font-bold transition-colors"
              style={
                mode === 'login'
                  ? { backgroundColor: '#2B8AEF', color: '#ffffff' }
                  : { backgroundColor: '#d9e3f4', color: '#4a4455' }
              }
            >
              {AUTH_COPY.tabLogin}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className="flex-1 py-2.5 rounded-full text-sm font-bold flex items-center justify-center gap-1 transition-colors"
              style={
                mode === 'register'
                  ? { backgroundColor: '#2B8AEF', color: '#ffffff' }
                  : { backgroundColor: '#d9e3f4', color: '#4a4455' }
              }
            >
              <UserPlus className="w-4 h-4" />
              {AUTH_COPY.tabRegister}
            </button>
          </div>

          {/* Form */}
          <div className="flex flex-col gap-5 w-full">
            {/* Phone Input (pill shape with +86 prefix) */}
            <div
              className="flex items-center w-full rounded-full border transition-all focus-within:ring-1"
              style={{
                backgroundColor: '#E8F4FF',
                borderColor: '#d9e3f4',
                '--tw-ring-color': '#2B8AEF',
              } as React.CSSProperties}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = '#2B8AEF')
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = '#d9e3f4')
              }
            >
              <div
                className="flex items-center pl-6 pr-4 py-4 border-r text-base"
                style={{ borderColor: '#d9e3f4', color: '#4a4455' }}
              >
                +86
              </div>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder={AUTH_COPY.placeholderPhone}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1 bg-transparent border-none px-4 py-4 text-base focus:outline-none focus:ring-0 rounded-r-full placeholder:text-[#7b7487]"
                style={{ color: '#121c28' }}
              />
            </div>

            {/* OTP Input (pill shape with inline send-code button) */}
            <div
              className="flex items-center w-full rounded-full border transition-all focus-within:ring-1"
              style={{
                backgroundColor: '#E8F4FF',
                borderColor: '#d9e3f4',
                '--tw-ring-color': '#2B8AEF',
              } as React.CSSProperties}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = '#2B8AEF')
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = '#d9e3f4')
              }
            >
              <input
                type="text"
                inputMode="numeric"
                placeholder={AUTH_COPY.placeholderOtp}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="flex-1 bg-transparent border-none pl-6 pr-4 py-4 text-base focus:outline-none focus:ring-0 rounded-l-full placeholder:text-[#7b7487]"
                style={{ color: '#121c28' }}
              />
              <div className="pr-2">
                <button
                  type="button"
                  disabled={!canContinue || loading}
                  onClick={() => void sendOtp()}
                  className="px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#d9e3f4', color: '#2B8AEF' }}
                >
                  {loading
                    ? AUTH_COPY.loading
                    : otpSent
                      ? AUTH_COPY.resendOtp
                      : AUTH_COPY.sendOtp}
                </button>
              </div>
            </div>

            {/* OTP Sent Hint */}
            {otpSentInfo && !error && (
              <p
                className="text-xs text-center -mt-1"
                style={{ color: '#7b7487' }}
              >
                {AUTH_COPY.otpSentHint}
              </p>
            )}

            {/* Error */}
            {error && (
              <p className="text-sm text-center" style={{ color: '#ba1a1a' }}>
                {error}
              </p>
            )}

            {/* Registration hint */}
            <p className="text-sm text-center" style={{ color: '#7b7487' }}>
              未注册手机号验证后将自动创建账号
            </p>

            {/* Submit Button */}
            <button
              type="button"
              disabled={
                !canContinue ||
                !agreed ||
                loading ||
                (hasApi && otpSent && !code.trim())
              }
              onClick={() => void enter()}
              className="mt-2 w-full font-bold py-4 rounded-full flex items-center justify-center gap-2 text-lg disabled:opacity-40 transition-opacity hover:opacity-90 active:scale-[0.98] shadow-sm"
              style={{ backgroundColor: '#2B8AEF', color: '#ffffff' }}
            >
              {loading
                ? AUTH_COPY.loading
                : mode === 'register'
                  ? AUTH_COPY.submitRegister
                  : AUTH_COPY.submitLogin}
            </button>

            {/* Agreement */}
            <div className="mt-4 flex items-start gap-3 px-2">
              <input
                type="checkbox"
                id="echo-agreement"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 w-4 h-4 rounded cursor-pointer"
                style={{
                  borderColor: '#ccc3d8',
                  accentColor: '#2B8AEF',
                  backgroundColor: '#E8F4FF',
                }}
              />
              <label
                htmlFor="echo-agreement"
                className="text-sm cursor-pointer leading-relaxed"
                style={{ color: '#4a4455' }}
              >
                登录即同意
                <a
                  className="hover:underline font-semibold"
                  style={{ color: '#2B8AEF' }}
                  href="#"
                >
                  《用户协议》
                </a>
                和
                <a
                  className="hover:underline font-semibold"
                  style={{ color: '#2B8AEF' }}
                  href="#"
                >
                  《隐私政策》
                </a>
              </label>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
