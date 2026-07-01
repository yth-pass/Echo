/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function Header({ title }: { title: string }) {
  return (
    <div className="sticky top-0 z-10 px-6 py-4 glass flex items-center">
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
    </div>
  );
}
