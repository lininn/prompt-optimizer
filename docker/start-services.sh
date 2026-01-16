#!/bin/sh

# 创建日志目录
mkdir -p /var/log/supervisor

# 处理nginx配置文件中的环境变量
echo "Processing nginx configuration with environment variables..."
envsubst '${NGINX_PORT}' < /etc/nginx/conf.d/default.conf > /tmp/nginx.conf
mv /tmp/nginx.conf /etc/nginx/conf.d/default.conf
echo "Nginx configuration updated with NGINX_PORT=${NGINX_PORT}"

# 运行原有的nginx初始化脚本
echo "Running nginx initialization scripts..."
for script in /docker-entrypoint.d/*.sh; do
    if [ -f "$script" ] && [ -x "$script" ]; then
        echo "Running $script"
        sh "$script" || echo "WARNING: $script failed with exit code $?"
    elif [ -f "$script" ]; then
        echo "WARNING: $script is not executable, attempting to run anyway..."
        sh "$script" || echo "WARNING: $script failed with exit code $?"
    fi
done

# 验证config.js是否已生成
if [ -f "/usr/share/nginx/html/config.js" ]; then
    echo "✅ config.js generated successfully"
    echo "Content preview:"
    head -n 5 /usr/share/nginx/html/config.js
else
    echo "❌ ERROR: config.js was not generated!"
    echo "Attempting manual generation..."
    sh /docker-entrypoint.d/40-generate-config.sh || echo "Manual generation failed"
fi

# 等待 MySQL 就绪（如果启用了认证）
if [ "$AUTH_ENABLED" = "true" ]; then
    echo "Waiting for MySQL to be ready..."
    DB_HOST=${DB_HOST:-mysql}
    DB_PORT=${DB_PORT:-3306}
    MAX_RETRIES=30
    RETRY_COUNT=0

    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
            echo "✅ MySQL is ready at $DB_HOST:$DB_PORT"
            # 额外等待 2 秒确保 MySQL 完全初始化
            sleep 2
            break
        fi
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "Waiting for MySQL... ($RETRY_COUNT/$MAX_RETRIES)"
        sleep 2
    done

    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo "❌ ERROR: MySQL did not become ready after $MAX_RETRIES retries"
        echo "Continuing anyway, MCP Server may fail to start..."
    fi
fi

echo "Starting services with supervisor..."
echo "MCP Server will run on port: ${MCP_HTTP_PORT}"
echo "MCP Server log level: ${MCP_LOG_LEVEL}"

# 启动supervisor
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
