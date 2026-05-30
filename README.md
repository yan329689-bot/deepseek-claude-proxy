# DeepSeek Claude Proxy

## 这是什么

一个 80 行的本地代理，解决 Claude Code + DeepSeek API 之间的两个兼容性问题。

### 问题一：system role 报错

```
API Error: 400 Failed to deserialize the JSON body into the target type:
messages[1].role: unknown variant system, expected user or assistant
```

Claude Code 2.1.154 引入了「Lean System Prompt」，把系统提示词以 `role: "system"` 的形式放进了 `messages` 数组里。DeepSeek 的 `/anthropic` 端点遵循 Anthropic 规范——`system` 必须是请求的顶层字段，`messages` 里只认 `user` 和 `assistant`。

在飞书机器人等非交互模式下，这个问题更早出现（2.1.152 起就可能触发）。

### 问题二：thinking 字段报错

```
API Error: 400 The content[].thinking in the thinking mode must be passed back to the API.
```

DeepSeek 返回的响应中带有签名的 `thinking` 块，下一轮请求时必须原样带回。如果中间代理（如 CC Switch 的 Claude 路由模式）把 thinking 块弄丢了，DeepSeek 校验不通过，直接 400。

### 这个代理做了什么

在请求到达 DeepSeek 之前：

1. 遍历 `messages` 数组，把 `role: "system"` 的消息提取出来，合并到请求顶层的 `system` 字段
2. 将请求转发到 DeepSeek 的 `/anthropic` 兼容端点（`https://api.deepseek.com/anthropic`），thinking 块完整透传，不做任何修改

---

## 怎么用

全程四步，不需要手动写命令。

### 第一步：回退 Claude Code 到 2.1.150

两种方式任选其一：

**方式一（VSCode 操作，推荐）：**

打开 VSCode → 扩展（Extensions）→ 搜索「Claude Code」→ 点击齿轮图标 → **安装其他版本** → 选择 **2.1.150**。然后点击齿轮图标 → **自动更新** → 关掉。

**方式二（终端命令）：**

```bash
npm install -g @anthropic-ai/claude-code@2.1.150
```

### 第二步：关掉 CC Switch 的 Claude 路由

打开 CC Switch → 设置 → 找到 **Claude 路由** → **关闭**。

这样 DeepSeek 模型不再通过 CC Switch 中转，代理会直连 DeepSeek。

### 第三步：让 Claude Code 帮你配置

复制下面这段话，发给 VSCode 里的 Claude Code：

> 帮我克隆 https://github.com/yan329689-bot/deepseek-claude-proxy 到本地，启动 server.js 作为后台服务，把 ~/.claude/settings.json 里的 ANTHROPIC_BASE_URL 改成 http://127.0.0.1:18765，然后配好开机自启。

Claude Code 会自动完成所有步骤，包括克隆仓库、启动代理、修改配置、配好开机自启。

### 第四步：升级到最新版

配置完成后，跟 Claude Code 说：

> 帮我升级到最新版本

升级后 `settings.json` 里的配置不会变，`ANTHROPIC_BASE_URL` 仍然指向本地代理，所以最新版也能正常使用。

---

## 如何验证是否生效

跟 Claude Code 正常对话一次，不再出现 400 报错就说明成功了。

也可以在终端看代理日志，每处理一个请求都会打印：

```
[proxy] 修复 system ×1 → 顶层字段
```

---

## License

MIT
