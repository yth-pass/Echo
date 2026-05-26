/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onFinish, 2000);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 bg-echo-dark flex flex-col items-center justify-center p-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="w-24 h-24 rounded-full bg-echo-blue/20 flex items-center justify-center mb-6 echo-glow-blue"
      >
        <Sparkles className="w-12 h-12 text-echo-blue" />
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-4xl font-bold tracking-tighter text-white mb-2"
      >
        Echo
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 0.5 }}
        className="text-sm font-medium tracking-widest uppercase"
      >
        AI分身社交实验室
      </motion.p>
    </div>
  );
}
