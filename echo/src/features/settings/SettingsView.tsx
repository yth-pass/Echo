/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChevronRight, Heart, LogOut, ShieldCheck, Users } from 'lucide-react';
import { Header } from '../shell/Header';
import { clearTokens } from '../../api/auth';

export function SettingsView({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="pb-24">
      <Header title="设置" />
      <div className="mt-4 px-5 space-y-2">
        {[
          { icon: <Users className="w-5 h-5" />, label: '匹配偏好', value: '女生 · 22-30岁' },
          { icon: <ShieldCheck className="w-5 h-5" />, label: '账号与安全', value: '手机号已验证' },
          { icon: <Heart className="w-5 h-5" />, label: '隐私模式', value: '关闭' },
        ].map((item, i) => (
          <div
            key={i}
            className="bg-echo-card p-4 rounded-2xl flex items-center justify-between border border-white/5"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/5 rounded-xl text-gray-400">{item.icon}</div>
              <div>
                <p className="text-sm font-bold">{item.label}</p>
                <p className="text-[10px] text-gray-500">{item.value}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </div>
        ))}

        <div className="pt-6">
          <button
            type="button"
            onClick={() => {
              clearTokens();
              onLogout();
            }}
            className="w-full p-4 bg-red-500/10 text-red-500 rounded-2xl font-bold flex items-center justify-center gap-2 border border-red-500/20 active:bg-red-500/20 transition-all"
          >
            <LogOut className="w-5 h-5" />
            退出登录
          </button>
        </div>
      </div>
    </div>
  );
}
