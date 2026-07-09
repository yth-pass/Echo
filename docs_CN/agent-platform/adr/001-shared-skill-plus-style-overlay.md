# ADR 001：共享 Skill + 风格 Overlay

| 字段 | 值 |
|------|-----|
| **状态** | 已接受 |
| **日期** | 2026-06-10 |

## 背景

每用户需要个性化语气。每用户复制完整 skill 目录成本高且难升级。

## 决策

- 全员一份 `shared-agent/`  
- 每用户仅 `users/{id}/style.md`  
- 风格文件不含客观事实  

## 后果

- 平台升级只改共享底座  
- Composer 每轮合并 L1 + L2  
- 迁移期与 `persona_prompts` 双写（见 echo-mapping）  
