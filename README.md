# DeepSeek Claude Proxy

用 DeepSeek API 驱动 Claude Code 时，飞书/钉钉机器人不回消息？一行命令修复。

## 快速修复

把下面这句话发给 Claude Code 就行：

> 帮我把这个仓库克隆下来，按照 README 里的方法部署本地代理，然后帮我把 Claude Code 的 ANTHROPIC_BASE_URL 改成 http://127.0.0.1:18765

或者直接执行这一行：

```bash
git clone https://github.com/yan329689-bot/deepseek-claude-proxy.git /tmp/deepseek-claude-proxy && node /tmp/deepseek-claude-proxy/server.js
```

然后让 Claude Code 帮你把 `~/.claude/settings.json` 里的 `ANTHROPIC_BASE_URL` 改成 `http://127.0.0.1:18765`。

重启飞书 bridge，问题解决。

## 这是什么问题

用 DeepSeek API 跑 Claude Code，在终端里聊天一切正常。但用飞书/钉钉机器人、或者 `claude -p` 命令行的时候，就会报错：

```
API Error: 400
messages[1].role: unknown variant system, expected user or assistant
```

原因很简单：Claude Code 在后台调用模式下，会把系统提示词放在一个不该放的位置。真正的 Anthropic API 不在意，但 DeepSeek 的接口比较严格，直接拒绝了。

这个仓库里的代理就是把请求"修一下"，让它变成 DeepSeek 能接的格式。

## 怎么让它一直在后台跑

上面的命令关了终端就停了。想让它一直跑，把这句话发给 Claude Code：

> 帮我把 deepseek-claude-proxy 设置为开机自启，并且每 5 分钟检查一次是否在运行，挂了就自动重启

Claude Code 会帮你配置好。或者你自己加一条 crontab：

```bash
crontab -e
```

加一行：

```
@reboot /usr/local/bin/node /path/to/server.js >> /tmp/dscp.log 2>&1
```

## 适用场景

- Claude Code 配置了 DeepSeek API
- 飞书/钉钉/微信 bridge 不回复消息
- `claude -p` 命令行模式报 system role 错误

## License

MIT
