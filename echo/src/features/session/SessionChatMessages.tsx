/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LottieLoader } from '../../components/LottieLoader';
import type { SessionMessage } from '../../api/session';
import type { SessionMessagesSource } from '../../api/session';
import { COPY } from '../../copy';

/* ── Grouped turn: one speaker may have multiple bubbles ── */
type TurnGroup = {
  turnIndex: number;
  isSelf: boolean;
  speakerName: string;
  bubbles: SessionMessage[];
};

function groupByTurn(messages: SessionMessage[]): TurnGroup[] {
  const map = new Map<number, TurnGroup>();
  for (const m of messages) {
    const existing = map.get(m.turn_index);
    if (existing) {
      existing.bubbles.push(m);
    } else {
      map.set(m.turn_index, {
        turnIndex: m.turn_index,
        isSelf: m.is_self === true,
        speakerName: m.speaker_name ?? (m.is_self ? '我的分身' : '对方分身'),
        bubbles: [m],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.turnIndex - b.turnIndex);
}

export function SessionChatMessages({
  messages,
  loading,
  source,
  emptyHint,
  animate = false,
}: {
  messages: SessionMessage[];
  loading?: boolean;
  source?: SessionMessagesSource | 'idle';
  emptyHint?: string;
  /** Replay message bubbles with typing delays (for transcript view) */
  animate?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center py-4">
        <LottieLoader size={40} />
        <p className="text-sm text-gray-500 mt-2">{COPY.loading.session}</p>
      </div>
    );
  }
  if (source === 'error') {
    return (
      <p className="text-sm text-red-400 text-center py-4">无法加载对话，请检查 API 与登录</p>
    );
  }
  if (messages.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-4">
        {emptyHint ?? COPY.empty.messages}
      </p>
    );
  }

  const turns = groupByTurn(messages);

  return animate ? (
    <AnimatedTranscript turns={turns} />
  ) : (
    <StaticTranscript turns={turns} />
  );
}

/* ── Static: all bubbles visible immediately (used in MatchDetailView) ── */

function StaticTranscript({ turns }: { turns: TurnGroup[] }) {
  return (
    <div className="space-y-2">
      {turns.map((turn) => (
        <TurnBlock key={turn.turnIndex} turn={turn} visibleCount={turn.bubbles.length} />
      ))}
    </div>
  );
}

/* ── Animated: bubbles appear sequentially with typing indicator ── */

function AnimatedTranscript({ turns }: { turns: TurnGroup[] }) {
  const [visibleBubbles, setVisibleBubbles] = useState(0);
  const [showTyping, setShowTyping] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Build a flat ordered list of all bubbles across all turns */
  const flatBubbles = useMemo(() => {
    const list: { turnIndex: number; bubbleIndex: number; delayMs: number }[] = [];
    for (const turn of turns) {
      const sorted = [...turn.bubbles].sort((a, b) => a.bubble_index - b.bubble_index);
      for (const b of sorted) {
        list.push({ turnIndex: b.turn_index, bubbleIndex: b.bubble_index, delayMs: b.delay_ms });
      }
    }
    return list;
  }, [turns]);

  useEffect(() => {
    if (!flatBubbles.length) return;

    /* Reset when messages change */
    setVisibleBubbles(0);
    setShowTyping(true);

    const reveal = (idx: number) => {
      if (idx >= flatBubbles.length) {
        setShowTyping(false);
        return;
      }
      const delay = idx === 0 ? 300 : Math.max(flatBubbles[idx].delayMs, 400);
      timerRef.current = setTimeout(() => {
        setVisibleBubbles(idx + 1);
        reveal(idx + 1);
      }, delay);
    };

    reveal(0);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [flatBubbles]);

  /* Count how many bubbles are visible per turn */
  const visiblePerTurn = useMemo(() => {
    const map = new Map<number, number>();
    for (let i = 0; i < visibleBubbles; i++) {
      const ti = flatBubbles[i].turnIndex;
      map.set(ti, (map.get(ti) ?? 0) + 1);
    }
    return map;
  }, [visibleBubbles, flatBubbles]);

  /* Determine which turn currently has the typing indicator */
  const typingTurnIndex = showTyping && visibleBubbles > 0 ? flatBubbles[visibleBubbles - 1]?.turnIndex : -1;

  return (
    <div className="space-y-2">
      {turns.map((turn) => {
        const vc = visiblePerTurn.get(turn.turnIndex) ?? 0;
        const isTyping = showTyping && turn.turnIndex === typingTurnIndex && vc < turn.bubbles.length;
        if (vc === 0 && !isTyping) return null;
        return (
          <div key={turn.turnIndex}>
            <TurnBlock turn={turn} visibleCount={vc} />
            {isTyping && <TypingIndicator isSelf={turn.isSelf} name={turn.speakerName} />}
          </div>
        );
      })}
    </div>
  );
}

/* ── Render one turn's bubbles ── */

function TurnBlock({ turn, visibleCount }: { turn: TurnGroup; visibleCount: number }) {
  const visible = turn.bubbles
    .sort((a, b) => a.bubble_index - b.bubble_index)
    .slice(0, visibleCount);
  if (visible.length === 0) return null;

  return (
    <div className={turn.isSelf ? 'ml-8 space-y-1' : 'mr-8 space-y-1'}>
      <p
        className={`text-[10px] ${turn.isSelf ? 'text-echo-blue/50 text-right' : 'text-gray-500 text-left'}`}
      >
        {turn.speakerName}：
      </p>
      {visible.map((m) => (
        <div
          key={m.id || `t${m.turn_index}-b${m.bubble_index}`}
          className={`p-3 rounded-xl border border-white/5 ${
            turn.isSelf
              ? 'bg-echo-blue/5 border-r-2 border-echo-blue text-right'
              : 'bg-white/5 border-l-2 border-echo-blue text-left'
          }`}
        >
          <p
            className={`text-sm leading-relaxed italic ${
              turn.isSelf ? 'text-echo-blue/80' : 'text-gray-300'
            }`}
          >
            &ldquo;{m.content}&rdquo;
          </p>
        </div>
      ))}
    </div>
  );
}

/* ── Typing indicator between turns ── */

function TypingIndicator({ isSelf, name }: { isSelf: boolean; name: string }) {
  return (
    <div
      className={`flex items-center gap-1.5 py-1.5 ${isSelf ? 'justify-end ml-8' : 'justify-start mr-8'}`}
    >
      <Loader2 className="w-3 h-3 animate-spin text-gray-500" />
      <span className="text-[10px] text-gray-500">{name}正在想…</span>
    </div>
  );
}
