/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * v2 入驻 — 4 个角色扮演角色前端展示定义
 */

import type { RoleAgentDef } from './onboarding-v2.types';

export const ROLEPLAY_ROLES: RoleAgentDef[] = [
  {
    roleId: 'bestfriend',
    displayName: '小鹿',
    description: '最懂你的老朋友，无话不谈',
    availableInP0: true,
    avatarText: '鹿',
    avatarColor: '#FFB74D',
  },
  {
    roleId: 'crush',
    displayName: '小夜',
    description: '让你心跳加速的暧昧对象',
    availableInP0: true,
    avatarText: '夜',
    avatarColor: '#7C7AE0',
  },
  {
    roleId: 'stranger',
    displayName: '阿远',
    description: '刚认识的有趣灵魂',
    availableInP0: true,
    avatarText: '远',
    avatarColor: '#26A69A',
  },
  {
    roleId: 'disappointed',
    displayName: '阿辰',
    description: '有过好感但让你失望的人',
    availableInP0: true,
    avatarText: '辰',
    avatarColor: '#78909C',
  },
];
