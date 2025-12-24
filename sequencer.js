/**
 * Sequencer - Handles parsing and playback of multi-track step sequences
 */
class Sequencer {
  constructor() {
    this.bpm = 120;
    this.tracks = []; // Array of { oscillator: string, steps: [] }
    this.currentStep = 0;
    this.maxSteps = 0; // Length of longest track
    this.isPlaying = false;
    this.intervalId = null;
    this.onStepChange = null; // Callback for UI updates
    this._triggerNote = null; // Store callback for BPM updates
  }

  /**
   * Parse sequencer text
   * @param {string} text - Sequencer text content
   * @returns {object} { bpm, tracks }
   */
  parse(text) {
    const lines = text.split('\n');
    let bpm = 120;
    let tracks = [];
    let currentTrack = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Parse BPM
      const bpmMatch = trimmed.match(/^bpm\s+(\d+)$/i);
      if (bpmMatch) {
        bpm = parseInt(bpmMatch[1], 10);
        continue;
      }

      // Parse oscillator/track declaration
      const oscMatch = trimmed.match(/^oscillator\s+(.+)$/i);
      if (oscMatch) {
        currentTrack = {
          oscillator: oscMatch[1].trim(),
          steps: []
        };
        tracks.push(currentTrack);
        continue;
      }

      // Parse sequence (indented under oscillator, or standalone for backwards compat)
      const seqMatch = trimmed.match(/^sequence\s+(.+)$/i);
      if (seqMatch) {
        const stepTokens = seqMatch[1].trim().split(/\s+/);
        const steps = stepTokens.map(token => this._parseStep(token));

        if (currentTrack) {
          // Add to current track
          currentTrack.steps = steps;
        } else {
          // Backwards compatibility: standalone sequence uses default oscillator
          tracks.push({
            oscillator: null, // null means use all oscillators (default behavior)
            steps: steps
          });
        }
        continue;
      }
    }

    this.bpm = bpm;
    this.tracks = tracks;
    this.maxSteps = Math.max(...tracks.map(t => t.steps.length), 0);

    return { bpm, tracks };
  }

  /**
   * Parse a single step token
   * @param {string} token - Note name (c4, eb5, f#3) or rest (-)
   * @returns {object} { type: 'note'|'rest', frequency?, noteName? }
   */
  _parseStep(token) {
    if (token === '-') {
      return { type: 'rest' };
    }

    // Parse note name: letter + optional accidental + octave
    const match = token.match(/^([a-g])([#b]?)(\d)$/i);
    if (!match) {
      console.warn(`Invalid note: ${token}`);
      return { type: 'rest' };
    }

    const [, letter, accidental, octave] = match;
    const frequency = this._noteToFrequency(letter, accidental, parseInt(octave, 10));

    return {
      type: 'note',
      noteName: token.toLowerCase(),
      frequency
    };
  }

  /**
   * Convert note name to frequency
   */
  _noteToFrequency(letter, accidental, octave) {
    const noteMap = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
    let semitone = noteMap[letter.toLowerCase()];

    if (accidental === '#') semitone += 1;
    if (accidental === 'b') semitone -= 1;

    // MIDI note number (A4 = 69 = 440Hz)
    const midiNote = (octave + 1) * 12 + semitone;

    // Frequency = 440 * 2^((midiNote - 69) / 12)
    return 440 * Math.pow(2, (midiNote - 69) / 12);
  }

  /**
   * Start playback
   * @param {function} triggerNote - Function to trigger a note (frequency, noteName, duration, oscillatorName)
   */
  play(triggerNote) {
    if (this.isPlaying || this.tracks.length === 0) return;

    this._triggerNote = triggerNote; // Store for BPM updates
    this.isPlaying = true;
    this.currentStep = 0;

    this._startInterval();
  }

  /**
   * Start or restart the playback interval
   */
  _startInterval() {
    // Clear existing interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    const stepDuration = (60 / this.bpm) * 1000 / 4; // ms per 16th note

    // Play current step immediately
    this._playCurrentStep(this._triggerNote, stepDuration);

    // Set up interval for subsequent steps
    this.intervalId = setInterval(() => {
      this.currentStep = (this.currentStep + 1) % this.maxSteps;
      this._playCurrentStep(this._triggerNote, stepDuration);
    }, stepDuration);
  }

  /**
   * Set BPM and update interval in real-time
   */
  setBpm(newBpm) {
    this.bpm = newBpm;
    if (this.isPlaying) {
      this._startInterval(); // Restart with new timing
    }
  }

  /**
   * Play the current step for all tracks
   */
  _playCurrentStep(triggerNote, duration) {
    // Play each track
    for (const track of this.tracks) {
      if (this.currentStep < track.steps.length) {
        const step = track.steps[this.currentStep];

        if (step.type === 'note') {
          triggerNote(step.frequency, step.noteName, duration * 0.9, track.oscillator);
        }
      }
    }

    // Notify UI
    if (this.onStepChange) {
      this.onStepChange(this.currentStep);
    }
  }

  /**
   * Stop playback
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isPlaying = false;
    this.currentStep = 0;

    if (this.onStepChange) {
      this.onStepChange(-1); // -1 indicates stopped
    }
  }

  /**
   * Get current state for UI
   */
  getState() {
    return {
      bpm: this.bpm,
      tracks: this.tracks,
      currentStep: this.currentStep,
      maxSteps: this.maxSteps,
      isPlaying: this.isPlaying
    };
  }
}

// Global sequencer instance
let sequencer = null;

function initializeSequencer() {
  sequencer = new Sequencer();
  console.log('Sequencer initialized');
}
