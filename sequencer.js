/**
 * Sequencer - Handles parsing and playback of multi-track step sequences
 */
class Sequencer {
  constructor() {
    this.bpm = 120;
    this.swing = 50; // 50 = straight, 67 = triplet feel, etc.
    this.tracks = []; // Array of { oscillator: string, steps: [] }
    this.currentStep = 0;
    this.maxSteps = 0; // Length of longest track
    this.isPlaying = false;
    this.intervalId = null;
    this.onStepChange = null; // Callback for UI updates
    this._triggerNote = null; // Store callback for BPM updates
    this._stopNote = null; // Store stop callback for ties
    this.activeNotes = new Map(); // Track oscillator -> noteId for tie handling
  }

  /**
   * Parse sequencer text
   * @param {string} text - Sequencer text content
   * @returns {object} { bpm, tracks }
   */
  parse(text) {
    const lines = text.split('\n');
    let bpm = 120;
    let swing = 50;
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

      // Parse swing (50 = straight, 67 = triplet feel)
      const swingMatch = trimmed.match(/^swing\s+(\d+)$/i);
      if (swingMatch) {
        swing = Math.max(0, Math.min(100, parseInt(swingMatch[1], 10)));
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
    this.swing = swing;
    this.tracks = tracks;
    this.maxSteps = Math.max(...tracks.map(t => t.steps.length), 0);

    return { bpm, swing, tracks };
  }

  /**
   * Parse a single step token
   * @param {string} token - Note name with optional modifiers
   *   - Note: c4, eb5, f#3
   *   - Velocity: @N (0-100), e.g. c4@80
   *   - Gate: :N (0-100% of step), e.g. c4:50
   *   - Tie: ~ (extend to next step), e.g. c4~
   *   - Combined: c4@80:50~
   * @returns {object} { type: 'note'|'rest', frequency?, noteName?, velocity, gate, tie }
   */
  _parseStep(token) {
    if (token === '-') {
      return { type: 'rest', velocity: 100, gate: 100, tie: false };
    }

    // Match note with optional modifiers: c4, c4@80, c4:50, c4@80:50, c4~, c4@80:50~
    const match = token.match(/^([a-g][#b]?\d)(?:@(\d+))?(?::(\d+))?([~])?$/i);
    if (!match) {
      console.warn(`Invalid note: ${token}`);
      return { type: 'rest', velocity: 100, gate: 100, tie: false };
    }

    const [, noteStr, velocityStr, gateStr, tieStr] = match;

    // Parse note components
    const noteMatch = noteStr.match(/^([a-g])([#b]?)(\d)$/i);
    if (!noteMatch) {
      console.warn(`Invalid note format: ${noteStr}`);
      return { type: 'rest', velocity: 100, gate: 100, tie: false };
    }

    const [, letter, accidental, octave] = noteMatch;
    const frequency = this._noteToFrequency(letter, accidental, parseInt(octave, 10));

    return {
      type: 'note',
      noteName: noteStr.toLowerCase(),
      frequency,
      velocity: velocityStr ? parseInt(velocityStr, 10) : 100,
      gate: gateStr ? parseInt(gateStr, 10) : 100,
      tie: !!tieStr
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
   * @param {function} triggerNote - Function to trigger a note (frequency, noteName, duration, oscillatorName, velocity, tie)
   * @param {function} stopNote - Function to stop a note by noteId
   */
  play(triggerNote, stopNote) {
    if (this.isPlaying || this.tracks.length === 0) return;

    this._triggerNote = triggerNote; // Store for BPM updates
    this._stopNote = stopNote; // Store for tie handling
    this.isPlaying = true;
    this.currentStep = 0;
    this.activeNotes.clear(); // Reset active notes on new playback

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
  _playCurrentStep(triggerNote, stepDuration) {
    // Calculate swing delay for odd steps (every other 16th note)
    // swing 50 = straight, swing 67 = triplet feel (delays odd steps by ~33% of step)
    const isOddStep = this.currentStep % 2 === 1;
    const swingDelay = isOddStep ? ((this.swing - 50) / 100) * stepDuration : 0;

    // Delay execution of this step if swing applies
    const executeStep = () => {
      for (const track of this.tracks) {
        const trackKey = track.oscillator || '_default';

        // Get current and previous step for tie logic
        const step = this.currentStep < track.steps.length
          ? track.steps[this.currentStep]
          : { type: 'rest' };
        const prevStep = this.currentStep > 0 && (this.currentStep - 1) < track.steps.length
          ? track.steps[this.currentStep - 1]
          : { type: 'rest', tie: false };

        // Handle previous note cleanup and tie logic
        const activeNoteId = this.activeNotes.get(trackKey);
        if (activeNoteId) {
          // Check if previous note should continue (was tied AND current is same note)
          const shouldContinue = prevStep.tie &&
                                 step.type === 'note' &&
                                 step.noteName === prevStep.noteName;

          if (shouldContinue) {
            // Note continues - don't stop or restart, skip to next track
            continue;
          } else {
            // Tie chain ended (rest, different note, or prev wasn't tied) - stop the note
            if (this._stopNote) {
              this._stopNote(activeNoteId);
            }
            this.activeNotes.delete(trackKey);
          }
        }

        // Start new note if this step has one
        if (step.type === 'note') {
          // Calculate actual note duration from gate percentage
          // Gate 100 = 90% of step (leaving room for attack of next note)
          // Gate 50 = 45% of step, etc.
          const gateFactor = (step.gate / 100) * 0.9;
          const noteDuration = stepDuration * gateFactor;

          // Convert velocity from 0-100 to 0-127 for MIDI compatibility
          const midiVelocity = Math.round((step.velocity / 100) * 127);

          // triggerNote returns noteId
          const noteId = triggerNote(step.frequency, step.noteName, noteDuration, track.oscillator, midiVelocity, step.tie);

          // Track this note for tie handling
          if (step.tie && noteId) {
            this.activeNotes.set(trackKey, noteId);
          }
        }
      }
    };

    // Apply swing delay if needed
    if (swingDelay > 0) {
      setTimeout(executeStep, swingDelay);
    } else {
      executeStep();
    }

    // Notify UI (always immediate, even if swing delays the notes)
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

    // Stop any active tied notes
    if (this._stopNote) {
      for (const noteId of this.activeNotes.values()) {
        this._stopNote(noteId);
      }
    }
    this.activeNotes.clear();

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
      swing: this.swing,
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
