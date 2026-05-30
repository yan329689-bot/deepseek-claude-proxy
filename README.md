# DeepSeek Claude Proxy

## 这是什么

一个 80 行的本地代理，解决 Claude Code + DeepSeek API 之间的两个兼容性问题。

### 问题一：system role 报错

```
API Error: 400 Failed to deserialize the JSON body into the target type:
messages[1].role: unknown variant system, expected user or assistant
```

Claude Code 2.1.154 引入了「Lean System Prompt」，把系统提示词以 `role: "system"` 的形式放进了 `messages` 数组里。DeepSeek 的 `/anthropic` 端点遵循 Anthropic 规范——`system` 必须是请求的顶层字段，`messages` 里只认 `user` 和 `assistant`。

**在飞书机器人等非交互模式下**，这个问题更早出现（2.1.152 起就可能触发）。

### 问题二：thinking 字段报错

```
API Error: 400 The content[].thinking in the thinking mode must be passed back to the API.
```

DeepSeek 返回的响应中带有签名的 `thinking` 块，下一轮请求时必须原样带回。如果中间代理（如 CC Switch 的 Cloud 路由模式）把 thinking 块弄丢了，DeepSeek 校验不通过，直接 400。

### 这个代理做了什么

在请求到达 DeepSeek 之前：

1. 遍历 `messages` 数组，把 `role: "system"` 的消息提取出来，合并到请求顶层的 `system` 字段
2. 将请求转发到 DeepSeek 的 `/anthropic` 兼容端点（`https://api.deepseek.com/anthropic`），thinking 块完整透传，不做任何修改

---

## 方案 A：终端命令配置（推荐，不依赖 Claude Code）

这个方案完全独立于 Claude Code，不管 Claude Code 当前能不能用，都不影响。

### 第一步：克隆仓库

```bash
git clone https://github.com/yan329689-bot/deepseek-claude-proxy.git
cd deepseek-claude-proxy
```

### 第二步：启动代理

```bash
node server.js &
```

看到以下输出说明启动成功：

```
[proxy] 启动成功: http://127.0.0.1:18765 → https://api.deepseek.com/anthropic
```

### 第三步：修改 settings.json

打开 `~/.claude/settings.json`，确保 `ANTHROPIC_BASE_URL` 指向本地代理：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:18765",
    "ANTHROPIC_AUTH_TOKEN": "sk-你的DeepSeek-API-Key",
    "ANTHROPIC_MODEL": "deepseek-v4-pro",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "deepseek-v4-pro",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "deepseek-v4-pro",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "deepseek-v4-flash"
  }
}
```

### 第四步（可选）：配置开机自启

**macOS：**

```bash
# 创建 LaunchAgent 配置文件
cat > ~/Library/LaunchAgents/com.deepseek.claude.proxy.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.deepseek.claude.proxy</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>你的仓库路径/server.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF

# 加载服务
launchctl load ~/Library/LaunchAgents/com.deepseek.claude.proxy.plist
```

**Windows：** 将以下内容保存为 `start-proxy.bat`，放到启动文件夹（`Win + R` → `shell:startup`）：

```bat
node 你的仓库路径\server.js
```

---

## 方案 B：回退版本 + Claude Code 自动配置（适合不熟悉命令行的用户）

如果你的 Claude Code 已经因为报错无法使用，先回退，配好代理，再升级。

### 第一步：回退 Claude Code 版本

```bash
npm install -g @anthropic-ai/claude-code@2.1.153
```

### 第二步：让 Claude Code 帮你配置

复制下面这段话，发给 VSCode 里的 Claude Code：

> 帮我克隆 https://github.com/yan329689-bot/deepseek-claude-proxy 到本地，启动 server.js 作为后台服务，把 ~/.claude/settings.json 里的 ANTHROPIC_BASE_URL 改成 http://127.0.0.1:18765，然后配好开机自启。

Claude Code 会自动完成所有步骤。

### 第三步：确认配置生效

等 Claude Code 配完后，打开 `~/.claude/settings.json`，确认 `ANTHROPIC_BASE_URL` 已经改成了 `http://127.0.0.1:18765`。

### 第四步：升级到最新版

```bash
npm install -g @anthropic-ai/claude-code
```

---

## 如何验证是否生效

打开终端，发送一个测试请求：

```bash
curl -X POST http://127.0.0.1:18765/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-你的API-Key" \
  -d '{
    "model": "deepseek-v4-pro",
    "max_tokens": 100,
    "messages": [
      {"role": "system", "content": "你是一个助手"},
      {"role": "user", "content": "说你好"}
    ]
  }'
```

如果返回正常的模型响应（而不是 400 报错），说明代理工作正常。

也可以观察代理的终端输出，每处理一个请求都会打印类似日志：

```
[proxy] 修复 system ×1 → 顶层字段
```

---

## 常见问题

**Q: 我用了 CC Switch，这个代理和它冲突吗？**

不冲突。关键是 `ANTHROPIC_BASE_URL` 指向哪里。指向 `http://127.0.0.1:18765` 就是走这个代理，CC Switch 不在请求链路里。指向 CC Switch 的端口就是走 CC Switch。

**Q: 是不是把 CC Switch 关了就行？**

关闭 CC Switch 的 Cloud 路由可以解决 thinking 报错，但 system role 的问题仍然存在（尤其是通过飞书等非交互模式使用时）。本地代理两个问题都能解决。

**Q: 代理会拖慢速度吗？**

不会。代理运行在本地（127.0.0.1），只是做一次字符串处理，延迟几乎可以忽略。

## License

MIT
