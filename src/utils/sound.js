// Serene Audio synthesis for Buddhist practice (Tibetan Bell & Bead Click)
let audioCtx = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (AudioContext) audioCtx = new AudioContext()
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

/**
 * Plays a peaceful Tibetan singing bowl bell chime
 */
export function playBellChime() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime

    // Fundamental + soothing harmonics
    const freqs = [432, 864, 1296]
    const gains = [0.35, 0.15, 0.05]

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now)

      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(gains[i], now + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 3.3)
    })
  } catch (e) {
    // Audio context not allowed or not supported
  }
}

/**
 * Plays a soft wooden bead tap sound
 */
export function playBeadClick() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(520, now)
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.06)

    gain.gain.setValueAtTime(0.18, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.07)
  } catch (e) {
    // Ignore
  }
}

