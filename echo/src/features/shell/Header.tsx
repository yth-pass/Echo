/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function Header({ title }: { title: string }) {
  return (
    <div className="sticky top-0 z-10 px-6 py-4 glass flex items-center justify-between">
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      <div className="w-10 h-10 rounded-full bg-echo-blue/20 flex items-center justify-center text-echo-blue border border-echo-blue/30 overflow-hidden">
        <img src="https://api.dicebear.com/7.x/notionists/svg?seed=Felix" alt="Avatar" />
      </div>
    </div>
  );
}
