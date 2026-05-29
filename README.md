# DeepSeek Claude Proxy

修复 Claude Code 非交互模式与 DeepSeek API 的 `system` role 兼容性问题。

## 1. 为什么会出现这个问题

### 背景

很多人用 DeepSeek API 来驱动 Claude Code，因为 DeepSeek 提供了 Anthropic 兼容接口：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.deepseek.com/anthropic",
    "ANTHROPIC_MODEL": "deepseek-v4-pro"
  }
}
```

在终端里交互式使用（打开 `claude` 对着聊天）一切正常。

### 触发条件

当你用**非交互模式**时就会炸，比如：

- `echo "hello" | claude -p`（管道输入）
- 飞书/钉钉 bridge 调用 Claude Code（后台自动回复）
- 任何脚本/程序通过 SDK 调用 Claude Code

报错：

```
API Error: 400 Failed to deserialize the JSON body into the target type:
messages[1].role: unknown variant system, expected user or assistant
```

### 根因

Claude Code 内部有两种模式，构建 API 请求的方式不同：

**交互模式（终端聊天）**——系统提示词放在请求体顶层：

```json
{
  "system": "你是 Claude Code…（CLAUDE.md、skills 等上下文）",
  "messages": [
    {"role": "user", "content": "你好"}
  ]
}
```

**非交互模式（`claude -p` / bridge 调用）**——从 2.1.154 开始，系统提示词被错误地塞进了 `messages` 数组：

```json
{
  "messages": [
    {"role": "system", "content": "你是 Claude Code…"},
    {"role": "user", "content": "你好"}
  ]
}
```

Anthropic 官方 API 对 `messages` 数组里的 `system` role 比较宽容，不做严格校验。但 DeepSeek 的兼容接口严格遵循规范——`messages` 数组只允许 `user` 和 `assistant`，遇到 `system` 直接返回 400。

**简单说：Claude Code 写了不符合规范的请求格式，真正的 Anthropic 不管，DeepSeek 管。**

## 2. 解决方案

一个轻量本地代理，部署在 `127.0.0.1:18765`，夹在 Claude Code 和 DeepSeek 之间。

它只做一件事：

```
Claude Code 发来请求
  ↓
检测 messages 数组里有没有 role: "system"
  ↓ 有 → 提取内容，移到顶层 system 字段
  ↓ 没有 → 直接放行
  ↓
转发给 DeepSeek → 返回结果 → 原样送回 Claude Code
```

整个过程对两边透明，几十行 Node.js 代码，零依赖。

## 3. 使用方式

### 第一步：下载

```bash
git clone https://github.com/yan329689-bot/deepseek-claude-proxy.git
cd deepseek-claude-proxy
```

### 第二步：启动代理

```bash
node server.js
```

看到以下输出表示启动成功：

```
[proxy] 启动成功: http://127.0.0.1:18765 → https://api.deepseek.com/anthropic
```

### 第三步：配置 Claude Code

编辑 `~/.claude/settings.json`，将 `ANTHROPIC_BASE_URL` 指向本地代理：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:18765",
    "ANTHROPIC_AUTH_TOKEN": "<你的 DeepSeek API Key>",
    "ANTHROPIC_MODEL": "deepseek-v4-pro"
  }
}
```

### 第四步：测试

```bash
echo "你好" | claude -p
```

正常返回即表示修复成功。

### 第五步：持久化（代理在后台一直跑）

**macOS：**

```bash
crontab -e
```

添加两行：

```
@reboot /usr/local/bin/node /path/to/deepseek-claude-proxy/server.js >> /tmp/dscp.log 2>&1
*/5 * * * * curl -s http://127.0.0.1:18765/health || /usr/local/bin/node /path/to/deepseek-claude-proxy/server.js >> /tmp/dscp.log 2>&1
```

第一行开机自启，第二行每 5 分钟检查一次，挂了就拉起来。

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

保存为 `/etc/systemd/system/deepseek-claude-proxy.service`，然后：

```bash
sudo systemctl enable --now deepseek-claude-proxy
```

## 健康检查

```bash
curl http://127.0.0.1:18765/health
# 返回 "ok" 表示代理正常运行
```

## 适用场景

- Claude Code + DeepSeek API 组合
- 非交互模式：`claude -p`、管道输入
- 飞书/钉钉/微信 bridge 调用 Claude Code
- 任何程序化调用 Claude Code 的场景

## License

MIT
