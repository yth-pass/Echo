/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MessageSquare, Sparkles } from 'lucide-react';
import type { Match } from '../../types';
import { Header } from '../shell/Header';

export function MatchView({
  matches,
  onSelect,
}: {
  matches: Match[];
  onSelect: (m: Match) => void;
}) {
  return (
    <div className="pb-24">
      <Header title="社交实验室" />
      <div className="px-5 mt-4 space-y-4">
        <div className="p-4 bg-echo-orange/10 border border-echo-orange/20 rounded-2xl flex items-center gap-4">
          <Sparkles className="w-8 h-8 text-echo-orange shrink-0" />
          <div>
            <p className="text-sm font-bold text-echo-orange">发现新契合！</p>
            <p className="text-xs text-echo-orange/80">
              你的分身与“林溪”的分身对话热度极高，建议开启真人确认。
            </p>
          </div>
        </div>

        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest pt-4 mb-2">
          正在进行的秘密外交
        </h2>

        {matches.map((match) => (
          <div
            key={match.id}
            className="p-5 rounded-3xl bg-echo-card border border-white/5 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4">
              <div className="text-right">
                <p className="text-2xl font-bold text-echo-blue">{match.affinity}%</p>
                <p className="text-[10px] text-echo-blue/60 uppercase">Affinity</p>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                <img
                  src={`https://api.dicebear.com/7.x/notionists/svg?seed=${match.name}`}
                  alt="match"
                  className="w-10 h-10"
                />
              </div>
              <div>
                <p className="font-bold">{match.name}</p>
                <div className="flex gap-1 mt-1">
                  {match.tags.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] bg-white/5 px-2 py-0.5 rounded-md text-gray-400"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-black/20 p-3 rounded-xl border border-white/5">
              <p className="text-[11px] text-gray-500 mb-1 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> 分身对话摘要
              </p>
              <p className="text-sm text-gray-300 italic">“{match.lastMessage}”</p>
            </div>

            <button
              type="button"
              onClick={() => onSelect(match)}
              className="w-full mt-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-colors"
            >
              查看审计日志
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
