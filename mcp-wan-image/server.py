"""Wan2.7-Image-Pro MCP Server。

通过 stdio 与 WorkBuddy 通信，暴露两个工具：
  - generate_image: 文生图
  - edit_image: 图生图/编辑

环境变量：
  DASHSCOPE_API_KEY     必填，阿里云百炼 API Key
  WAN_IMAGE_OUTPUT_DIR  可选，图片保存目录（默认 Echo/outputs/images）
"""

from __future__ import annotations

import logging
import sys

from mcp.server.fastmcp import FastMCP

from dashscope_client import edit_image as _edit_image
from dashscope_client import generate_image as _generate_image

# MCP stdio: 日志只能走 stderr，stdout 是协议通道
logging.basicConfig(
    level=logging.INFO,
    stream=sys.stderr,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("wan-image")

mcp = FastMCP("wan-image")


@mcp.tool()
def generate_image(
    prompt: str,
    size: str = "2K",
    n: int = 1,
    thinking_mode: bool = True,
    watermark: bool = False,
) -> dict:
    """根据文本提示词生成图片（Wan2.7-Image-Pro）。

    Args:
        prompt: 图片描述提示词，建议用中文或英文详细描述画面
        size: 输出分辨率，可选 "1K" / "2K" / "4K"，默认 "2K"
            文生图支持 1K/2K/4K；其他场景仅 1K/2K
        n: 生成数量 1-4，默认 1
        thinking_mode: 是否启用思考模式（生图质量更高但更慢），默认 True
        watermark: 是否加水印，默认 False

    Returns:
        dict: {
            "task_id": 任务ID,
            "model": "wan2.7-image-pro",
            "count": 图片数量,
            "images": [{"path": 本地路径, "url": 原始URL, "index": 序号}],
            "output_dir": 保存目录
        }
        生成的图片会下载到本地，path 字段可直接嵌入文档/HTML。
    """
    log.info("generate_image: prompt=%r size=%s n=%d", prompt[:80], size, n)
    return _generate_image(prompt, size, n, thinking_mode, watermark)


@mcp.tool()
def edit_image(
    prompt: str,
    input_images: list[str],
    size: str = "2K",
    n: int = 1,
    thinking_mode: bool = True,
    watermark: bool = False,
) -> dict:
    """基于参考图片进行编辑或生成（Wan2.7-Image-Pro 图生图）。

    Args:
        prompt: 编辑指令/描述
        input_images: 参考图片 URL 列表，1-9 张
            （DashScope 要求图片为可访问的 URL，支持 JPEG/JPG/PNG/BMP/WEBP，单张 ≤20MB）
        size: 输出分辨率，可选 "1K" / "2K"，默认 "2K"（图生图不支持 4K）
        n: 生成数量 1-4，默认 1
        thinking_mode: 是否启用思考模式，默认 True
        watermark: 是否加水印，默认 False

    Returns:
        dict: 同 generate_image，结果图片下载到本地
    """
    log.info("edit_image: prompt=%r imgs=%d size=%s", prompt[:80], len(input_images), size)
    return _edit_image(prompt, input_images, size, n, thinking_mode, watermark)


if __name__ == "__main__":
    mcp.run()
