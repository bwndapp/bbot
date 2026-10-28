// The bot's brain: any chat model on OpenRouter, called straight from this
// machine with the user's own key. No server of ours in the middle.
//
// One turn streams: text deltas, reasoning (for models that share it) and
// tool calls. Desktop tools are offered as functions; when the model calls
// one, `runTool` runs it here and the answer goes back for another round.
// The caller owns the thread — chat() takes the messages so far and returns
// them with this turn appended.

const { EventEmitter } = require('events')

const API = process.env.BBOT_OPENROUTER_URL || 'https://openrouter.ai/api/v1'
const DEFAULT_MODEL = 'openrouter/auto'
const TURN_TIMEOUT = 120000
const MAX_ROUNDS = 8 // tool round-trips per turn, so a confused model can't loop forever

// OpenRouter ranks apps by these; harmless, and it's how people find the widget
const APP_HEADERS = {
  'HTTP-Referer': 'https://github.com/bwndapp/bbot',
  'X-Title': 'bbot',
}

// MCP tool shape → OpenAI function shape
const asFunction = (t) => ({
  type: 'function',
  function: { name: t.name, description: t.description, parameters: t.input_schema },
})

// MCP content → the plain string a tool message carries
const asText = (result) => {
  const text = (result?.content || []).map((c) => c.text || '').join('\n')
  return result?.is_error ? `error: ${text}` : text
}

class Brain extends EventEmitter {
  constructor() {
    super()
    this.status = 'off' // off | connecting | on | denied
    this.key = ''
    this.turn = null // truthy while a reply is in flight
    this.models = null // cached model list for the picker
  }

  setStatus(s) {
    if (this.status === s) return
    this.status = s
    this.emit('status', s)
  }

  // check the key once, so a bad one says so in settings rather than mid-chat
  async connect(key) {
    this.key = String(key || '').trim()
    if (!this.key) return this.setStatus('off')
    this.setStatus('connecting')
    try {
      const res = await fetch(`${API}/key`, { headers: { Authorization: `Bearer ${this.key}` } })
      this.setStatus(res.ok ? 'on' : res.status === 401 ? 'denied' : 'off')
    } catch {
      this.setStatus('off')
    }
  }

  disconnect() {
    this.key = ''
    this.setStatus('off')
  }

  async listModels() {
    if (this.models) return this.models
    const res = await fetch(`${API}/models`)
    if (!res.ok) throw new Error(`models: ${res.status}`)
    const j = await res.json()
    this.models = (j.data || []).map((m) => ({ id: m.id, name: m.name || m.id }))
    return this.models
  }

  /**
   * One turn. onEvent gets {type:'delta'|'reasoning', content} and
   * {type:'tool', name, input}; runTool(name, input) resolves an MCP result.
   * Resolves {text, messages}: the final reply and the thread with it added.
   */
  async chat({ model, system, messages, tools = [], onEvent, runTool }) {
    if (this.status !== 'on') throw new Error('offline')
    const thread = [...messages]
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TURN_TIMEOUT)
    this.turn = { ctrl }
    try {
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const msg = await this.stream(
          {
            model: model || DEFAULT_MODEL,
            messages: system ? [{ role: 'system', content: system }, ...thread] : thread,
            ...(tools.length ? { tools: tools.map(asFunction) } : {}),
          },
          ctrl.signal,
          onEvent
        )
        thread.push(msg)
        if (!msg.tool_calls?.length) return { text: msg.content || '', messages: thread }
        for (const call of msg.tool_calls) {
          let input = {}
          try {
            input = JSON.parse(call.function.arguments || '{}')
          } catch {}
          onEvent?.({ type: 'tool', name: call.function.name, input })
          const result = runTool
            ? await runTool(call.function.name, input)
            : { content: [{ type: 'text', text: 'no tools here' }], is_error: true }
          thread.push({ role: 'tool', tool_call_id: call.id, content: asText(result) })
        }
      }
      throw new Error('too many tool calls in one turn')
    } catch (e) {
      if (e.name === 'AbortError') throw new Error(this.turn?.stopped ? 'stopped' : 'timeout')
      throw e
    } finally {
      clearTimeout(timer)
      this.turn = null
    }
  }

  stop() {
    if (!this.turn) return
    this.turn.stopped = true
    this.turn.ctrl.abort()
  }

  // POST with stream:true and fold the SSE chunks back into one message
  async stream(body, signal, onEvent) {
    const res = await fetch(`${API}/chat/completions`, {
      method: 'POST',
      signal,
      headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json', ...APP_HEADERS },
      body: JSON.stringify({ ...body, stream: true }),
    })
    if (res.status === 401) this.setStatus('denied')
    if (!res.ok) {
      let why = `error ${res.status}`
      try {
        why = (await res.json()).error?.message || why
      } catch {}
      throw new Error(why)
    }

    const msg = { role: 'assistant', content: '' }
    const calls = []
    const decoder = new TextDecoder()
    let buf = ''
    for await (const chunk of res.body) {
      buf += decoder.decode(chunk, { stream: true })
      let nl
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        // comments (": OPENROUTER PROCESSING") keep the connection warm
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') continue
        let j
        try {
          j = JSON.parse(data)
        } catch {
          continue
        }
        if (j.error) throw new Error(j.error.message || 'model error')
        const d = j.choices?.[0]?.delta || {}
        if (d.reasoning) onEvent?.({ type: 'reasoning', content: d.reasoning })
        if (d.content) {
          msg.content += d.content
          onEvent?.({ type: 'delta', content: d.content })
        }
        for (const tc of d.tool_calls || []) {
          const c = (calls[tc.index ?? 0] ||= { id: '', type: 'function', function: { name: '', arguments: '' } })
          if (tc.id) c.id = tc.id
          if (tc.function?.name) c.function.name += tc.function.name
          if (tc.function?.arguments) c.function.arguments += tc.function.arguments
        }
      }
    }
    if (calls.length) msg.tool_calls = calls.filter(Boolean)
    return msg
  }
}

module.exports = new Brain()
module.exports.DEFAULT_MODEL = DEFAULT_MODEL
