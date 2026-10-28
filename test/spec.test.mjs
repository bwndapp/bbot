// Keeps the library and the Agent Face Protocol spec saying the same thing.
// The spec's vocabulary is normative, so a new expression has to land in both.
//
//   npm test

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { EXPRESSIONS, EXPRESSION_NAMES, REACTIONS, REACTION_NAMES } from '../src/expressions.js'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const vocab = JSON.parse(read('../spec/vocabulary.json'))
const schema = JSON.parse(read('../spec/message.schema.json'))
const examples = read('../spec/examples.jsonl').trim().split('\n').map((line) => JSON.parse(line))

const specExpressions = vocab.expressions.map((e) => e.name)
const specReactions = vocab.reactions.map((r) => r.name)

test('spec lists exactly the library expressions, in order', () => {
  assert.deepEqual(specExpressions, EXPRESSION_NAMES)
})

test('spec lists exactly the library reactions, in order', () => {
  assert.deepEqual(specReactions, REACTION_NAMES)
})

test('every expression and reaction has a gloss', () => {
  for (const e of [...vocab.expressions, ...vocab.reactions]) {
    assert.ok(e.gloss?.trim(), `${e.name} has no gloss`)
    assert.ok(e.use?.trim(), `${e.name} has no usage note`)
  }
})

test('valence and arousal are in range', () => {
  for (const e of vocab.expressions) {
    assert.ok(e.valence >= -1 && e.valence <= 1, `${e.name} valence`)
    assert.ok(e.arousal >= 0 && e.arousal <= 1, `${e.name} arousal`)
  }
})

test('states map to real expressions and reactions', () => {
  for (const [name, s] of Object.entries(vocab.states)) {
    if (s.expression) assert.ok(EXPRESSIONS[s.expression], `${name} -> ${s.expression}`)
    if (s.reaction) assert.ok(REACTIONS[s.reaction], `${name} -> ${s.reaction}`)
  }
})

test('schema enums match the vocabulary', () => {
  const branch = (type) => schema.oneOf.find((b) => b.properties.type.const === type).properties
  assert.deepEqual(branch('face.express').expression.enum, specExpressions)
  assert.deepEqual(branch('face.react').reaction.enum, specReactions)
  assert.deepEqual(branch('face.state').state.enum, Object.keys(vocab.states))
})

test('every example matches one schema branch', () => {
  for (const ex of examples) {
    const b = schema.oneOf.find((o) => o.properties.type.const === ex.type)
    assert.ok(b, `unknown type ${ex.type}`)
    for (const key of b.required) assert.ok(key in ex, `${ex.type} missing ${key}`)
    for (const [key, val] of Object.entries(ex)) {
      const p = b.properties[key]
      if (p?.enum) assert.ok(p.enum.includes(val), `${ex.type}.${key}=${val}`)
      if (p?.minimum !== undefined) assert.ok(val >= p.minimum, `${ex.type}.${key} too low`)
      if (p?.maximum !== undefined) assert.ok(val <= p.maximum, `${ex.type}.${key} too high`)
    }
  }
})

test('expression poses stay in their documented ranges', () => {
  const unit = ['lidT', 'lidB', 'lidSkew', 'open']
  const signed = ['gazeX', 'gazeY', 'mouth']
  const fields = Object.keys(EXPRESSIONS.idle)
  for (const [name, pose] of Object.entries(EXPRESSIONS)) {
    assert.deepEqual(Object.keys(pose), fields, `${name} has different fields from idle`)
    for (const k of unit) assert.ok(pose[k] >= 0 && pose[k] <= 1, `${name}.${k}`)
    for (const k of signed) assert.ok(pose[k] >= -1 && pose[k] <= 1, `${name}.${k}`)
  }
})

test('reactions run cleanly from start to end', () => {
  for (const [name, r] of Object.entries(REACTIONS)) {
    assert.ok(r.dur > 0, `${name} duration`)
    for (let p = 0; p <= 1; p += 0.05) {
      const o = { blink: 0, winkR: 0, hx: 0, hy: 0, sx: 0, sy: 0, rot: 0 }
      r.apply(p, o)
      for (const [k, v] of Object.entries(o)) assert.ok(Number.isFinite(v), `${name} ${k} at ${p}`)
    }
  }
})
