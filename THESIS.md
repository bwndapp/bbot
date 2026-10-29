# bbot and the Agent Face Protocol: Sandbox thesis

*October 2026*

## The problem

AI agents now work for minutes at a time: they reason, call tools, wait for
approval and sometimes fail. Most interfaces show all of that as a spinner
and a wall of text. People can't tell at a glance whether an agent is stuck,
busy, unsure, waiting on them, or finished. They have to read.

People read faces in a fraction of a second, in every language. A face is
the oldest status display there is. Agents should be able to use one, and
the signal should be honest and interoperable, not reinvented by every app.

## What the project is

1. **The Agent Face Protocol (AFP)**, a small, transport-agnostic format for
   an agent to say what it is doing (`thinking`, `working`, `waiting`,
   `error`…) and how it feels about it (one of 30 expressions), to play a
   reaction (`nod`, `shake`…), or to speak with lip-sync. Every expression
   has a plain-language gloss, so the same message can be drawn as a face,
   read by a screen reader or shown as a caption. It defines an MCP binding,
   so any MCP-capable agent can drive a face through tool calls.
2. **bbot**, the reference renderer: a dependency-free JavaScript library
   (MIT, about 5 kB gzipped), published on npm as `@bwnd/bbot`.
3. **The bbot desktop widget**, a reference host: an always-on-top face that
   chats through any model on OpenRouter, speaks through ElevenLabs, acts the
   conversation out and offers MCP-shaped local file tools.

## Who would use it

- **Agent framework and app builders** who want users to see agent state
  without reading logs: coding agents, desktop assistants, customer-facing
  chat, voice agents.
- **Renderer authors**, such as avatar, VTuber, robot and game-character
  makers, who want to be driven by any agent instead of one vendor's.
- **Accessibility work.** Because AFP carries meaning as text alongside the
  face, it gives agents one honest status signal that works for sighted and
  non-sighted users alike.

## Why it matters before adoption

The useful thing here is the shared vocabulary, not the drawing. If every
agent framework invents its own "mood" field, renderers can't be swapped,
and there's no common rule against an agent showing `happy` over a failure.
That is the window where neutral governance helps most: before patterns
settle. A Sandbox home lets agent frameworks, including AAIF projects such
as goose, and MCP hosts adopt one vocabulary without depending on a single
company's library.

## Early interest (honest numbers)

The project is two months old and has been promoted once, on Threads.

- 47 GitHub stars. 220 unique repository visitors in the last 14 days, about
  140 of them from that one post.
- About 340 CDN loads of the npm build through jsDelivr in the last month.
  npm reports around 1,250 downloads a month, but those counts are noisy and
  we don't rely on them.
- Eight npm releases since 31 August 2026.
- No known external implementations of AFP yet. Getting them is the first
  goal of Sandbox.

## What would justify Growth

- At least two independent renderers or hosts implementing AFP-2 or above,
  from organisations other than the founding one.
- Production use by two unaffiliated organisations, such as an agent product
  that ships a face driven by AFP.
- An AFP binding or example in at least one other AAIF project, such as a
  goose extension or an MCP server example.
- Maintainers and commits from at least two organisations, with a documented
  committer-acceptance process.
- AFP 1.0: a stable vocabulary, an accessibility rule implemented by the
  reference renderer, and a conformance test suite.

## Roadmap, next 6–12 months

| when | milestone |
|---|---|
| 0–3 months | Accessible text in the reference renderer (AFP rule 6). An AFP conformance test kit. A `face.*` MCP server package. Examples for two agent frameworks. |
| 3–6 months | Resolve the open spec questions (intensity, namespaced extensions, valence/arousal fallback) through public issues. Recruit a second maintainer from another organisation. Six-month TC checkpoint. |
| 6–12 months | AFP 1.0. At least two external renderers. Apply for Growth. |

## Links

- Repository: https://github.com/bwndapp/bbot
- Spec: https://github.com/bwndapp/bbot/tree/main/spec
- Live demo: https://bbot.bwnd.app
- Governance: [GOVERNANCE.md](GOVERNANCE.md) · Security: [SECURITY.md](SECURITY.md)
