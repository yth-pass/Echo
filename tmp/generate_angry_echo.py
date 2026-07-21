"""
直接调用 dashscope_client 生成回声精灵生气表情。
"""
import os
import sys
import shutil

# 设置 API Key
os.environ["DASHSCOPE_API_KEY"] = "sk-d8c088af83444d4698ab87069687b72d"
os.environ["WAN_IMAGE_OUTPUT_DIR"] = r"C:\Users\Administrator\Desktop\Echo\tmp\gen_output"

# 将 mcp-wan-image 加入 sys.path
sys.path.insert(0, r"C:\Users\Administrator\Desktop\Echo\mcp-wan-image")

from dashscope_client import edit_image

# 目标输出目录
output_dir = r"C:\Users\Administrator\Desktop\Echo\Echo\logo\icons_gender"

# 图片 URL（已上传到 uguu.se）
boy_url = "https://d.uguu.se/lsFAnABl.png"
girl_url = "https://o.uguu.se/rSoAzaPH.png"

boy_prompt = "将此蓝色水滴形可爱卡通角色改为生气的表情 - 眉毛紧皱呈倒八字型（><形状），眼睛怒视瞪大，嘴角下撇不高兴地撅嘴，脸颊因为生气而鼓胀并有红色怒气标记。保持蓝色水滴形身体、小耳朵、爱心装饰和整体Q版可爱风格完全不变。"

girl_prompt = "将此粉色水滴形可爱卡通角色改为生气的表情 - 眉毛紧皱呈倒八字型（><形状），眼睛怒视瞪大，嘴角下撇不高兴地撅嘴，脸颊因为生气而鼓胀并有红色怒气标记。保持粉色水滴形身体、小耳朵、爱心装饰和整体Q版可爱风格完全不变。"

print("=" * 60)
print("开始生成 echo_boy_angry（男孩生气表情）...")
print("=" * 60)

boy_result = edit_image(
    prompt=boy_prompt,
    input_images=[boy_url],
    size="2K",
    n=1,
    thinking_mode=True,
    watermark=False,
)

print(f"男孩生图完成: {boy_result['count']} 张")
for img in boy_result["images"]:
    src = img["path"]
    dst = os.path.join(output_dir, "echo_boy_angry.png")
    shutil.copy2(src, dst)
    print(f"  已保存: {dst}")

print()
print("=" * 60)
print("开始生成 echo_girl_angry（女孩生气表情）...")
print("=" * 60)

girl_result = edit_image(
    prompt=girl_prompt,
    input_images=[girl_url],
    size="2K",
    n=1,
    thinking_mode=True,
    watermark=False,
)

print(f"女孩生图完成: {girl_result['count']} 张")
for img in girl_result["images"]:
    src = img["path"]
    dst = os.path.join(output_dir, "echo_girl_angry.png")
    shutil.copy2(src, dst)
    print(f"  已保存: {dst}")

print()
print("=" * 60)
print("全部完成！")
print(f"输出目录: {output_dir}")
print("=" * 60)
