"""最小验证脚本：用 1K 分辨率跑一次文生图，确认 API Key 和接口可用。

用法（需先装好依赖）：
    set DASHSCOPE_API_KEY=sk-xxxx
    python verify.py
"""

from __future__ import annotations

import os
import sys

# 确保能 import 同目录模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dashscope_client import generate_image

if __name__ == "__main__":
    key = os.environ.get("DASHSCOPE_API_KEY")
    if not key:
        print("ERROR: DASHSCOPE_API_KEY 未设置", file=sys.stderr)
        sys.exit(1)
    print("开始验证 Wan2.7-Image-Pro 生图（1K，最快）...")
    try:
        result = generate_image(
            prompt="一只在草地上奔跑的橘猫，阳光明媚，写实风格",
            size="1K",
            n=1,
            thinking_mode=False,  # 关闭思考，加快验证
            watermark=False,
        )
        print("\n=== 验证成功 ===")
        print(f"task_id: {result['task_id']}")
        print(f"图片数量: {result['count']}")
        for img in result["images"]:
            print(f"  本地路径: {img['path']}")
            print(f"  原始 URL: {img['url']}")
        print(f"保存目录: {result['output_dir']}")
    except Exception as e:
        print(f"\n=== 验证失败 ===\n{e}", file=sys.stderr)
        sys.exit(1)
