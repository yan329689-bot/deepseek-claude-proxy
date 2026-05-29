# DeepSeek Claude Proxy

## 这是什么
适用于 Claude Code + DeepSeek API + 飞书机器人的组合。
通过飞书机器人与Claude Code（2.1.152以后的版本）对话时，如果用的是 DeepSeek API，机器人会出现报错（下面图片）。这个代理就是解决这个问题的。
![Uploading image.png…]()

## 怎么用

复制下面这段话，发给你的 Claude Code：

> 帮我克隆 https://github.com/yan329689-bot/deepseek-claude-proxy 到本地，启动 server.js 作为后台服务，把 ~/.claude/settings.json 里的 ANTHROPIC_BASE_URL 改成 http://127.0.0.1:18765，然后配好开机自启。最后重启我的飞书 bridge。

Claude Code 会自动帮你完成所有步骤。

## 为什么会出现这个问题

你用 DeepSeek 的 API 来跑 Claude Code，在终端里聊天很正常。但通过飞书机器人对话时，就会报这个错：

```
API Error: 400
messages[1].role: unknown variant system
```

原因：在终端聊天时，Claude Code 把系统提示词放在请求的"前言"里，DeepSeek 认。但通过飞书 bridge 对话时，Claude Code 走的是后台调用模式，把系统提示词写进了对话记录里。DeepSeek 不认识这个位置，就拒绝了。

这个代理做的事：在请求到达 DeepSeek 之前，自动把系统提示词挪到对的位置。

## License

MIT
