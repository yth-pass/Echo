"""Wan2.7-Image-Pro DashScope 异步生图客户端。

封装三步：建任务 -> 轮询 -> 下载到本地。
"""

from __future__ import annotations

import base64
import logging
import mimetypes
import os
import time
from pathlib import Path

import httpx

log = logging.getLogger("wan-image")

DASHSCOPE_BASE = "https://dashscope.aliyuncs.com/api/v1"
GEN_ENDPOINT = "/services/aigc/image-generation/generation"
TASK_ENDPOINT = "/tasks"
MODEL = "wan2.7-image-pro"

# 输出目录：默认 Echo/outputs/images（相对 server.py 的上两级）
_DEFAULT_OUT = Path(__file__).resolve().parent.parent / "outputs" / "images"
OUTPUT_DIR = Path(os.environ.get("WAN_IMAGE_OUTPUT_DIR", str(_DEFAULT_OUT)))

POLL_INTERVAL = 3  # 秒
POLL_TIMEOUT = 300  # 秒（生图一般 1-2 分钟，留足余量）


def _get_api_key() -> str:
    key = os.environ.get("DASHSCOPE_API_KEY")
    if not key:
        raise RuntimeError(
            "DASHSCOPE_API_KEY 环境变量未设置。请在 WorkBuddy MCP 配置的 env 里提供。"
        )
    return key


def _create_task(
    api_key: str,
    messages: list,
    size: str,
    n: int,
    thinking_mode: bool,
    watermark: bool,
) -> dict:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "X-DashScope-Async": "enable",
        "Content-Type": "application/json",
    }
    body = {
        "model": MODEL,
        "input": {"messages": messages},
        "parameters": {
            "n": n,
            "size": size,
            "watermark": watermark,
            "thinking_mode": thinking_mode,
        },
    }
    with httpx.Client(timeout=30) as c:
        r = c.post(f"{DASHSCOPE_BASE}{GEN_ENDPOINT}", headers=headers, json=body)
        if r.status_code != 200:
            raise RuntimeError(f"建任务失败 {r.status_code}: {r.text}")
        return r.json()


def _poll_task(api_key: str, task_id: str) -> dict:
    headers = {"Authorization": f"Bearer {api_key}"}
    deadline = time.time() + POLL_TIMEOUT
    with httpx.Client(timeout=30) as c:
        while time.time() < deadline:
            r = c.get(
                f"{DASHSCOPE_BASE}{TASK_ENDPOINT}/{task_id}", headers=headers
            )
            if r.status_code != 200:
                raise RuntimeError(f"轮询失败 {r.status_code}: {r.text}")
            data = r.json()
            status = data.get("output", {}).get("task_status")
            log.info("task %s status=%s", task_id, status)
            if status == "SUCCEEDED":
                return data
            if status == "FAILED":
                msg = data.get("output", {}).get("message", "未知错误")
                raise RuntimeError(f"生图任务失败: {msg}")
            time.sleep(POLL_INTERVAL)
    raise TimeoutError(f"任务 {task_id} 轮询超时（{POLL_TIMEOUT}s）")


def _download_images(urls: list[str], task_id: str) -> list[dict]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out: list[dict] = []
    with httpx.Client(timeout=120) as c:
        for i, url in enumerate(urls):
            r = c.get(url)
            if r.status_code != 200:
                raise RuntimeError(f"下载图片失败 {r.status_code}: {url}")
            # 从 content-type 推断扩展名，默认 png
            ctype = r.headers.get("content-type", "")
            ext = "png"
            if "jpeg" in ctype or "jpg" in ctype:
                ext = "jpg"
            elif "webp" in ctype:
                ext = "webp"
            fname = f"{task_id}_{i}.{ext}"
            fpath = OUTPUT_DIR / fname
            fpath.write_bytes(r.content)
            out.append({"path": str(fpath), "url": url, "index": i})
    return out


def _extract_image_urls(output: dict) -> list[str]:
    """从任务结果里提取图片 URL。

    DashScope 返回有两种格式：
      1. output.results[].url          （image-generation 旧格式）
      2. output.choices[].message.content[].image  （messages 格式，Wan2.7 用这种）
    """
    urls: list[str] = []
    for item in output.get("results", []):
        if item.get("url"):
            urls.append(item["url"])
    for choice in output.get("choices", []):
        msg = choice.get("message", {})
        for c in msg.get("content", []):
            if c.get("image"):
                urls.append(c["image"])
    return urls


def _run(
    messages: list,
    size: str,
    n: int,
    thinking_mode: bool,
    watermark: bool,
) -> dict:
    api_key = _get_api_key()
    task = _create_task(api_key, messages, size, n, thinking_mode, watermark)
    task_id = task.get("output", {}).get("task_id")
    if not task_id:
        raise RuntimeError(f"未拿到 task_id: {task}")
    result = _poll_task(api_key, task_id)
    output = result.get("output", {})
    urls = _extract_image_urls(output)
    if not urls:
        raise RuntimeError(f"任务成功但无图片: {result}")
    images = _download_images(urls, task_id)
    return {
        "task_id": task_id,
        "model": MODEL,
        "count": len(images),
        "images": images,
        "output_dir": str(OUTPUT_DIR),
    }


def generate_image(
    prompt: str,
    size: str = "2K",
    n: int = 1,
    thinking_mode: bool = True,
    watermark: bool = False,
) -> dict:
    """文生图。"""
    messages = [{"role": "user", "content": [{"text": prompt}]}]
    return _run(messages, size, n, thinking_mode, watermark)


def _local_path_to_data_uri(local_path: str) -> str:
    """将本地文件路径转为 base64 data URI（DashScope HTTP API 支持此格式）。

    如果路径已经是 http/https/data: 开头，直接原样返回不做转换。
    """
    if local_path.startswith(("http://", "https://", "data:")):
        return local_path  # 已经是远程 URL 或 data URI，无需转换

    p = Path(local_path)
    if not p.is_file():
        raise FileNotFoundError(f"图片文件不存在: {local_path}")

    mime_type, _ = mimetypes.guess_type(str(p))
    if not mime_type or not mime_type.startswith("image/"):
        mime_type = "image/png"  # 兜底

    data = p.read_bytes()
    encoded = base64.b64encode(data).decode("ascii")
    data_uri = f"data:{mime_type};base64,{encoded}"
    log.info("local image %s -> data URI (%d chars, size=%d bytes)",
             p.name, len(data_uri), len(data))
    return data_uri


def edit_image(
    prompt: str,
    input_images: list[str],
    size: str = "2K",
    n: int = 1,
    thinking_mode: bool = True,
    watermark: bool = False,
) -> dict:
    """图生图/编辑。input_images 支持：
      - 公网 URL（http/https）
      - 本地文件路径（自动转为 base64 data URI）
      - data URI（data:image/...;base64,...）
    最多 1-9 张。
    """
    content: list = [{"text": prompt}]
    for img in input_images:
        content.append({"image": _local_path_to_data_uri(img)})
    messages = [{"role": "user", "content": content}]
    return _run(messages, size, n, thinking_mode, watermark)
