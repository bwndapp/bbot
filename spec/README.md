# Agent Face Protocol (AFP)

**Draft 0.1 · October 2026 · Status: proposal, open for comment**

AFP is a small, open format for an AI agent to show what it is doing and how
it "feels" about it through a face that people can read at a glance. An agent
sends short JSON messages (a state, an expression, a reaction, speech) and any
conforming renderer turns them into a face. bbot is the reference renderer;
the protocol does not depend on it.

## Why

Agents mostly show themselves as text and spinners. That leaves people
guessing: is it stuck, is it working, is it unsure, did it just fail? Humans
read faces in a fraction of a second, across languages. AFP gives agents a
shared, human-translatable vocabulary for that signal, so that:

- an agent framework can emit it once and work with any face renderer,
- a renderer can drive any agent that speaks it,
- every expression has a plain-language meaning, so the same signal can be
  shown as a face, read out by a screen reader, or written as a caption.

AFP is transport-agnostic. It is designed to sit alongside
[MCP](https://modelcontextprotocol.io) (an agent can drive a face through a
tool call) and to travel over a WebSocket, `postMessage`, or a reply envelope.

## Terms

The words MUST, SHOULD and MAY are used as in RFC 2119.

- **Agent**: the software producing messages.
- **Renderer**: the software drawing the face.
- **State**: what the agent is doing (thinking, working, waiting…). Coarse,
  for frameworks that don't want to pick emotions.
- **Expression**: a held emotional pose (worried, happy…). Persists until
  replaced.
- **Reaction**: a one-shot animation played over the current expression
  (nod, shake…).
- **Gloss**: the plain-language meaning of an expression or reaction, from
  [`vocabulary.json`](vocabulary.json).

## Vocabulary

The full vocabulary, with glosses, guidance on when to use each, and an
approximate valence/arousal position, is in
[`vocabulary.json`](vocabulary.json). It is the normative list.

### States

| state | default expression | default reaction | means |
|---|---|---|---|
| `idle` | `idle` | — | Present, nothing in progress |
| `listening` | `curious` | — | Taking input from the person |
| `thinking` | `thinking` | — | Reasoning, before acting |
| `working` | `focus` | — | Running tools or a long task |
| `speaking` | *(current)* | — | Delivering a reply; mouth follows speech |
| `waiting` | `pleading` | `pop` | Needs the person: approval, input, a choice |
| `success` | `happy` | `nod` | Finished, it went well |
| `error` | `worried` | `shake` | Something failed |
| `offline` | `sleep` | — | Not connected or not running |

### Expressions (30)

`idle` `content` `relieved` `happy` `joy` `excited` `love` `pleading` `shy`
`surprised` `scared` `curious` `confused` `dizzy` `thinking` `focus`
`suspicious` `unimpressed` `smug` `sly` `bored` `exasperated` `worried`
`guilty` `sad` `disgusted` `annoyed` `angry` `sleepy` `sleep`

### Reactions (9)

`blink` `wink` `nod` `shake` `bounce` `pop` `boing` `spin` `jitter`

## Messages

Every message is a JSON object with a `type`. The schema is
[`message.schema.json`](message.schema.json).

```jsonc
{ "type": "face.state",   "state": "working", "label": "Searching your files" }
{ "type": "face.express", "expression": "worried", "label": "That file is locked" }
{ "type": "face.react",   "reaction": "nod" }
{ "type": "face.look",    "x": 0.6, "y": -0.3, "ms": 900 }
{ "type": "face.speak",   "text": "Done, three files moved.", "audio": "https://…/reply.mp3" }
{ "type": "face.mouth",   "level": 0.7, "wide": 0.2, "round": 0.5 }
```

| type | fields | effect |
|---|---|---|
| `face.state` | `state`, `label?` | Sets the state; applies its default expression and reaction |
| `face.express` | `expression`, `label?` | Holds an expression until the next `face.state` or `face.express` |
| `face.react` | `reaction` | Plays a reaction once over the current expression |
| `face.look` | `x`, `y` in −1..1, `ms?` | Glances at a point (centre is 0,0; +y is down), then returns |
| `face.speak` | `text`, `audio?` | Shows `text` as a caption; if `audio` is given, plays it and lip-syncs |
| `face.mouth` | `level` 0..1, `wide?` 0..1, `round?` 0..1 | One frame of lip-sync, for agents streaming their own audio |

`label` is optional free text that says *why*, in the agent's words. It is
what a caption or screen reader announces in place of the gloss.

### Reply envelope

An agent that answers in turns, rather than streaming messages, MAY attach the
face to its reply instead:

```json
{ "text": "I couldn't open that file.", "mood": "worried", "react": "shake" }
```

A renderer treats `mood` as `face.express` and `react` as `face.react`, then
`text` as `face.speak`.

## Renderer rules

1. A renderer MUST ignore message types and fields it does not recognise.
2. An unknown `expression` or `state` MUST NOT throw. The renderer SHOULD keep
   the current expression and MAY log a warning. An unknown `reaction` is
   dropped.
3. Changing expression SHOULD animate between poses, not snap.
4. Reactions MUST NOT change the held expression.
5. While speech is playing, the mouth follows the audio; the held expression
   returns when speech ends.
6. **Accessibility.** A renderer MUST make the current meaning available as
   text: the `label` if one was sent, otherwise the gloss. In a browser this
   means an `aria-label` or a polite live region on the face. A face is never
   the only signal.
7. **Reduced motion.** When the person prefers reduced motion, a renderer
   SHOULD hold expressions and skip or soften reactions and idle motion.
8. A renderer SHOULD rate-limit: no more than one reaction at a time, and
   expression changes no faster than about 4 per second.

## Agent guidance

- Prefer `face.state` unless you have a reason to pick an emotion.
- Be honest. Don't show `happy` over a failure or `focus` while idle. The
  point of the face is that people can trust it.
- Use strong negative expressions (`angry`, `disgusted`) rarely, if ever, for
  an assistant. They are in the vocabulary because renderers and characters
  need them, not because agents should aim them at users.
- Send a `label` when the reason isn't obvious from context.

## Conformance

| level | renderer supports |
|---|---|
| **AFP-1** | `face.state`, `face.express`, all 30 expressions, rules 1–2 and 6 |
| **AFP-2** | AFP-1 plus `face.react` (all 9), `face.look`, rules 3–5, 7–8 |
| **AFP-3** | AFP-2 plus `face.speak` with audio and `face.mouth` lip-sync |

bbot implements AFP-3 except rule 6 (accessible text), which is tracked as
an open issue.

## Bindings

### MCP

A face host exposes the messages as tools, one per type, with the message
fields as arguments: `face_state`, `face_express`, `face_react`, `face_look`,
`face_speak`. A host MAY also accept `face.*` messages as MCP notifications.

### WebSocket and `postMessage`

Send each message as one JSON text frame (or one `postMessage` data object).

## Reference implementation

- Renderer: [`@bwnd/bbot`](https://github.com/bwndapp/bbot). `createFace()`
  maps `face.express` → `setExpression()`, `face.react` → `react()`,
  `face.look` → `look()`, `face.mouth` → `talk(level, { wide, round })`,
  and `@bwnd/bbot/talk` provides lip-sync from audio.
- Desktop host: `widget/`, an Electron app that chats through any model on
  OpenRouter, speaks with ElevenLabs, and acts the conversation out.
- Expression geometry: `src/expressions.js` documents the pose parameters
  (lids, tilt, gaze, mouth…) for anyone building another renderer.

## Open questions

- Should expressions take an `intensity` (0..1) that blends from `idle`?
- Should the vocabulary be extensible with namespaced names (`x-vendor:…`)?
- Is valence/arousal worth making normative, so renderers can fall back on
  the nearest known expression?

Comment by opening an issue labelled `spec`.

## Licence

This specification is licensed MIT, the same as the reference implementation.
