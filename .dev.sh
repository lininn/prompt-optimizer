#!/usr/bin/env bash
set -euo pipefail

# 本地快速启动（加载 .env/.env.local），用于验证认证与验证码接口
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# Node 版本检查（需要 18/20/22）
NODE_VERSION="$(node -v || true)"
NODE_MAJOR="$(node -v | sed 's/^v//; s/\..*//')"
if [[ "$NODE_MAJOR" != "18" && "$NODE_MAJOR" != "20" && "$NODE_MAJOR" != "22" ]]; then
  echo "当前 Node 版本 ${NODE_VERSION} 不受支持，请使用 18/20/22（建议：nvm install 22 && nvm use 22）。"
  exit 1
fi
echo "检测到 Node 版本: ${NODE_VERSION}（已通过版本检查）"

ENV_FILE="${ENV_FILE:-.env}"
if [ -f "$ENV_FILE" ]; then
  echo "加载环境变量: $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  echo "未找到 $ENV_FILE，使用已有环境变量"
fi

echo "安装依赖..."
pnpm install

echo "构建 mcp-server..."
pnpm -F @prompt-optimizer/mcp-server build

PORT="${MCP_HTTP_PORT:-3000}"
echo "启动 mcp-server (HTTP, 端口: $PORT)..."
pnpm -F @prompt-optimizer/mcp-server dev -- --transport=http --port="$PORT"
