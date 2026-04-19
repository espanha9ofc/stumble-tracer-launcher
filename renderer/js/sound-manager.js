/* ═══════════════════════════════════════════════════
   Stumble Tracer — SOUND MANAGER
   Web Audio API powered premium sound effects
   ═══════════════════════════════════════════════════ */

const SoundManager = (() => {
    let audioCtx = null;
    let enabled = true;
    let volume = 0.3;

    function getContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    function setEnabled(val) {
        enabled = !!val;
    }

    function setVolume(val) {
        volume = Math.max(0, Math.min(1, val));
    }

    function isEnabled() {
        return enabled;
    }

    // ─── Helper: Create oscillator tone ───
    function playTone(freq, duration, type = 'sine', gainVal = 0.3, delay = 0) {
        if (!enabled) return;
        const ctx = getContext();
        const t = ctx.currentTime + delay;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(gainVal * volume, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc.stop(t + duration);
    }

    // ─── Helper: Noise burst (whoosh) ───
    function playNoise(duration, gainVal = 0.15, filterFreq = 2000, delay = 0) {
        if (!enabled) return;
        const ctx = getContext();
        const t = ctx.currentTime + delay;

        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(filterFreq, t);
        filter.Q.setValueAtTime(0.5, t);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(gainVal * volume, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        source.start(t);
        source.stop(t + duration);
    }

    // ═══════════════ SOUND EFFECTS ═══════════════

    function playClick() {
        // Satisfying click + subtle pop
        playTone(800, 0.06, 'square', 0.15);
        playTone(1200, 0.04, 'sine', 0.08, 0.02);
    }

    function playSwoosh() {
        // Whoosh transition
        playNoise(0.2, 0.1, 3000);
        playTone(400, 0.15, 'sine', 0.05);
    }

    function playChime() {
        // Gentle notification bell
        playTone(880, 0.3, 'sine', 0.2);
        playTone(1100, 0.25, 'sine', 0.12, 0.08);
        playTone(1320, 0.2, 'sine', 0.08, 0.16);
    }

    function playPing() {
        // Subtle rising ping (update available)
        playTone(660, 0.15, 'sine', 0.15);
        playTone(880, 0.2, 'sine', 0.12, 0.08);
    }

    function playSuccess() {
        // Happy ascending tones (install complete)
        playTone(523, 0.15, 'sine', 0.2);
        playTone(659, 0.15, 'sine', 0.18, 0.1);
        playTone(784, 0.15, 'sine', 0.16, 0.2);
        playTone(1047, 0.3, 'sine', 0.2, 0.3);
    }

    function playError() {
        // Soft descending tone
        playTone(440, 0.2, 'sawtooth', 0.1);
        playTone(330, 0.3, 'sawtooth', 0.08, 0.1);
    }

    function playLaunch() {
        // Epic rising fanfare (game launched)
        playNoise(0.3, 0.08, 2000);
        playTone(440, 0.15, 'sine', 0.15);
        playTone(554, 0.15, 'sine', 0.15, 0.08);
        playTone(659, 0.15, 'sine', 0.15, 0.16);
        playTone(880, 0.4, 'sine', 0.2, 0.24);
        playTone(1100, 0.3, 'triangle', 0.08, 0.3);
    }

    function playShutdown() {
        // Gentle descending fade (game closed)
        playTone(660, 0.2, 'sine', 0.12);
        playTone(440, 0.3, 'sine', 0.1, 0.1);
        playTone(330, 0.4, 'sine', 0.06, 0.2);
    }

    function playTransition() {
        // Quick subtle swoosh (page navigate)
        playNoise(0.1, 0.05, 4000);
        playTone(600, 0.08, 'sine', 0.04);
    }

    function playToggle(isOn = true) {
        // Toggle switch — iOS-style: ON = rising, OFF = falling
        if (isOn) {
            playTone(750, 0.06, 'square', 0.1);
            playTone(1050, 0.05, 'sine', 0.08, 0.03);
        } else {
            playTone(900, 0.06, 'square', 0.1);
            playTone(600, 0.05, 'sine', 0.08, 0.03);
        }
    }

    return {
        setEnabled,
        setVolume,
        isEnabled,
        playClick,
        playSwoosh,
        playChime,
        playPing,
        playSuccess,
        playError,
        playLaunch,
        playShutdown,
        playTransition,
        playToggle
    };
})();