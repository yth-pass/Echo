# Echo 合规文档生成报告

## 已完成

为 Echo 项目撰写了两份核心合规文档，中英文双语版本：

### 1. 用户协议 (Terms of Service)
- **中文**：`docs_CN/Echo-Terms-of-Service.md`
- **英文 (canonical)**：`docs/Echo-Terms-of-Service.md`

涵盖：服务说明、注册资格（≥18岁）、账号安全、数字分身授权协议、用户行为规范、内容审核与举报、真人转接安全提示、知识产权、免责声明、争议解决（中国法律管辖）。

### 2. 隐私政策 (Privacy Policy)
- **中文**：`docs_CN/Echo-Privacy-Policy.md`
- **英文 (canonical)**：`docs/Echo-Privacy-Policy.md`

涵盖：M1-M4 四层数据收集详表、合法性基础（PIPL 第13条）、第三方委托处理（DeepSeek/阿里云/FCM）、存储与加密方案、保留期限、用户八项权利、自动化决策说明、未成年人保护、跨境传输说明。

## 关键决策

- **遵循 PIPL 为主**，GDPR 兼容为辅（预留国际扩展接口）
- 中英文文档内容一致，中文版为权威版本
- 所有占位符（邮箱、DPO 姓名等）已标注，上线前需替换为实际信息
- 数据分类与 Echo 实际数据模型一一对应（18 个数据库表全覆盖）

## 待办

- [ ] 替换占位邮箱（legal@echo-app.cn / privacy@echo-app.cn）为实际邮箱
- [ ] 填写数据保护负责人（DPO）实际姓名和联系方式
- [ ] 在入驻前接入同意弹窗（FR-003）
- [ ] 考虑请专业律师进行最终审核
