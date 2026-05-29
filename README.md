# DeepSeek Claude Proxy

## 安装

复制下面这段话，发给你的智能体（Claude Code、Cursor、OpenCli、Claude Dev 等均可）：

> 帮我克隆 https://github.com/yan329689-bot/deepseek-claude-proxy 到本地，启动 server.js 作为后台服务，把 ~/.claude/settings.json 里的 ANTHROPIC_BASE_URL 改成 http://127.0.0.1:18765，然后配好开机自启。最后重启我的 bridge。

智能体会自动帮你完成所有步骤。搞定后你就可以正常在飞书、钉钉里跟 Claude Code 聊天了。

## 为什么会有这个问题

你用 DeepSeek 的 API 来跑 Claude Code，平时在终端里聊天很正常。但当你在飞书、钉钉里给 Claude Code 发消息，或者用 `claude -p` 命令的时候，就会报错：

```
API Error: 400
messages[1].role: unknown variant system
```

原因很简单：Claude Code 在后台模式下，把"系统提示词"放在了一个 DeepSeek 不认识的位置。就好比你填表时把名字写在了身份证号那一栏——内容没错，但位置不对，系统就不认。

这个代理做的事就是：在你发出的请求到达 DeepSeek 之前，自动帮你把位置调对。

## 适用场景

- 用 DeepSeek API + Claude Code 的组合
- 飞书、钉钉、微信等机器人在后台不回复消息
- `claude -p` 命令报 system role 错误

只要遇到这类"终端聊天正常、后台调用报错"的情况，都可以用这个代理解决。

## License

MIT
