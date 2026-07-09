/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactNode } from 'react';

export function Header({ title, rightSlot }: { title: string; rightSlot?: ReactNode }) {
  return (
    <div className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between" style={{ backgroundColor: 'rgba(248,249,255,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #d9e3f4' }}>
      <h1 className="text-xl font-bold tracking-tight" style={{ color: '#121c28' }}>{title}</h1>
      {rightSlot && <div className="shrink-0">{rightSlot}</div>}
    </div>
  );
}
