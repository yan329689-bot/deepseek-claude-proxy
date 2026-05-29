# DeepSeek Claude Proxy

修复 Claude Code 非交互模式与 DeepSeek API 的兼容性问题。

## 问题

从 Claude Code `2.1.154` 开始，非交互模式（`claude -p`、飞书 bridge 等）会将系统提示词以 `role: "system"` 的形式放进 `messages` 数组：

```json
{
  "messages": [
    {"role": "system", "content": "你是 Claude Code…"},
    {"role": "user", "content": "你好"}
  ]
}
```

DeepSeek 的 Anthropic 兼容接口严格校验 `messages` 数组，只接受 `user` 和 `assistant` role，返回 400 错误：

```
messages[1].role: unknown variant system, expected user or assistant
```

## 解决方案

本地代理（几十行 Node.js）部署在 `127.0.0.1:18765`，自动将 `system` role 从 `messages` 数组提取到顶层 `system` 字段，再转发给 DeepSeek。

## 安装

```bash
git clone https://github.com/<your-username>/deepseek-claude-proxy.git
cd deepseek-claude-proxy
```

## 使用

### 1. 启动代理

```bash
node server.js
```

### 2. 配置 Claude Code

在 `~/.claude/settings.json` 中：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:18765",
    "ANTHROPIC_AUTH_TOKEN": "<你的 DeepSeek API Key>",
    "ANTHROPIC_MODEL": "deepseek-v4-pro"
  }
}
```

### 3. 设置持久运行

**macOS（launchd）：** 或直接 crontab：

```bash
# 开机自启
crontab -e
@reboot /usr/local/bin/node /path/to/deepseek-claude-proxy/server.js >> /tmp/proxy.log 2>&1

# 每 5 分钟健康检查
*/5 * * * * curl -s -o /dev/null http://127.0.0.1:18765/health || /usr/local/bin/node /path/to/deepseek-claude-proxy/server.js >> /tmp/proxy.log 2>&1
```

**Linux（systemd）：**

```ini
[Unit]
Description=DeepSeek Claude Proxy
After=network.target

[Service]
ExecStart=/usr/bin/node /path/to/deepseek-claude-proxy/server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

## 工作原理

```
Claude Code → http://127.0.0.1:18765 → 修复 system role → DeepSeek API
```

代理只做一件事：检测 `messages` 数组中是否有 `role: "system"` 的消息，若有则提取其内容到请求体的顶层 `system` 字段，然后原样转发给 DeepSeek。请求本身没有 system role 问题时，直接放行。

## 适用场景

- Claude Code 连接 DeepSeek API
- 非交互模式：`claude -p`、管道输入
- 飞书/钉钉 bridge 调用 Claude Code
- 任何通过脚本/程序调用 Claude Code 的场景

## License

MIT
