// Point a face at some audio and let it lip-sync.
//
//   import { createFace } from '@bwnd/bbot'
//   import { listen } from '@bwnd/bbot/talk'
//
//   const face = createFace(el, { mouth: true })
//   const stop = listen(document.querySelector('audio'), face)
//
// The face already knows how to talk — `face.talk(level)` takes a 0..1 loudness
// and turns it into an open mouth, a bob, a roll and a little squash. What it
// can't do on its own is *listen*. This is that half: a Web Audio analyser, a
// noise gate and a curve, read once a frame.
//
// Separate entry point on purpose. It's the only part of the library that
// touches Web Audio, and a face on a landing page should not pay for an
// AudioContext it will never open.

const FFT = 512

// Below this the room is quiet. Without a gate, an idle mic or the noise floor
// of a stream leaves the mouth permanently ajar.
const GATE = 0.015

// Conversation sits mid-range and only genuinely loud syllables should hit full
// open, so the curve is gentler than linear.
const GAIN = 5
const CURVE = 1.1

// Frequency bands, as bin indices of a 512-point FFT — roughly 100-750Hz,
// 750-1900Hz and 1.9-4.1kHz. The *shares* of these are what say which vowel is
// being made: treble-heavy reads as "ee", bass-heavy as "oo".
const LO = [1, 8]
const MID = [8, 20]
const HI = [20, 44]

// How fast the vowel shape follows the sound. Slower than the jaw on purpose —
// a mouth that changed shape every frame would buzz.
const TONE_SMOOTH = 0.35

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n)
const band = ([from, to], bins) => {
  let sum = 0
  for (let i = from; i < to && i < bins.length; i++) sum += bins[i]
  return sum
}

/** Treble and bass shares of a spectrum, as the mouth wants them. */
function shares(bins) {
  const lo = band(LO, bins)
  const total = lo + band(MID, bins) + band(HI, bins) || 1
  return { wide: band(HI, bins) / total, round: lo / total }
}

/** True for anything we can hand to createMediaElementSource. */
const isMedia = (x) => typeof HTMLMediaElement !== 'undefined' && x instanceof HTMLMediaElement
const isStream = (x) => typeof MediaStream !== 'undefined' && x instanceof MediaStream
const isNode = (x) => typeof AudioNode !== 'undefined' && x instanceof AudioNode

/**
 * Drive a face's mouth from audio.
 *
 * @param source  an <audio>/<video> element, a MediaStream (mic, WebRTC), or
 *                any AudioNode you've already wired up
 * @param face    what createFace returned, or anything with .talk(level)
 * @param options {
 *   audioContext  reuse your own instead of opening one
 *   output        route the audio to the speakers as well. Defaults to true for
 *                 media elements and nodes, false for a MediaStream — a live
 *                 mic sent to the speakers is a feedback loop.
 *   gate, gain, curve   shape the response
 *   onLevel(level)      called each frame with the same 0..1 the face gets
 * }
 * @returns a stop() function. Call it when the face goes away.
 */
export function listen(source, face, options = {}) {
  if (!source) throw new Error('listen() needs an audio source')
  if (!face || typeof face.talk !== 'function') {
    throw new Error('listen() needs a face — createFace(...) or anything with .talk(level)')
  }

  const {
    audioContext,
    output = !isStream(source),
    gate = GATE,
    gain = GAIN,
    curve = CURVE,
    onLevel,
  } = options

  const Ctx = typeof AudioContext !== 'undefined' ? AudioContext : globalThis.webkitAudioContext
  if (!Ctx) throw new Error('no Web Audio in this browser')

  // An AudioNode is already bound to a context, and nodes from two different
  // contexts cannot be connected — so adopt the source's rather than opening a
  // second one that could never reach it. Someone else's context is theirs to
  // close; only one we opened is ours.
  const given = audioContext || (isNode(source) ? source.context : null)
  if (audioContext && isNode(source) && source.context !== audioContext) {
    throw new Error('listen(): the source node belongs to a different AudioContext')
  }
  const ctx = given || new Ctx()
  const owned = !given

  const analyser = ctx.createAnalyser()
  analyser.fftSize = FFT
  const wave = new Uint8Array(analyser.fftSize)
  const spectrum = new Uint8Array(analyser.frequencyBinCount)
  let wide = 0
  let round = 0

  let node
  if (isMedia(source)) node = ctx.createMediaElementSource(source)
  else if (isStream(source)) node = ctx.createMediaStreamSource(source)
  else if (isNode(source)) node = source
  else throw new Error('listen(): source must be a media element, a MediaStream or an AudioNode')

  node.connect(analyser)
  // createMediaElementSource *takes over* the element's output — skip this and
  // the page goes silent while the mouth moves, which is a baffling bug to hit.
  if (output) analyser.connect(ctx.destination)

  // Browsers hand back a suspended context until a user gesture. Try anyway:
  // if this was called from a click it just works, and if it wasn't, the first
  // one the page gets will start it.
  const wake = () => ctx.resume?.().catch(() => {})
  wake()

  let running = true
  let frame = 0

  function tick() {
    if (!running) return
    frame = requestAnimationFrame(tick)

    analyser.getByteTimeDomainData(wave)
    let sum = 0
    for (let i = 0; i < wave.length; i++) {
      const d = (wave[i] - 128) / 128
      sum += d * d
    }
    const rms = Math.sqrt(sum / wave.length)
    const level = rms < gate ? 0 : Math.min(1, Math.pow(rms * gain, curve))

    // Spectral colour, only while there is something to colour. Held between
    // sounds rather than reset, so the mouth doesn't snap flat between words.
    if (level > 0) {
      analyser.getByteFrequencyData(spectrum)
      const s = shares(spectrum)
      wide += (s.wide - wide) * TONE_SMOOTH
      round += (s.round - round) * TONE_SMOOTH
    }

    // No smoothing of the level here: the face handles the attack and release
    // itself, and damping it twice reads as a delay between sound and mouth.
    face.talk(level, { wide, round })
    onLevel?.(level)
  }
  tick()

  return function stop() {
    if (!running) return
    running = false
    cancelAnimationFrame(frame)
    try {
      node.disconnect(analyser)
      analyser.disconnect()
    } catch { /* already torn down */ }
    face.talk(0)
    if (owned) ctx.close?.().catch(() => {})
  }
}


/**
 * The same level, read off decoded samples instead of a live graph.
 *
 * `listen` needs the audio to actually be playing, which is the wrong shape for
 * rendering: a recorded clip should lip-sync to the *frame's* timestamp, not to
 * whenever the sound card got round to it. Reading the buffer directly makes
 * the sync exact and frame-accurate even if the encoder stutters — and it works
 * where there is no audio device at all, which is the usual case on a server.
 *
 * @param buffer  an AudioBuffer, e.g. from ctx.decodeAudioData(mp3)
 * @param time    seconds into the buffer
 * @param options { window: seconds of audio to average, default one frame at 30fps;
 *                  gate, gain, curve — same meaning as listen() }
 * @returns the 0..1 level to hand to face.talk()
 */
export function levelAt(buffer, time, options = {}) {
  const { gate = GATE, gain = GAIN, curve = CURVE, window = 1 / 30 } = options
  if (!buffer || !(time >= 0)) return 0

  const rate = buffer.sampleRate
  const half = Math.max(1, Math.round((window * rate) / 2))
  const centre = Math.round(time * rate)
  const from = Math.max(0, centre - half)
  const to = Math.min(buffer.length, centre + half)
  if (to <= from) return 0

  let sum = 0
  let count = 0
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = from; i < to; i++) {
      sum += data[i] * data[i]
      count++
    }
  }

  const rms = Math.sqrt(sum / count)
  return rms < gate ? 0 : Math.min(1, Math.pow(rms * gain, curve))
}

// --- rendering ------------------------------------------------------------
//
// Everything above needs the audio to be *playing*. Rendering a clip has no
// sound card and no real time, so it needs the same measurements taken from
// the samples directly.

/** In-place radix-2 FFT. Small enough to inline rather than take a dependency. */
function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k
        const b = a + len / 2
        const tr = re[b] * cr - im[b] * ci
        const ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
        const nr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = nr
      }
    }
  }
}

// Web Audio's own numbers, so an offline spectrum lands on the same 0..255
// scale a live AnalyserNode would report for the same sound.
const MIN_DB = -100
const MAX_DB = -30
const FFT_SMOOTH = 0.8

/**
 * The offline counterpart of `listen`: level and vowel shape, read off decoded
 * samples at any point in time.
 *
 * Stateful, because both the spectrum and the mouth shape are smoothed across
 * frames — call `at()` in playback order, once per frame, the way a recorder
 * does. That is what makes a rendered clip move like a live one rather than
 * jittering between independent measurements.
 *
 *   const voice = analyseVoice(audioBuffer)
 *   const { level, wide, round } = voice.at(t)
 *   face.talk(level, { wide, round })
 *
 * @param buffer   an AudioBuffer, e.g. from ctx.decodeAudioData(mp3)
 * @param options  gate, gain, curve — as listen()
 */
export function analyseVoice(buffer, options = {}) {
  const { gate = GATE, gain = GAIN, curve = CURVE } = options

  const bins = new Float32Array(FFT / 2) // smoothed magnitudes, as Web Audio keeps them
  const bytes = new Uint8Array(FFT / 2)
  const re = new Float64Array(FFT)
  const im = new Float64Array(FFT)

  // Blackman, the window an AnalyserNode applies before its transform.
  const win = new Float64Array(FFT)
  for (let i = 0; i < FFT; i++) {
    const x = (2 * Math.PI * i) / (FFT - 1)
    win[i] = 0.42 - 0.5 * Math.cos(x) + 0.08 * Math.cos(2 * x)
  }

  let wide = 0
  let round = 0

  return {
    at(time) {
      // One trailing block of samples answers both questions, which is what an
      // AnalyserNode does — and why this does not reuse `levelAt`, whose window
      // is centred on `time` and so half in the future. Reading the block that
      // has just played is what keeps this in step with a live analyser.
      const rate = buffer.sampleRate
      const end = Math.round(time * rate)
      const start = end - FFT
      const ch = buffer.getChannelData(0)
      let sum = 0
      for (let i = 0; i < FFT; i++) {
        const at = start + i
        const v = at >= 0 && at < buffer.length ? ch[at] : 0
        sum += v * v
        re[i] = v * win[i]
        im[i] = 0
      }
      const rms = Math.sqrt(sum / FFT)
      const level = rms < gate ? 0 : Math.min(1, Math.pow(rms * gain, curve))

      if (level > 0) {
        fft(re, im)

        for (let i = 0; i < FFT / 2; i++) {
          const mag = Math.sqrt(re[i] * re[i] + im[i] * im[i]) / FFT
          bins[i] = FFT_SMOOTH * bins[i] + (1 - FFT_SMOOTH) * mag
          const db = 20 * Math.log10(bins[i] || 1e-12)
          bytes[i] = clamp01((db - MIN_DB) / (MAX_DB - MIN_DB)) * 255
        }

        const s = shares(bytes)
        wide += (s.wide - wide) * TONE_SMOOTH
        round += (s.round - round) * TONE_SMOOTH
      }

      return { level, wide, round }
    },
  }
}

export default listen

