/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { LottieLoader } from '../../components/LottieLoader';

/**
 * 【缺陷4修复】SplashScreen 不再自带 2s 定时器。
 * 由父组件（App.tsx）控制何时离开 splash：
 * - fetchMe 完成或 5s 超时后由父组件 setState 切换
 * - SplashScreen 仅负责动画展示
 */
export function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-echo-dark flex flex-col items-center justify-center p-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="mb-2"
      >
        <LottieLoader size={576} />
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
        className="text-base font-bold tracking-widest uppercase"
      >
        AI分身社交实验室
      </motion.p>
    </div>
  );
}
