# Wan2.7-Image-Pro MCP Server

把阿里云通义万相 **Wan2.7-Image-Pro** 文生图模型接入 WorkBuddy 的 MCP 服务。

## 工作原理

Wan2.7-Image-Pro 的 DashScope 接口是**异步**的（建任务 → 轮询 → 取图 URL），与 WorkBuddy 自定义模型期望的同步 chat/completions 协议不兼容。本服务把异步流程封装成一个**同步 MCP 工具**，WorkBuddy 在任务中按需调用即可生图，图片自动下载到本地。

```
WorkBuddy --tool call--> MCP Server --建任务--> DashScope
                                   <--轮询----
                                   --下载图片-->
WorkBuddy <--本地路径+URL---------- MCP Server
```

## 暴露的工具

| 工具 | 作用 | 关键参数 |
|------|------|----------|
| `generate_image` | 文生图 | `prompt`、`size`(1K/2K/4K)、`n`(1-4)、`thinking_mode`、`watermark` |
| `edit_image` | 图生图/编辑 | `prompt`、`input_images`(URL列表,1-9张)、`size`(1K/2K)、`n` |

返回结构（JSON）：
```json
{
  "task_id": "8811b4a4-...",
  "model": "wan2.7-image-pro",
  "count": 1,
  "images": [{"path": "C:/.../outputs/images/xxx_0.png", "url": "https://...", "index": 0}],
  "output_dir": "C:/Users/Administrator/Desktop/Echo/outputs/images"
}
```

## 文件结构

```
mcp-wan-image/
├── server.py              # MCP Server 主程序（FastMCP）
├── dashscope_client.py    # DashScope 异步生图封装
├── requirements.txt
├── .env.example           # 环境变量模板
├── .gitignore
└── README.md
```

## 运行环境

- Python 3.13（隔离 venv: `C:/Users/Administrator/.workbuddy/binaries/python/envs/wan-image`）
- 依赖：`mcp`、`httpx`

## 在 WorkBuddy 中注册

在 `~/.workbuddy/mcp.json` 添加：

```json
{
  "mcpServers": {
    "wan-image": {
      "command": "C:\\Users\\Administrator\\.workbuddy\\binaries\\python\\envs\\wan-image\\Scripts\\python.exe",
      "args": ["C:\\Users\\Administrator\\Desktop\\Echo\\mcp-wan-image\\server.py"],
      "env": {
        "DASHSCOPE_API_KEY": "你的Key",
        "WAN_IMAGE_OUTPUT_DIR": "C:\\Users\\Administrator\\Desktop\\Echo\\outputs\\images"
      }
    }
  }
}
```

保存后到 WorkBuddy 连接器管理页对新 server 点击 **Trust** 启用。

## 使用示例

在 WorkBuddy 对话中：
- "帮我生成一张赛博朋克风格的城市夜景图" → 调用 `generate_image`
- "用这张产品图生成三个不同背景的版本" → 调用 `edit_image`（需提供图片 URL）

## 排错

- **DASHSCOPE_API_KEY 未设置**：检查 mcp.json 的 env 字段
- **生图超时**：Wan2.7 通常 1-2 分钟，4K 或多张会更久；`dashscope_client.py` 的 `POLL_TIMEOUT` 可调大
- **图片下载失败**：URL 有时效，轮询成功后立即下载；若仍失败检查网络
- **MCP server 未出现在列表**：确认 WorkBuddy 已 Trust，重启 WorkBuddy
