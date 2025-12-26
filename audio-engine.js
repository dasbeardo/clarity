/**
 * ============================================================================
 * GENERIC AUDIO ENGINE
 * ============================================================================
 *
 * Creates and manages Web Audio nodes based on component instances.
 * Handles modulation routing, scope resolution, and variable resolution.
 */

/**
 * Audio Engine class
 */
class AudioEngine {
  constructor(audioContext, store, schemas) {
    this.audioContext = audioContext;
    this.store = store;
    this.schemas = schemas;

    // Master nodes
    this.masterGain = null;
    this.masterFilter = null;
    this.masterCompressor = null;
    this.masterDistortion = null;

    // Active notes (for cleanup)
    // Map<noteKey, NoteInstance>
    this.activeNotes = new Map();
  }

  /**
   * Initialize master chain
   */
  initializeMaster() {
    console.log('=== initializeMaster called ===');

    // Debug: Log all master trigger attributes
    const masterTrigger = this.store.components.triggers['master'];
    console.log('Master trigger from store:', masterTrigger);
    console.log('Master trigger attributes:', masterTrigger?.attributes);

    // Reset effect nodes (clean up old connections)
    this.masterDistortion = null;
    this.masterCompressor = null;
    this.masterFilter = null;

    // Create master gain
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);

    // Apply master volume
    const masterVolume = this.store.getTriggerAttribute('master', 'volume');
    console.log('initializeMaster - masterVolume from store:', masterVolume);
    if (masterVolume !== null) {
      const gainValue = this._percentageToGain(masterVolume);
      console.log('  Setting masterGain to:', gainValue);
      this.masterGain.gain.value = gainValue;
    } else {
      console.log('  masterVolume is null, using default 0.8');
      this.masterGain.gain.value = 0.8; // Default
    }

    // Create and connect filter if referenced
    const filterRef = this.store.getTriggerAttribute('master', 'filter');
    if (filterRef && filterRef.type === 'component_ref') {
      this.masterFilter = this._createFilterNode(filterRef.value);
      this.masterFilter.connect(this.masterGain);
    }

    // Create and connect compressor if referenced
    const compressorRef = this.store.getTriggerAttribute('master', 'compressor');
    if (compressorRef && compressorRef.type === 'component_ref') {
      this.masterCompressor = this._createCompressorNode(compressorRef.value);
      if (this.masterFilter) {
        this.masterCompressor.connect(this.masterFilter);
      } else {
        this.masterCompressor.connect(this.masterGain);
      }
    }

    // Create and connect distortion if referenced
    // Signal chain: oscillators → distortion → compressor → filter → gain → destination
    const distortionRef = this.store.getTriggerAttribute('master', 'distortion');
    console.log('initializeMaster - distortionRef:', distortionRef);
    if (distortionRef && distortionRef.type === 'component_ref') {
      console.log('Creating distortion node for:', distortionRef.value);
      this.masterDistortion = this._createDistortionNode(distortionRef.value);
      console.log('masterDistortion created:', this.masterDistortion);
      // Connect to next node in chain
      if (this.masterCompressor) {
        this.masterDistortion.output.connect(this.masterCompressor);
      } else if (this.masterFilter) {
        this.masterDistortion.output.connect(this.masterFilter);
      } else {
        this.masterDistortion.output.connect(this.masterGain);
      }
      console.log('Distortion connected to chain');
    } else {
      console.log('No distortion ref found or invalid type');
    }

    // Return the input node (first in chain that exists)
    if (this.masterDistortion) return this.masterDistortion.input;
    if (this.masterCompressor) return this.masterCompressor;
    if (this.masterFilter) return this.masterFilter;
    return this.masterGain;
  }

  /**
   * Create a Note instance
   * @param {string} noteName - Note name (e.g., 'c4')
   * @param {number} frequency - Base frequency
   * @param {string|null} keyScope - Active key scope if any (e.g., 'key_a')
   * @param {string|null} oscillatorFilter - Only use this oscillator (null = all)
   * @param {number} velocity - Note velocity 0-127 (default 127)
   * @param {object|null} slideTo - Slide target { frequency, noteName } (for portamento)
   * @param {number|null} duration - Note duration in ms (for slide timing)
   * @returns {NoteInstance} Note instance
   */
  createNote(noteName, frequency, keyScope = null, oscillatorFilter = null, velocity = 127, slideTo = null, duration = null) {
    // Determine scope key for note
    const noteScope = `note_${noteName}`;

    // Get all components in scope (global + note + key)
    const components = this._getComponentsInScope(noteScope, keyScope);

    // Create note instance
    const note = new NoteInstance(
      this.audioContext,
      noteName,
      frequency,
      noteScope,
      keyScope,
      components,
      this.store,
      this.schemas,
      oscillatorFilter,
      velocity,
      slideTo,
      duration
    );

    // Track active note
    const noteKey = `${noteName}_${Date.now()}`;
    this.activeNotes.set(noteKey, note);

    // Get master input (first node in effects chain)
    // Signal flow: oscillators → distortion → compressor → filter → gain → destination
    const masterInput = this.masterDistortion?.input || this.masterCompressor || this.masterFilter || this.masterGain;

    // Start the note
    note.start(masterInput);

    return note;
  }

  /**
   * Get all components available in a scope (combines global, note, key)
   */
  _getComponentsInScope(noteScope, keyScope) {
    // Start with global
    let components = this.store.getAllComponentsInScope('global');

    // Merge note-specific
    const noteComponents = this.store.getAllComponentsInScope('trigger', noteScope);
    components = this._mergeComponents(components, noteComponents);

    // Merge key-specific if active
    if (keyScope) {
      const keyComponents = this.store.getAllComponentsInScope('trigger', keyScope);
      components = this._mergeComponents(components, keyComponents);
    }

    return components;
  }

  /**
   * Merge component sets (later overrides earlier)
   */
  _mergeComponents(base, override) {
    const result = { ...base };
    for (const [type, instances] of Object.entries(override)) {
      result[type] = { ...result[type], ...instances };
    }
    return result;
  }

  /**
   * Create a filter node from component instance
   */
  _createFilterNode(componentName) {
    const component = this.store.getComponent(componentName);
    if (!component) return null;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';

    // Set frequency
    const freq = this._resolveAttributeValue(component.attributes.frequency, null);
    if (freq !== null) {
      filter.frequency.value = freq;
    }

    // Set resonance
    const res = this._resolveAttributeValue(component.attributes.resonance, null);
    if (res !== null) {
      filter.Q.value = res;
    }

    return filter;
  }

  /**
   * Create a compressor node from component instance
   */
  _createCompressorNode(componentName) {
    const component = this.store.getComponent(componentName);
    if (!component) return null;

    const compressor = this.audioContext.createDynamicsCompressor();

    // Set parameters
    const threshold = this._resolveAttributeValue(component.attributes.threshold, null);
    if (threshold !== null) compressor.threshold.value = threshold;

    const ratio = this._resolveAttributeValue(component.attributes.ratio, null);
    if (ratio !== null) compressor.ratio.value = ratio;

    const knee = this._resolveAttributeValue(component.attributes.knee, null);
    if (knee !== null) compressor.knee.value = knee;

    const attack = this._resolveAttributeValue(component.attributes.attack, null);
    if (attack !== null) compressor.attack.value = attack;

    const release = this._resolveAttributeValue(component.attributes.release, null);
    if (release !== null) compressor.release.value = release;

    return compressor;
  }

  /**
   * Create a distortion node from component instance
   * Returns { input, output } for wet/dry routing
   */
  _createDistortionNode(componentName) {
    const component = this.store.getComponent(componentName);
    if (!component) return null;

    // Get parameters
    const drive = this._resolveAttributeValue(component.attributes.drive, null) ?? 50;
    const mix = this._resolveAttributeValue(component.attributes.mix, null) ?? 100;

    // Create nodes
    const inputGain = this.audioContext.createGain();
    const outputGain = this.audioContext.createGain();
    const wetGain = this.audioContext.createGain();
    const dryGain = this.audioContext.createGain();
    const waveshaper = this.audioContext.createWaveShaper();

    // Set wet/dry mix
    const wetAmount = mix / 100;
    const dryAmount = 1 - wetAmount;
    wetGain.gain.value = wetAmount;
    dryGain.gain.value = dryAmount;

    // Generate distortion curve based on drive
    waveshaper.curve = this._makeDistortionCurve(drive);
    waveshaper.oversample = '2x'; // Reduce aliasing

    // Gain compensation: reduce output as drive increases to maintain consistent volume
    // Higher drive = more harmonics = perceived louder, so we reduce gain
    const compensation = 1 - (drive / 100) * 0.5; // At drive 100, output is 50%
    outputGain.gain.value = compensation;

    // Connect: input → dry → output
    //          input → waveshaper → wet → output
    inputGain.connect(dryGain);
    dryGain.connect(outputGain);

    inputGain.connect(waveshaper);
    waveshaper.connect(wetGain);
    wetGain.connect(outputGain);

    console.log(`Distortion created: drive=${drive}, mix=${mix}%, compensation=${compensation.toFixed(2)}`);

    return { input: inputGain, output: outputGain };
  }

  /**
   * Generate a soft-clipping distortion curve
   * @param {number} drive - 0-100 distortion amount
   */
  _makeDistortionCurve(drive) {
    const samples = 44100;
    const curve = new Float32Array(samples);

    // Convert drive (0-100) to useful range
    // drive 0 = clean, drive 100 = heavy saturation
    const amount = drive / 100;

    for (let i = 0; i < samples; i++) {
      // Map index to -1 to 1
      const x = (i * 2) / samples - 1;

      if (amount === 0) {
        // No distortion - linear
        curve[i] = x;
      } else {
        // Attempt tanh-style soft clipping
        // Mix between linear and heavily saturated based on drive
        const k = amount * 50; // Saturation intensity
        const saturated = Math.tanh(k * x) / Math.tanh(k); // Normalize to -1 to 1
        curve[i] = x * (1 - amount) + saturated * amount;
      }
    }

    return curve;
  }

  /**
   * Resolve an attribute value (handles variables and references)
   */
  _resolveAttributeValue(attrValue, scopeKey) {
    if (attrValue === null || attrValue === undefined) return null;

    // Check if it's a variable reference
    if (typeof attrValue === 'object' && attrValue.type === 'variable_ref') {
      return this.store.resolveVariable(attrValue.value, scopeKey);
    }

    // Check if it's a component reference
    if (typeof attrValue === 'object' && attrValue.type === 'component_ref') {
      return attrValue; // Return the reference object
    }

    // Return literal value
    return attrValue;
  }

  /**
   * Convert percentage (0-100) to gain (0-1)
   */
  _percentageToGain(percentage) {
    if (typeof percentage === 'object' && percentage.type === 'variable_ref') {
      const resolved = this.store.resolveVariable(percentage.value, null);
      return resolved / 100;
    }
    return percentage / 100;
  }

  /**
   * Stop a note
   */
  stopNote(noteInstance) {
    noteInstance.stop();
    // Remove from active notes
    for (const [key, note] of this.activeNotes.entries()) {
      if (note === noteInstance) {
        this.activeNotes.delete(key);
        break;
      }
    }
  }

  /**
   * Stop all notes
   */
  stopAllNotes() {
    for (const note of this.activeNotes.values()) {
      note.stop();
    }
    this.activeNotes.clear();
  }
}

/**
 * Note Instance class
 * Represents a single note with all its oscillators and modulation
 */
class NoteInstance {
  constructor(audioContext, noteName, frequency, noteScope, keyScope, components, store, schemas, oscillatorFilter = null, velocity = 127, slideTo = null, duration = null) {
    this.audioContext = audioContext;
    this.noteName = noteName;
    this.frequency = frequency;
    this.noteScope = noteScope;
    this.keyScope = keyScope;
    this.components = components;
    this.store = store;
    this.schemas = schemas;
    this.oscillatorFilter = oscillatorFilter; // Only create this oscillator (null = all)
    this.velocity = velocity / 127; // Normalize 0-127 to 0-1 for gain scaling
    this.slideTo = slideTo; // { frequency, noteName } for portamento
    this.slideDuration = duration; // Duration in ms for slide timing

    // Audio nodes created for this note
    this.oscillators = [];
    this.envelopeGains = [];
    this.lfos = [];
    this.noteGain = null;

    // Start time
    this.startTime = 0;
  }

  /**
   * Start the note
   */
  start(destination) {
    this.startTime = this.audioContext.currentTime;

    // Create note gain (master envelope will control this)
    this.noteGain = this.audioContext.createGain();
    this.noteGain.connect(destination);

    // Create oscillators
    this._createOscillators();

    // Apply master envelope
    this._applyMasterEnvelope();
  }

  /**
   * Create all oscillators for this note
   */
  _createOscillators() {
    const oscillators = this.components.oscillators || {};

    for (const [name, oscComponent] of Object.entries(oscillators)) {
      // If oscillatorFilter is set, only create that oscillator
      if (this.oscillatorFilter && name !== this.oscillatorFilter) {
        continue;
      }
      this._createOscillator(oscComponent);
    }
  }

  /**
   * Create a single oscillator
   */
  _createOscillator(oscComponent) {
    const osc = this.audioContext.createOscillator();

    // Set waveform
    const wave = this._resolveValue(oscComponent.attributes.wave);
    osc.type = wave || 'sine';

    // Set frequency (base frequency + octave + detune)
    const octave = this._resolveValue(oscComponent.attributes.octave) || 0;
    const detune = this._resolveValue(oscComponent.attributes.detune) || 0;
    const baseFreq = this.frequency * Math.pow(2, octave);
    osc.frequency.value = baseFreq;
    osc.detune.value = detune;

    // Apply portamento (slide) if specified
    console.log(`[SLIDE DEBUG] slideTo=${JSON.stringify(this.slideTo)}, slideDuration=${this.slideDuration}`);
    if (this.slideTo && this.slideDuration) {
      const targetFreq = this.slideTo.frequency * Math.pow(2, octave);
      const slideTime = this.slideDuration / 1000; // Convert ms to seconds
      const now = this.audioContext.currentTime;

      console.log(`[SLIDE] Applying portamento: ${baseFreq.toFixed(2)}Hz -> ${targetFreq.toFixed(2)}Hz over ${slideTime.toFixed(3)}s`);

      // Use exponentialRampToValueAtTime for more natural pitch glide
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(targetFreq, now + slideTime * 0.9);
    } else if (this.slideTo) {
      console.warn(`[SLIDE] slideTo present but slideDuration missing: ${this.slideDuration}`);
    }

    // Create envelope gain for this oscillator
    const envGain = this.audioContext.createGain();
    osc.connect(envGain);

    // Check for per-oscillator distortion
    const distortionRef = oscComponent.attributes.distortion;
    if (distortionRef && distortionRef.type === 'component_ref') {
      const distortion = this._createDistortionNode(distortionRef.value);
      if (distortion) {
        envGain.connect(distortion.input);
        distortion.output.connect(this.noteGain);
        console.log(`Oscillator ${oscComponent.name} using distortion: ${distortionRef.value}`);
      } else {
        envGain.connect(this.noteGain);
      }
    } else {
      envGain.connect(this.noteGain);
    }

    // Get volume and apply velocity scaling
    const volume = this._resolveValue(oscComponent.attributes.volume) || 50;
    const volumeGain = (volume / 100) * this.velocity; // Scale by velocity

    // Apply oscillator envelope (attack, decay, sustain, release)
    const attack = this._resolveValue(oscComponent.attributes.attack) || 100;
    const decay = this._resolveValue(oscComponent.attributes.decay) || 100;
    const sustain = this._resolveValue(oscComponent.attributes.sustain) || 100;
    const release = this._resolveValue(oscComponent.attributes.release) || 500;

    console.log(`Oscillator ${oscComponent.name} ADSR: attack=${attack}ms, decay=${decay}ms, sustain=${sustain}%, release=${release}ms, velocity=${Math.round(this.velocity * 100)}%`);

    const attackTime = attack / 1000;
    const decayTime = decay / 1000;
    const sustainLevel = (sustain / 100) * volumeGain; // Already includes velocity
    const releaseTime = release / 1000;

    const now = this.audioContext.currentTime;
    envGain.gain.setValueAtTime(0, now);
    envGain.gain.linearRampToValueAtTime(volumeGain, now + attackTime);
    envGain.gain.linearRampToValueAtTime(sustainLevel, now + attackTime + decayTime);

    // Apply pitch modulation (LFO)
    const pitchRef = oscComponent.attributes.pitch;
    console.log(`Oscillator ${oscComponent.name} pitch attribute:`, pitchRef);
    if (pitchRef && pitchRef.type === 'component_ref') {
      console.log(`Applying pitch modulation from ${pitchRef.value} to ${oscComponent.name}`);
      this._applyPitchModulation(osc, pitchRef.value);
    }

    // Start oscillator
    osc.start();

    // Track nodes
    this.oscillators.push({ osc, envGain, releaseTime });
  }

  /**
   * Apply pitch modulation from LFO
   */
  _applyPitchModulation(oscillator, lfoName) {
    const lfoComponent = this.store.getComponent(lfoName);
    console.log(`_applyPitchModulation: Looking for LFO "${lfoName}":`, lfoComponent);
    if (!lfoComponent) {
      console.warn(`LFO component "${lfoName}" not found!`);
      return;
    }

    // Create LFO
    const lfo = this.audioContext.createOscillator();

    const wave = this._resolveValue(lfoComponent.attributes.wave) || 'sine';
    const rate = this._resolveValue(lfoComponent.attributes.rate) || 5;
    const depth = this._resolveValue(lfoComponent.attributes.depth) || 10;

    console.log(`Creating LFO: wave=${wave}, rate=${rate}Hz, depth=${depth}cents`);

    lfo.type = wave;
    lfo.frequency.value = rate;

    // Create depth gain (convert cents to Hz)
    const depthGain = this.audioContext.createGain();
    const depthInHz = oscillator.frequency.value * (depth / 1200);
    depthGain.gain.value = depthInHz;

    console.log(`LFO depth: ${depth} cents = ${depthInHz.toFixed(2)} Hz at base freq ${oscillator.frequency.value}Hz`);

    // Connect: LFO -> depthGain -> oscillator.frequency
    lfo.connect(depthGain);
    depthGain.connect(oscillator.frequency);

    lfo.start();
    console.log(`✓ LFO started and connected to oscillator frequency`);

    // Track LFO
    this.lfos.push(lfo);
  }

  /**
   * Apply master envelope
   */
  _applyMasterEnvelope() {
    // Get master envelope attributes (from master trigger or use defaults)
    const masterAttrs = this.store.getTriggerAttributes('master');

    const attack = this._resolveValue(masterAttrs.attack) || 100;
    const decay = this._resolveValue(masterAttrs.decay) || 100;
    const sustain = this._resolveValue(masterAttrs.sustain) || 100;
    const release = this._resolveValue(masterAttrs.release) || 500;

    const attackTime = attack / 1000;
    const decayTime = decay / 1000;
    const sustainLevel = sustain / 100;

    const now = this.audioContext.currentTime;
    this.noteGain.gain.setValueAtTime(0, now);
    this.noteGain.gain.linearRampToValueAtTime(1, now + attackTime);
    this.noteGain.gain.linearRampToValueAtTime(sustainLevel, now + attackTime + decayTime);
  }

  /**
   * Stop the note
   */
  stop() {
    const now = this.audioContext.currentTime;

    // Get master release time
    const masterAttrs = this.store.getTriggerAttributes('master');
    const masterRelease = this._resolveValue(masterAttrs.release) || 500;
    const masterReleaseTime = masterRelease / 1000;

    console.log(`stop() called - master release: ${masterRelease}ms (${masterReleaseTime}s)`);

    // Apply release to master envelope
    this.noteGain.gain.cancelScheduledValues(now);
    this.noteGain.gain.setValueAtTime(this.noteGain.gain.value, now);
    this.noteGain.gain.linearRampToValueAtTime(0, now + masterReleaseTime);

    // Apply release to each oscillator envelope
    for (const { envGain, releaseTime } of this.oscillators) {
      console.log(`  oscillator release: ${releaseTime}s`);
      envGain.gain.cancelScheduledValues(now);
      envGain.gain.setValueAtTime(envGain.gain.value, now);
      envGain.gain.linearRampToValueAtTime(0, now + releaseTime);
    }

    // Stop oscillators and LFOs after release
    const maxRelease = Math.max(masterReleaseTime, ...this.oscillators.map(o => o.releaseTime));
    console.log(`  maxRelease: ${maxRelease}s, stopping oscillators in ${maxRelease * 1000 + 100}ms`);
    setTimeout(() => {
      for (const { osc } of this.oscillators) {
        osc.stop();
      }
      for (const lfo of this.lfos) {
        lfo.stop();
      }
    }, maxRelease * 1000 + 100);
  }

  /**
   * Resolve attribute value (handles variables and expressions)
   */
  _resolveValue(value) {
    if (value === null || value === undefined) return null;

    // Handle variable references
    if (typeof value === 'object' && value.type === 'variable_ref') {
      return this.store.resolveVariable(value.value, this.keyScope || this.noteScope);
    }

    // Handle mathematical expressions
    if (typeof value === 'object' && value.type === 'expression') {
      console.log(`Evaluating expression: ${value.value}`);

      // Create a variable resolver for the current scope
      const variableResolver = (varName) => {
        const resolved = this.store.resolveVariable(varName, this.keyScope || this.noteScope);
        if (resolved === null || resolved === undefined) {
          return null;
        }
        // If the variable itself is an object (e.g., metadata), extract the value
        if (typeof resolved === 'object' && 'value' in resolved) {
          return resolved.value;
        }
        return resolved;
      };

      // Evaluate the expression
      const result = ExpressionEvaluator.evaluate(value.value, variableResolver);
      if (result === null) {
        console.error(`Failed to evaluate expression: ${value.value}`);
        return null;
      }
      console.log(`Expression "${value.value}" evaluated to: ${result}`);
      return result;
    }

    return value;
  }

  /**
   * Create a distortion node for per-oscillator distortion
   */
  _createDistortionNode(componentName) {
    const component = this.store.getComponent(componentName);
    if (!component) return null;

    // Get parameters
    const drive = this._resolveValue(component.attributes.drive) ?? 50;
    const mix = this._resolveValue(component.attributes.mix) ?? 100;

    // Create nodes
    const inputGain = this.audioContext.createGain();
    const outputGain = this.audioContext.createGain();
    const wetGain = this.audioContext.createGain();
    const dryGain = this.audioContext.createGain();
    const waveshaper = this.audioContext.createWaveShaper();

    // Set wet/dry mix
    const wetAmount = mix / 100;
    const dryAmount = 1 - wetAmount;
    wetGain.gain.value = wetAmount;
    dryGain.gain.value = dryAmount;

    // Generate distortion curve based on drive
    waveshaper.curve = this._makeDistortionCurve(drive);
    waveshaper.oversample = '2x';

    // Gain compensation
    const compensation = 1 - (drive / 100) * 0.5;
    outputGain.gain.value = compensation;

    // Connect: input → dry → output
    //          input → waveshaper → wet → output
    inputGain.connect(dryGain);
    dryGain.connect(outputGain);

    inputGain.connect(waveshaper);
    waveshaper.connect(wetGain);
    wetGain.connect(outputGain);

    return { input: inputGain, output: outputGain };
  }

  /**
   * Generate distortion curve for per-oscillator distortion
   */
  _makeDistortionCurve(drive) {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const amount = drive / 100;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;

      if (amount === 0) {
        curve[i] = x;
      } else {
        const k = amount * 50;
        const saturated = Math.tanh(k * x) / Math.tanh(k);
        curve[i] = x * (1 - amount) + saturated * amount;
      }
    }

    return curve;
  }
}

// Global audio engine instance (will be initialized after audio context is created)
let audioEngine = null;

function initializeAudioEngine(audioContext) {
  if (typeof instanceStore === 'undefined' || typeof COMPONENT_SCHEMAS === 'undefined') {
    console.error('Cannot initialize audio engine: instanceStore or schemas not loaded');
    return;
  }

  audioEngine = new AudioEngine(audioContext, instanceStore, {
    AttributeType,
    COMPONENT_SCHEMAS,
    TRIGGER_SCHEMAS,
    SchemaUtils
  });

  audioEngine.initializeMaster();

  console.log('Audio engine initialized');
}
