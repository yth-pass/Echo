# 主题状态机

| 字段 | 值 |
|------|-----|
| **相关** | [storage-schema.md](./storage-schema.md)、[schemas/topic_judge_output.schema.json](./schemas/topic_judge_output.schema.json) |

主/次主题模型：主线持续、岔题可返回。

---

## 1. 概念

| 概念 | 说明 |
|------|------|
| **main_topic** | 主线（如「周末作业进度」） |
| **active_subtopic** | 当前岔题（如「吐槽班主任」） |
| **subtopic_history** | 已结束次主题 |
| **focus** | `"main"` 或 `"sub"` |

**仅 `new_main` 整文件重置。** 次主题用 return/history，不替换主线。

---

## 2. 五种 transition

| transition | 行为 |
|------------|------|
| `continue_main` | 更新 main summary |
| `continue_sub` | 更新 sub summary |
| `new_sub` | 开岔题，main 保留 |
| `return_to_main` | sub → history；回到 main |
| `new_main` | 整包 → topic_history；重置 |

---

## 3. 开场默认

`main_topic` = 「寒暄与开场」；`active_subtopic` = null。

---

## 4. TopicJudge

输入：`current_topic`、最近 3–5 轮、新消息。  
输出 schema：[topic_judge_output.schema.json](./schemas/topic_judge_output.schema.json)。

---

## 5. 联合会话

A↔B **一份** `joint_sessions/{id}/current_topic.json`。  
见 [adr/005-joint-session-single-topic-file.md](./adr/005-joint-session-single-topic-file.md)。

完整 walkthrough 与英文版一致，见 [topic-state-machine.md](../agent-platform/topic-state-machine.md)。
