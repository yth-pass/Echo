#!/usr/bin/env bash
# =============================================================================
# Echo 仓库 .env 历史清理脚本（git filter-repo）
# -----------------------------------------------------------------------------
# 用途：从 git 全部历史中移除敏感文件（.env / .env.bak / .env.local 等），
#       防止历史版本中的凭证被回溯获取。
#
# ⚠️  核查结论（生成本脚本时的状态）：
#   - services/api/.env、services/worker/.env、services/worker/.env.bak、
#     Echo/.env.local 均未被 git 追踪（.gitignore 生效）
#   - 对全部已知密钥串执行 `git log --all -p -S <密钥>` 均无命中
#     → 当前 git 历史中【未发现】真实密钥泄露
#   - 本脚本为【预防性 / 兜底】工具：若日后发现历史曾被误提交，可直接运行
#
# ⚠️  危险操作：本脚本会重写 git 历史，所有协作者必须重新 clone 或 hard reset。
#       force push 会覆盖远程历史，不可逆。请人工确认后再执行 force push。
#
# 运行环境：Git Bash / WSL / Linux，需预先安装 git-filter-repo
#   安装：pip install git-filter-repo  （或 conda install -c conda-forge git-filter-repo）
# =============================================================================

set -euo pipefail

# ---------- 0. 前置检查 ----------
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> 当前仓库: $REPO_ROOT"
echo "==> 当前分支: $(git branch --show-current)"
echo

if ! command -v git-filter-repo >/dev/null 2>&1; then
  echo "❌ 未找到 git-filter-repo，请先安装："
  echo "   pip install git-filter-repo"
  echo "   或从 https://github.com/newren/git-filter-repo 获取"
  exit 1
fi

# git-filter-repo 默认要求在全新 clone 上运行；如需在现有仓库运行需加 --force
echo "⚠️  本脚本将重写 git 历史。建议先在【全新 clone 的副本】上测试。"
read -r -p "确认在当前仓库继续？(输入 YES 继续): " CONFIRM
if [ "$CONFIRM" != "YES" ]; then
  echo "已取消。"
  exit 0
fi

# ---------- 1. 备份当前分支 ----------
BACKUP_BRANCH="backup/pre-filter-$(date +%Y%m%d-%H%M%S)"
echo
echo "==> 1/4 备份当前分支到 $BACKUP_BRANCH"
git branch "$BACKUP_BRANCH"
echo "    （如需回滚：git reset --hard $BACKUP_BRANCH）"

# ---------- 2. 待清理的敏感文件清单 ----------
# 注意：.env.example 是模板，需保留，不在此清单中
PATHS_TO_REMOVE=(
  ".env"
  "services/api/.env"
  "services/worker/.env"
  "services/worker/.env.bak"
  "Echo/.env.local"
  "Echo/.env"
)

echo
echo "==> 2/4 将从历史中移除以下文件（保留工作区现状）："
for p in "${PATHS_TO_REMOVE[@]}"; do
  echo "    - $p"
done

# ---------- 3. 执行 git filter-repo ----------
echo
echo "==> 3/4 执行 git filter-repo（重写历史）"
ARGS=()
for p in "${PATHS_TO_REMOVE[@]}"; do
  ARGS+=(--path "$p")
done
ARGS+=(--invert-paths --force)

git filter-repo "${ARGS[@]}"

echo "    历史重写完成。"
echo "    备份分支仍保留在本地：$BACKUP_BRANCH"

# ---------- 4. 远程强制推送（不自动执行） ----------
echo
echo "==> 4/4 远程强制推送（需人工执行，脚本不自动运行）"
echo
echo "⚠️  force push 会覆盖远程历史，所有协作者必须重新 clone 或执行："
echo "    git fetch origin && git reset --hard origin/<branch>"
echo
echo "请【人工确认】后手动执行以下命令："
echo
echo "    git push origin --force --all"
echo "    git push origin --force --tags"
echo
echo "推送完成后，通知所有协作者重新 clone 仓库。"
echo
echo "✅ 清理流程结束。"
echo
echo "后续建议："
echo "  1. 轮换所有曾出现在历史中的密钥（见 outputs/密钥轮换清单.md）"
echo "  2. 在 GitHub 仓库 Settings 检查是否需要联系 GitHub Support 清理缓存/PR/fork"
echo "  3. 删除本地 backup 分支前，确认远程推送成功且协作者已同步"
