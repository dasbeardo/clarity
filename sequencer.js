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
    // Track oscillator -> Map<noteName, noteId> for per-note tie handling (supports chords)
    this.activeNotes = new Map();
  }

  /**
   * Parse sequencer text
   * @param {string} text - Sequencer text content
   * @returns {object} { bpm, tracks }
   */
  parse(text) {
    console.log('[PARSE] Parsing sequencer text...');
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

    // Debug: Log parsed tracks summary
    console.log(`[PARSE] Complete: bpm=${bpm}, swing=${swing}, tracks=${tracks.length}, maxSteps=${this.maxSteps}`);
    for (const track of tracks) {
      const stepSummary = track.steps.map(s => {
        if (s.type === 'rest') return '-';
        if (s.type === 'chord') return `[${s.notes.map(n => n.noteName + (n.tie ? '~' : '') + (n.slideTo ? '>' : '')).join(',')}]`;
        return s.noteName + (s.tie ? '~' : '') + (s.slideTo ? '>' + s.slideTo.noteName : '');
      }).join(' ');
      console.log(`[PARSE] Track "${track.oscillator}": ${stepSummary}`);
    }

    return { bpm, swing, tracks };
  }

  /**
   * Parse a single step token
   * @param {string} token - Note name with optional modifiers
   *   - Note: c4, eb5, f#3
   *   - Velocity: @N (0-100), e.g. c4@80
   *   - Gate: :N (0-100% of step), e.g. c4:50
   *   - Tie: ~ (extend to next step), e.g. c4~
   *   - Slide: > (slide to next note), e.g. c4>e4
   *   - Chord: [c4,e4,g4] (multiple notes)
   *   - Combined: c4@80:50~, [c4~,e4@80,g4>a4]
   * @returns {object} { type: 'note'|'chord'|'rest', ... }
   */
  _parseStep(token) {
    if (token === '-') {
      return { type: 'rest' };
    }

    // Check if this is a chord: [c4,e4,g4]
    if (token.startsWith('[') && token.endsWith(']')) {
      const inner = token.slice(1, -1);
      const noteTokens = inner.split(',');
      const notes = noteTokens.map(t => this._parseSingleNote(t.trim())).filter(n => n !== null);

      if (notes.length === 0) {
        return { type: 'rest' };
      }

      return {
        type: 'chord',
        notes: notes
      };
    }

    // Single note (possibly with slide)
    const note = this._parseSingleNote(token);
    if (!note) {
      return { type: 'rest' };
    }

    return {
      type: 'note',
      ...note
    };
  }

  /**
   * Parse a single note with modifiers (used for both standalone and chord notes)
   * @param {string} token - e.g. c4, c4@80:50~, c4>e4
   * @returns {object|null} { noteName, frequency, velocity, gate, tie, slideTo }
   */
  _parseSingleNote(token) {
    // Check for slide: c4>e4 or c4@80>e4@90
    const slideMatch = token.match(/^(.+?)>(.+)$/);
    if (slideMatch) {
      console.log(`[PARSE] Slide detected: "${token}" -> from="${slideMatch[1]}", to="${slideMatch[2]}"`);
      const fromNote = this._parseNoteWithModifiers(slideMatch[1]);
      const toNote = this._parseNoteWithModifiers(slideMatch[2]);

      if (!fromNote || !toNote) {
        console.warn(`Invalid slide: ${token}`);
        return null;
      }

      const result = {
        ...fromNote,
        tie: true, // Slides automatically sustain (imply tie)
        gate: 100, // Full gate for smooth slide
        slideTo: {
          noteName: toNote.noteName,
          frequency: toNote.frequency,
          velocity: toNote.velocity // Target velocity for slide
        }
      };
      console.log(`[PARSE] Slide result: ${result.noteName} -> ${result.slideTo.noteName} (${result.frequency.toFixed(2)}Hz -> ${result.slideTo.frequency.toFixed(2)}Hz) [auto-tie]`);
      return result;
    }

    // Regular note without slide
    return this._parseNoteWithModifiers(token);
  }

  /**
   * Parse note name with modifiers (no slide handling)
   * @param {string} token - e.g. c4, c4@80, c4:50, c4@80:50~
   * @returns {object|null} { noteName, frequency, velocity, gate, tie, slideTo: null }
   */
  _parseNoteWithModifiers(token) {
    // Match note with optional modifiers: c4, c4@80, c4:50, c4@80:50, c4~, c4@80:50~
    const match = token.match(/^([a-g][#b]?\d)(?:@(\d+))?(?::(\d+))?([~])?$/i);
    if (!match) {
      console.warn(`Invalid note: ${token}`);
      return null;
    }

    const [, noteStr, velocityStr, gateStr, tieStr] = match;

    // Debug log for tie parsing
    if (tieStr) {
      console.log(`[PARSE] Tie detected in "${token}": tieStr="${tieStr}"`);
    }

    // Parse note components
    const noteMatch = noteStr.match(/^([a-g])([#b]?)(\d)$/i);
    if (!noteMatch) {
      console.warn(`Invalid note format: ${noteStr}`);
      return null;
    }

    const [, letter, accidental, octave] = noteMatch;
    const frequency = this._noteToFrequency(letter, accidental, parseInt(octave, 10));

    return {
      noteName: noteStr.toLowerCase(),
      frequency,
      velocity: velocityStr ? parseInt(velocityStr, 10) : 100,
      gate: gateStr ? parseInt(gateStr, 10) : 100,
      tie: !!tieStr,
      slideTo: null
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
          : { type: 'rest' };

        // Get notes array for current and previous steps
        const currentNotes = this._getStepNotes(step);
        const prevNotes = this._getStepNotes(prevStep);

        console.log(`Step ${this.currentStep}: current=[${currentNotes.map(n => n.noteName + (n.tie ? '~' : '') + (n.slideTo ? '>'+n.slideTo.noteName : '')).join(',')}] prev=[${prevNotes.map(n => n.noteName + (n.tie ? '~' : '')).join(',')}]`);

        // Initialize track's active notes map if needed
        if (!this.activeNotes.has(trackKey)) {
          this.activeNotes.set(trackKey, new Map());
        }
        const trackActiveNotes = this.activeNotes.get(trackKey);

        console.log(`  Active notes before: [${Array.from(trackActiveNotes.keys()).join(',')}]`);

        // Create lookup of previous notes by name for tie checking
        const prevNotesByName = new Map();
        for (const note of prevNotes) {
          prevNotesByName.set(note.noteName, note);
        }

        // Create lookup of current notes by name
        const currentNotesByName = new Map();
        for (const note of currentNotes) {
          currentNotesByName.set(note.noteName, note);
        }

        // Handle notes that should stop (were active but shouldn't continue)
        for (const [noteName, noteId] of trackActiveNotes) {
          const prevNote = prevNotesByName.get(noteName);
          const currentNote = currentNotesByName.get(noteName);

          // Note should continue if: prev was tied AND current has same note
          const shouldContinue = prevNote?.tie && currentNote;

          console.log(`  Check ${noteName}: prevTie=${prevNote?.tie}, hasCurrent=${!!currentNote}, shouldContinue=${shouldContinue}`);

          if (!shouldContinue) {
            // Stop this note
            console.log(`  STOP: ${noteName}`);
            if (this._stopNote) {
              this._stopNote(noteId);
            }
            trackActiveNotes.delete(noteName);
          }
        }

        // Start new notes (notes in current step that aren't continuing from tie)
        for (const note of currentNotes) {
          // Skip if this note is continuing from a tie
          if (trackActiveNotes.has(note.noteName)) {
            console.log(`  CONTINUE (skip start): ${note.noteName}`);
            continue;
          }

          // Calculate actual note duration from gate percentage
          const gateFactor = (note.gate / 100) * 0.9;
          const noteDuration = stepDuration * gateFactor;

          // Convert velocity from 0-100 to 0-127 for MIDI compatibility
          const midiVelocity = Math.round((note.velocity / 100) * 127);

          console.log(`  START: ${note.noteName}, tie=${note.tie}, slideTo=${note.slideTo ? note.slideTo.noteName : 'null'}`);

          // triggerNote returns noteId
          // Pass slideTo info for portamento
          const noteId = triggerNote(
            note.frequency,
            note.noteName,
            noteDuration,
            track.oscillator,
            midiVelocity,
            note.tie,
            note.slideTo // New parameter for slide target
          );

          // Track this note for tie handling
          if (note.tie && noteId) {
            trackActiveNotes.set(note.noteName, noteId);
            console.log(`  TRACKED for tie: ${note.noteName}`);
          }
        }

        console.log(`  Active notes after: [${Array.from(trackActiveNotes.keys()).join(',')}]`);
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
   * Get notes array from a step (handles note, chord, and rest types)
   * @param {object} step - Step object
   * @returns {array} Array of note objects
   */
  _getStepNotes(step) {
    if (step.type === 'rest') {
      return [];
    }
    if (step.type === 'chord') {
      return step.notes;
    }
    if (step.type === 'note') {
      // Single note - wrap in array
      return [{
        noteName: step.noteName,
        frequency: step.frequency,
        velocity: step.velocity,
        gate: step.gate,
        tie: step.tie,
        slideTo: step.slideTo
      }];
    }
    return [];
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

    // Stop any active tied notes (now nested Maps: trackKey -> Map<noteName, noteId>)
    if (this._stopNote) {
      for (const trackNotes of this.activeNotes.values()) {
        for (const noteId of trackNotes.values()) {
          this._stopNote(noteId);
        }
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
