# bbot desktop widget

The face, off the page: a frameless, transparent, always-on-top Electron window
with an AI behind it. Bring your own [OpenRouter](https://openrouter.ai) key
to pick any chat model, and optionally an [ElevenLabs](https://elevenlabs.io)
key for a real voice. Nothing goes through a server of ours.

- **Click the face to chat.** Speech bubbles float above it: streamed replies,
  markdown (code, lists, headings, quotes, links), OG preview cards under
  links, a thinking timer, scrollable history, a clear button.
- **Press and move to drag**: it gets scared mid-drag and boings on landing.
- **Eyes follow your cursor** across the whole desktop (the main process polls
  the global cursor position and drives `look()`).
- **It acts the conversation out**: a thinking pose with a thought trail
  while a reply is pending (from the model's reasoning, when it shares it),
  focus during tool calls, a mood read from each reply, a worried shake on
  errors.
- **It talks.** A built-in babble voice, or ElevenLabs streamed as the reply
  arrives, with the mouth lip-synced to the audio and optional captions.
- Hover for the other controls: **⤡** drag to resize · **✕** close · **✎**
  settings, a tabbed panel: *style* (mood gallery of live mini-faces,
  reactions, colours, fits, size) and *config* (OpenRouter, ElevenLabs,
  desktop tools). Everything persists across runs.
- **Several bots.** Right-click → *New bbot* spawns another, with its own
  look, voice, model, persona and conversation.
- **It can use your computer.** Opt in, and the bot searches, lists, reads
  and opens files in the folders you allow. See *Desktop tools* below.

## Run

```sh
cd widget
npm install
npm start
```

On Windows, double-clicking `start.cmd` does both. Launching twice focuses the
running one instead of spawning a twin.

## Set it up

Open ✎ → config:

1. **openrouter**: paste a key from [openrouter.ai/keys](https://openrouter.ai/keys).
   The default model is `openrouter/auto`; type or pick any other model id
   (`anthropic/…`, `openai/…`, `google/…`). Each bot can override the model
   and its persona. With no persona set, the bot uses [`soul.md`](soul.md).
2. **elevenlabs** (optional): paste a key, then pick *ElevenLabs* and a voice
   per bot in style → voice.

You pay OpenRouter and ElevenLabs directly for what you use.

## Desktop tools

Turn it on in ✎ → config → mcp and pick the folders it may see (Documents,
Desktop and Downloads by default). The tools are offered to the model with
every message and run on this machine when it calls them, so "find that
report from last week" becomes a real search here and the bot hands you the
path. Tools are read-only and never leave the chosen folders:

| tool | does |
|---|---|
| `search_files` | name words or a glob, optional age/extension filter; newest first |
| `list_dir` | entries of a folder, or the allowed roots |
| `read_file` | the first N chars of a text file (binary formats report size only) |
| `open_path` | open with the default app, or reveal in the file manager |

What the bot reads is sent to the model through OpenRouter to be understood,
so keep private folders out of the list. Each use is logged as a quiet line in
the chat and in the panel's activity list.

The tools are MCP-shaped (`tools.js`: name, description, input schema, MCP
content results), so the same set can be served to any MCP client.

## How it's built

| file | does |
|---|---|
| `main.js` | windows, settings, the chat turn, voice routing |
| `llm.js` | OpenRouter: streaming chat, reasoning, tool-call rounds |
| `el.js` | ElevenLabs streaming text-to-speech |
| `brain.js` | reads a mood and a thought out of the model's words |
| `tools.js` | the desktop tools |
| `index.html` | the face, its voice and lip-sync |
| `chat.html` · `settings.html` · `captions.html` | the other windows |

The widget imports `../dist/face.js` straight from this repo: no copy of the
library, nothing to build. `electron` and `ws` are its only dependencies,
local to this folder and excluded from the npm package.
