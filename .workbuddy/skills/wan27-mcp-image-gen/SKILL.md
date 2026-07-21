---
name: wan27-mcp-image-gen
description: 把阿里云通义万相 Wan2.7-Image-Pro（DashScope 异步生图 API）封装为 WorkBuddy MCP 工具的工作流。适用于将任何异步文生图/图生图 API 接入 WorkBuddy via MCP server。触发词：接入生图模型、文生图 MCP、DashScope 生图、Wan2.7、图生图 MCP server。
agent_created: true
---

# Wan2.7-Image-Pro MCP 接入指南

## Overview

Wan2.7-Image-Pro 的 DashScope API 是**异步**的（建任务 → 轮询 → 取图 URL），与 WorkBuddy 自定义模型期望的同步 chat/completions 协议不兼容。本工作流通过 **MCP server + FastMCP** 把异步流程封装为同步工具，让 WorkBuddy 在任务中按需调用生图。

## When to Use

- 用户要把 DashScope 的 `wan2.7-image-pro` 或 `wan2.7-image` 接入 WorkBuddy
- 类似场景：任何**异步生图 API**（建任务+轮询模式）接入 WorkBuddy
- 触发词：`接入生图`、`MCP 生图`、`Wan2.7`、`DashScope MCP`

## Architecture

```
WorkBuddy --tool call--> MCP Server (FastMCP, stdio)
                            │
                            ├── POST /aigc/image-generation/generation
                            │      (X-DashScope-Async: enable)
                            │      → task_id + PENDING
                            │
                            ├── GET /tasks/{task_id}  (poll 3s)
                            │      → SUCCEEDED with images
                            │
                            └── download to local: outputs/images/{task_id}_{idx}.png
                                 → return { path, url, index }
```

**核心洞察**：WorkBuddy 的 `models.json` / 自定义模型只能对话补全模式，不支持异步生图 API。MCP 是正确入口。

## Step-by-Step Workflow

### 1. Create project structure

```
mcp-wan-image/
├── server.py              # FastMCP entry, exposes tools via stdio
├── dashscope_client.py    # Create task + poll + download
├── verify.py              # Quick smoke test (optional)
├── requirements.txt       # mcp>=1.2.0, httpx>=0.27.0
├── .env.example
├── .gitignore
└── README.md
```

### 2. Implement dashscope_client.py

Three internal functions:

- **`_create_task(api_key, messages, size, n, thinking_mode, watermark)`** — POST to DashScope with `X-DashScope-Async: enable` header. Returns `{ output: { task_id } }`.
- **`_poll_task(api_key, task_id, timeout=300, interval=3)`** — GET `/tasks/{task_id}` in loop. Exits on `SUCCEEDED` or `FAILED`.
- **`_download_images(urls, task_id)`** — Download each URL to `OUTPUT_DIR`, return `[{path, url, index}]`.

Two public functions call these in sequence:

- **`generate_image(prompt, size, n, thinking_mode, watermark)`** — text-to-image
- **`edit_image(prompt, input_images, size, n, thinking_mode, watermark)`** — image-to-image

### 3. Implement server.py

Use `FastMCP("wan-image")` with `@mcp.tool()` decorators. Tools return dicts (FastMCP auto-serializes to JSON).

Logging must go to **stderr** (MCP stdio protocol uses stdout for messages).

### 4. Create isolated venv

```bash
python -m venv <isolated-venv-path>
pip install mcp httpx
```

### 5. Register in WorkBuddy

Write to `~/.workbuddy/mcp.json`:

```json
{
  "mcpServers": {
    "wan-image": {
      "command": "<venv>/Scripts/python.exe",
      "args": ["<project>/mcp-wan-image/server.py"],
      "env": {
        "DASHSCOPE_API_KEY": "<your-key>",
        "WAN_IMAGE_OUTPUT_DIR": "<output-dir>"
      }
    }
  }
}
```

Then go to WorkBuddy → Connectors → Trust the new `wan-image` server.

## Critical Pitfalls

### DashScope response format: TWO variants

Wan2.7-Image-Pro can return images in two different formats. Always check **both**:

```
Format A: output.results[].url          (legacy image-generation format)
Format B: output.choices[].message.content[].image  (messages format, Wan2.7 default)
```

Implementation — iterate both paths:

```python
def _extract_image_urls(output):
    urls = []
    for item in output.get("results", []):
        if item.get("url"):
            urls.append(item["url"])
    for choice in output.get("choices", []):
        for c in choice.get("message", {}).get("content", []):
            if c.get("image"):
                urls.append(c["image"])
    return urls
```

### `mcp` package has no `__version__`

Use `importlib.metadata.version("mcp")` instead of `mcp.__version__`.

### Logging goes to stderr

MCP stdio transport uses stdout for protocol messages. All logging must use `logging.StreamHandler(sys.stderr)`.

## References

- `references/dashscope_api.md` — DashScope API endpoint, headers, body format with all parameters documented
