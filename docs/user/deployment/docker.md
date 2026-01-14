# Docker 自托管部署指南

适用场景：在自有服务器（云主机/本地机房）使用 Docker 或 Docker Compose 部署 Prompt Optimizer（Web + MCP 服务器一体）。

## 部署架构与镜像
- 组件：Nginx 提供静态 Web，`/mcp` 反代 Node.js MCP 服务器，Supervisor 管理多进程。
- 参考文件：`Dockerfile`、`docker-compose.yml`（默认使用镜像 `linshen/prompt-optimizer:latest`，也支持本地构建）。
- 默认端口：容器内 Nginx 监听 `NGINX_PORT`（默认 80），对外映射为主机 28081。

## 前置条件
1. 服务器已安装 Docker（≥20）与 Docker Compose / Compose v2 插件。
2. 放行对外端口（默认 28081，或你自定义的映射端口）。
3. 预先准备 LLM API Key（至少配置一个可用的模型提供商）。

## 环境变量
在项目根目录创建 `.env`（可参考 `env.local.example`），常用项如下：
```env
# 对外端口映射保持默认即可；如需变更，请同时修改 docker-compose.yml 中的端口映射
NGINX_PORT=80

# 至少配置一个模型 API 密钥（任选其一或多项）
VITE_OPENAI_API_KEY=sk-xxx
# VITE_GEMINI_API_KEY=...
# VITE_DEEPSEEK_API_KEY=...
# VITE_SILICONFLOW_API_KEY=...
# VITE_CUSTOM_API_KEY=...            # 自定义/本地 OpenAI 兼容服务
# VITE_CUSTOM_API_BASE_URL=...
# VITE_CUSTOM_API_MODEL=...

# MCP 首选模型（如使用自定义模型请与上方密钥匹配）
MCP_DEFAULT_MODEL_PROVIDER=openai

# Web 访问基本认证（可选，强烈建议生产环境配置强密码）
ACCESS_USERNAME=admin
ACCESS_PASSWORD=请改成强密码
```
> 提示：未设置 `ACCESS_PASSWORD` 则无访问保护；如要关闭基本认证，可将用户名密码变量留空。

## 构建与部署流程
### 方案 A：使用官方镜像（推荐，最快）
```bash
# 拉取镜像
docker compose pull
# 启动
docker compose up -d
```

### 方案 B：本地构建镜像（需在当前代码基础上打包）
```bash
# 构建镜像（多阶段构建，内置 pnpm 安装与前后端编译）
docker compose build
# 启动
docker compose up -d
```
> 如需推送到自有镜像仓库，可先 `docker tag` / `docker push` 后，在 `docker-compose.yml` 中调整 `image` 引用。

## 启动验证
```bash
# 查看容器状态（包含健康检查）
docker compose ps

# 实时日志
docker compose logs -f prompt-optimizer

# 基础连通性（首页）
curl -I http://<服务器IP>:28081/

# MCP 入口检查
curl -I http://<服务器IP>:28081/mcp
```
浏览器访问 `http://<服务器IP>:28081`，若启用了基本认证会先弹出登录框。

## 常见调整
- **更换对外端口**：修改 `docker-compose.yml` 的端口映射（左侧宿主机端口），如 `8080:${NGINX_PORT:-80}`，然后 `docker compose up -d`.
- **TLS/自定义域名**：推荐在宿主机或上层网关（Nginx/Caddy/Traefik/Cloudflare Tunnel）做 HTTPS 终结，再转发到容器的 28081（或自定义端口）。
- **更新版本**：`docker compose pull && docker compose up -d`（官方镜像）或重新 `docker compose build`。
- **调试 MCP**：`docker compose exec prompt-optimizer supervisorctl status` / `tail -f /var/log/supervisor/mcp-server.out.log`。

## 目录与文件参考
- `docker-compose.yml`：部署入口，支持直接拉取镜像或切换为本地构建。
- `Dockerfile`：多阶段构建，先编译前端与 MCP，再由 nginx+supervisor 统一托管。
- `docker/`：启动脚本、Nginx 配置、Supervisor 配置（`start-services.sh`、`nginx.conf` 等）。

## 常见问题
1) **页面访问 401/要求登录**：检查是否配置了 `ACCESS_USERNAME/ACCESS_PASSWORD`；如不需要认证，留空这两个变量并重启。  
2) **模型不可用/调用报错**：确认至少填了一个对应的 `VITE_*_API_KEY`，并与 `MCP_DEFAULT_MODEL_PROVIDER` 匹配。  
3) **端口被占用**：修改 `docker-compose.yml` 的宿主机端口映射后重新 `up -d`。  
4) **构建失败（网络/依赖）**：确认服务器能访问 npm/pnpm 源，可适当配置镜像源或重试；也可改用官方已构建镜像部署。
