# ADR 005：联合会话单一 Topic 文件

| 字段 | 值 |
|------|-----|
| **状态** | 已接受 |
| **日期** | 2026-06-10 |

## 背景

A、B 同场对话若各维护 topic 会分歧。

## 决策

- clone 互聊：**一份** `joint_sessions/{id}/current_topic.json`  
- 每轮 TopicJudge 写一次（worker 单写者）  
- 社交记忆与好感仍按观察者分开（ADR 002）  

## 后果

- 私聊用 `users/{id}/sessions/{session_id}/current_topic.json`  
- Echo 可嵌入 `agent_sessions.metadata_json`  
