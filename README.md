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

## 准备工作：确认环境

开始前，确保电脑上已安装以下工具（通常都有）：

```bash
# 检查 Node.js（版本 ≥ 16）
node --version

# 检查 Git
git --version
```

如果提示 command not found，先安装对应工具：[Node.js 官网](https://nodejs.org/) | [Git 官网](https://git-scm.com/)

---

## 方案 A：终端命令配置（推荐，不依赖 Claude Code）

不管 Claude Code 当前能不能用，都不影响。整段复制粘贴到终端即可。

### 第一步：克隆并启动代理

**macOS / Linux：**

```bash
git clone https://github.com/yan329689-bot/deepseek-claude-proxy.git && cd deepseek-claude-proxy && node server.js &
```

**Windows（PowerShell）：**

```powershell
git clone https://github.com/yan329689-bot/deepseek-claude-proxy.git
cd deepseek-claude-proxy
Start-Process node -ArgumentList "server.js" -WindowStyle Hidden
```

看到以下输出说明启动成功：

```
[proxy] 启动成功: http://127.0.0.1:18765 → https://api.deepseek.com/anthropic
```

> **如果报端口被占用**（`EADDRINUSE`）：说明 18765 端口已有程序在用。修改 `server.js` 第 4 行的 `LISTEN_PORT` 为其他端口（如 18766），后续配置中对应修改即可。

### 第二步：修改 settings.json

打开 `~/.claude/settings.json`（macOS/Linux）或 `%USERPROFILE%\.claude\settings.json`（Windows），确保 `ANTHROPIC_BASE_URL` 指向本地代理：

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

> **注意**：`ANTHROPIC_BASE_URL` 是唯一决定 Claude Code 请求发往哪里的配置。无论你装了 CC Switch 还是其他代理工具，只要这个值指向 `http://127.0.0.1:18765`，请求就走本代理。

### 第三步（可选）：配置开机自启

**macOS：**

先用 `which node` 确认你的 node 安装路径，替换下方 `你的 node 路径`：

```bash
which node
# 输出类似 /opt/homebrew/bin/node 或 /usr/local/bin/node
```

```bash
cat > ~/Library/LaunchAgents/com.deepseek.claude.proxy.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.deepseek.claude.proxy</string>
    <key>ProgramArguments</key>
    <array>
        <string>你的 node 路径</string>
        <string>你的仓库路径/deepseek-claude-proxy/server.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.deepseek.claude.proxy.plist
```

**Windows：** 将以下内容保存为 `start-proxy.bat`，放到启动文件夹（`Win + R` → `shell:startup`）：

```bat
node 你的仓库路径\deepseek-claude-proxy\server.js
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

打开终端，发送一个测试请求（注意替换 `sk-你的API-Key` 为真实的 DeepSeek API Key）：

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

**预期结果：** 返回正常的模型响应（DeepSeek 回答了你的问题），而不是下面的错误：

```
# 如果代理没生效，会看到这个错误：
messages[1].role: unknown variant system
```

如果返回的是 `Authentication Fails` 之类的鉴权错误，也说明代理工作正常——请求已正确转发到 DeepSeek，只是 API Key 不对。

**如果用了自定义端口**（如 18766），把命令里的 `18765` 换成你改的端口号。

也可以观察代理的终端输出，每处理一个请求都会打印日志：

```
[proxy] 修复 system ×1 → 顶层字段
```

看到这行日志，说明代理正在提取 system role 消息。

---

## 排错指南

**Q: 启动时报 `Error: Cannot find module '/Users/xxx/server.js'`**

答：没有先 `cd` 进仓库目录。确保 clone 之后先执行了 `cd deepseek-claude-proxy`。

**Q: 启动时报 `EADDRINUSE address already in use`**

答：端口 18765 被占用了（可能是之前启动过）。改 `server.js` 第 4 行的端口号，或先关掉占用的进程：

```bash
lsof -ti :18765 | xargs kill
```

**Q: 配置完了还是会报 system role 错误**

答：检查两点：
1. `ANTHROPIC_BASE_URL` 确实已改成 `http://127.0.0.1:18765`
2. 代理在运行（终端执行 `lsof -i :18765` 确认端口有进程监听）

**Q: 我用了 CC Switch，这个代理和它冲突吗？**

不冲突。关键是 `ANTHROPIC_BASE_URL` 指向哪里。指向 `http://127.0.0.1:18765` 就是走这个代理，CC Switch 不在请求链路里。

**Q: 是不是把 CC Switch 关了就行？**

关闭 CC Switch 的 Cloud 路由可以解决 thinking 报错，但 system role 的问题仍然存在（尤其是通过飞书等非交互模式使用时）。本地代理两个问题都根治。

**Q: 代理会拖慢速度吗？**

不会。代理运行在本地（127.0.0.1），只做一次字符串处理，延迟几乎可以忽略。

## License

MIT
