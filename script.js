// Oscillator configuration - dynamically updated from text box
let oscillatorConfigs = [
  { wave: 'sine', octave: 0, volume: 0.5 },
  { wave: 'sine', octave: 1, volume: 0.3 },
  { wave: 'sine', octave: -1, volume: 0.2 }
];

// Parse text box and update UI visibility and oscillator configs
function syncUIFromText() {
  const text = parametersTextbox.textContent;
  const lines = text.split('\n');

  // Track which oscillators are defined in the text
  const oscillators = {
    1: { wave: null, octave: null, volume: null },
    2: { wave: null, octave: null, volume: null },
    3: { wave: null, octave: null, volume: null }
  };

  lines.forEach(line => {
    const [key, value] = line.split(':').map(s => s.trim());

    // Check for oscillator parameters
    for (let i = 1; i <= 3; i++) {
      if (key === `Oscillator ${i} Wave`) oscillators[i].wave = value;
      if (key === `Oscillator ${i} Octave`) oscillators[i].octave = parseInt(value);
      if (key === `Oscillator ${i} Volume`) oscillators[i].volume = parseFloat(value);
    }
  });

  // Update oscillatorConfigs array to only include defined oscillators
  oscillatorConfigs = [];

  for (let i = 1; i <= 3; i++) {
    const osc = oscillators[i];
    const section = document.getElementById(`osc${i}-section`);

    // Check if this oscillator is fully defined (has all 3 parameters)
    const isDefined = osc.wave !== null && osc.octave !== null && osc.volume !== null;

    if (isDefined) {
      // Show the section and add to configs
      section?.classList.remove('hidden');
      oscillatorConfigs.push({
        wave: osc.wave,
        octave: osc.octave,
        volume: osc.volume
      });
    } else {
      // Hide the section
      section?.classList.add('hidden');
    }
  }
}

// Polyphony Manager to track active notes
class PolyphonyManager {
  constructor() {
    this.activeNotes = new Map();
  }

  startNote(frequency, noteId, velocity = 127) {
    if (this.activeNotes.has(noteId)) {
      this.stopNote(noteId);
    }
    const note = new Note(frequency, noteId, this);
    this.activeNotes.set(noteId, note);
    note.start(velocity);
  }

  stopNote(noteId) {
    const note = this.activeNotes.get(noteId);
    if (note) {
      note.stop();
      this.activeNotes.delete(noteId);
    }
  }

  stopAllNotes() {
    this.activeNotes.forEach((note) => note.stop());
    this.activeNotes.clear();
  }
}

// Encapsulated Note class with multiple oscillators
class Note {
  constructor(frequency, noteId, manager) {
    this.frequency = frequency;
    this.noteId = noteId;
    this.manager = manager;

    // Main gain node for the entire note (ADSR envelope)
    this.gainNode = audioContext.createGain();
    this.gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    this.gainNode.connect(masterGain);

    // Create multiple oscillators based on configuration
    this.oscillators = [];
    this.oscillatorGains = [];

    oscillatorConfigs.forEach((config) => {
      if (config.volume > 0) { // Only create if volume > 0
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        // Set waveform
        osc.type = config.wave;

        // Calculate frequency with octave offset
        const octaveMultiplier = Math.pow(2, config.octave);
        osc.frequency.value = frequency * octaveMultiplier;

        // Set individual oscillator volume
        gain.gain.value = config.volume;

        // Connect: oscillator → individual gain → main gain node
        osc.connect(gain);
        gain.connect(this.gainNode);

        this.oscillators.push(osc);
        this.oscillatorGains.push(gain);
      }
    });
  }

  start(velocity = 127) {
    const attackTime = parseFloat(attackSlider.value) / 1000;
    const sustainLevel = parseFloat(sustainSlider.value);
    const normalizedVelocity = velocity / 127;
    const maxAmplitude = normalizedVelocity * sustainLevel;

    this.gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    this.gainNode.gain.linearRampToValueAtTime(maxAmplitude, audioContext.currentTime + attackTime);

    // Start all oscillators
    this.oscillators.forEach(osc => osc.start());
  }

  stop() {
    const releaseTime = parseFloat(releaseSlider.value) / 1000;

    this.gainNode.gain.cancelScheduledValues(audioContext.currentTime);
    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, audioContext.currentTime);
    this.gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + releaseTime);

    setTimeout(() => {
      // Stop and disconnect all oscillators
      this.oscillators.forEach(osc => {
        if (osc) {
          osc.stop();
          osc.disconnect();
        }
      });

      // Disconnect all oscillator gains
      this.oscillatorGains.forEach(gain => {
        if (gain) {
          gain.disconnect();
        }
      });

      if (this.gainNode) {
        this.gainNode.disconnect();
      }
    }, releaseTime * 1000);
  }
}

// Initialize Audio Context
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioContext.createGain();
masterGain.gain.value = 0.8;

// Add compressor to prevent clipping
const compressor = audioContext.createDynamicsCompressor();
compressor.threshold.value = -20;  // Start compressing at -20dB
compressor.knee.value = 30;        // Smooth compression curve
compressor.ratio.value = 12;       // Heavy compression ratio
compressor.attack.value = 0.003;   // Fast attack (3ms)
compressor.release.value = 0.25;   // Quick release (250ms)

// Connect: masterGain → compressor → destination
masterGain.connect(compressor);
compressor.connect(audioContext.destination);

// DOM Elements
const osc1Wave = document.getElementById("osc1-wave");
const osc1Octave = document.getElementById("osc1-octave");
const osc1Volume = document.getElementById("osc1-volume");
const osc2Wave = document.getElementById("osc2-wave");
const osc2Octave = document.getElementById("osc2-octave");
const osc2Volume = document.getElementById("osc2-volume");
const osc3Wave = document.getElementById("osc3-wave");
const osc3Octave = document.getElementById("osc3-octave");
const osc3Volume = document.getElementById("osc3-volume");
const attackSlider = document.getElementById("attack-slider");
const sustainSlider = document.getElementById("sustain-slider");
const releaseSlider = document.getElementById("release-slider");
const masterVolumeSlider = document.getElementById("master-volume");
const compressorThresholdSlider = document.getElementById("compressor-threshold");
const compressorRatioSlider = document.getElementById("compressor-ratio");
const compressorKneeSlider = document.getElementById("compressor-knee");
const compressorAttackSlider = document.getElementById("compressor-attack");
const compressorReleaseSlider = document.getElementById("compressor-release");
const parametersTextbox = document.getElementById("parameters");

// Polyphony Manager
const polyphonyManager = new PolyphonyManager();

// Syntax highlighting helper
function applySyntaxHighlighting(text) {
  const lines = text.split('\n');
  return lines.map(line => {
    if (!line.trim()) return '';

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return line;

    const key = line.substring(0, colonIndex);
    const colon = ':';
    const value = line.substring(colonIndex + 1).trim();

    // Determine if value is a number or string
    const isNumber = !isNaN(parseFloat(value)) && isFinite(value);
    const valueClass = isNumber ? 'syntax-number' : 'syntax-string';

    return `<span class="syntax-key">${key}</span><span class="syntax-colon">${colon}</span> <span class="${valueClass}">${value}</span>`;
  }).join('\n');
}

// Sync Parameters to Textbox
function updateParametersTextbox() {
  const plainText = `Oscillator 1 Wave: ${osc1Wave.value}
Oscillator 1 Octave: ${osc1Octave.value}
Oscillator 1 Volume: ${osc1Volume.value}
Oscillator 2 Wave: ${osc2Wave.value}
Oscillator 2 Octave: ${osc2Octave.value}
Oscillator 2 Volume: ${osc2Volume.value}
Oscillator 3 Wave: ${osc3Wave.value}
Oscillator 3 Octave: ${osc3Octave.value}
Oscillator 3 Volume: ${osc3Volume.value}
Attack Time: ${attackSlider.value}
Sustain Level: ${sustainSlider.value}
Release Time: ${releaseSlider.value}
Master Volume: ${masterVolumeSlider.value}
Compressor Threshold: ${compressorThresholdSlider.value}
Compressor Ratio: ${compressorRatioSlider.value}
Compressor Knee: ${compressorKneeSlider.value}
Compressor Attack: ${compressorAttackSlider.value}
Compressor Release: ${compressorReleaseSlider.value}`;

  const highlighted = applySyntaxHighlighting(plainText);
  parametersTextbox.innerHTML = highlighted;
}

// Update Sliders and Dropdown from Textbox
function updateControlsFromTextbox() {
  const lines = parametersTextbox.textContent.split("\n");
  lines.forEach((line) => {
    const [key, value] = line.split(":").map((str) => str.trim());
    if (key === "Wave Type") waveformSelect.value = value;
    if (key === "Attack Time") attackSlider.value = parseInt(value);
    if (key === "Sustain Level") sustainSlider.value = parseFloat(value);
    if (key === "Release Time") releaseSlider.value = parseInt(value);
    if (key === "Master Volume") masterVolumeSlider.value = parseFloat(value);
  });
}

// Helper to get cursor offset in plain text
function getCursorOffset(element) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return 0;

  const range = selection.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(element);
  preRange.setEnd(range.endContainer, range.endOffset);
  return preRange.toString().length;
}

// Helper to set cursor position in plain text
function setCursorOffset(element, offset) {
  const selection = window.getSelection();
  const range = document.createRange();

  let currentOffset = 0;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const nodeLength = node.textContent.length;

    if (currentOffset + nodeLength >= offset) {
      range.setStart(node, offset - currentOffset);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    currentOffset += nodeLength;
  }
}

// Find number at cursor position
function findNumberAtPosition(text, position) {
  let start = position;
  let end = position;

  // Look backwards to find start of number
  while (start > 0 && /[\d.\-]/.test(text[start - 1])) {
    start--;
  }

  // Look forwards to find end of number
  while (end < text.length && /[\d.\-]/.test(text[end])) {
    end++;
  }

  const value = text.substring(start, end);
  const parsed = parseFloat(value);

  if (!value || isNaN(parsed)) return null;

  return { start, end, value: parsed };
}

// Find wave type at cursor position
function findWaveTypeAtPosition(text, position) {
  // Find the word at cursor position
  let start = position;
  let end = position;

  // Look backwards to find start of word
  while (start > 0 && /[a-z]/.test(text[start - 1])) {
    start--;
  }

  // Look forwards to find end of word
  while (end < text.length && /[a-z]/.test(text[end])) {
    end++;
  }

  const value = text.substring(start, end);
  const waveTypes = ['sine', 'square', 'sawtooth', 'triangle'];

  if (waveTypes.includes(value)) {
    return { start, end, value };
  }

  return null;
}

// Simple increment/decrement (no acceleration)

function performIncrement(direction, shiftKey) {
  const plainText = parametersTextbox.textContent;
  const cursorOffset = getCursorOffset(parametersTextbox);

  // Check if cursor is on a wave type first
  const waveInfo = findWaveTypeAtPosition(plainText, cursorOffset);

  if (waveInfo) {
    // Cycle through wave types
    const waveTypes = ['sine', 'square', 'sawtooth', 'triangle'];
    const currentIndex = waveTypes.indexOf(waveInfo.value);
    const newIndex = (currentIndex + direction + waveTypes.length) % waveTypes.length;
    const newValue = waveTypes[newIndex];

    // Replace in text
    const newText = plainText.substring(0, waveInfo.start) +
                    newValue +
                    plainText.substring(waveInfo.end);

    // Update the textbox
    parametersTextbox.textContent = newText;

    // Trigger parameter updates
    const lines = newText.split("\n");
    lines.forEach((line) => {
      const [key, value] = line.split(":").map((str) => str.trim());

      // Oscillator 1
      if (key === "Oscillator 1 Wave" && ["sine", "square", "sawtooth", "triangle"].includes(value)) {
        osc1Wave.value = value;
      } else if (key === "Oscillator 1 Octave" && !isNaN(parseInt(value))) {
        osc1Octave.value = parseInt(value);
      } else if (key === "Oscillator 1 Volume" && !isNaN(parseFloat(value))) {
        osc1Volume.value = parseFloat(value);
      }
      // Oscillator 2
      else if (key === "Oscillator 2 Wave" && ["sine", "square", "sawtooth", "triangle"].includes(value)) {
        osc2Wave.value = value;
      } else if (key === "Oscillator 2 Octave" && !isNaN(parseInt(value))) {
        osc2Octave.value = parseInt(value);
      } else if (key === "Oscillator 2 Volume" && !isNaN(parseFloat(value))) {
        osc2Volume.value = parseFloat(value);
      }
      // Oscillator 3
      else if (key === "Oscillator 3 Wave" && ["sine", "square", "sawtooth", "triangle"].includes(value)) {
        osc3Wave.value = value;
      } else if (key === "Oscillator 3 Octave" && !isNaN(parseInt(value))) {
        osc3Octave.value = parseInt(value);
      } else if (key === "Oscillator 3 Volume" && !isNaN(parseFloat(value))) {
        osc3Volume.value = parseFloat(value);
      }
      // Envelope
      else if (key === "Attack Time" && !isNaN(parseInt(value))) {
        attackSlider.value = parseInt(value);
      } else if (key === "Sustain Level" && !isNaN(parseFloat(value))) {
        sustainSlider.value = parseFloat(value);
      } else if (key === "Release Time" && !isNaN(parseInt(value))) {
        releaseSlider.value = parseInt(value);
      } else if (key === "Master Volume" && !isNaN(parseFloat(value))) {
        masterVolumeSlider.value = parseFloat(value);
        masterGain.gain.value = parseFloat(value);
      }
      // Compressor
      else if (key === "Compressor Threshold" && !isNaN(parseFloat(value))) {
        compressorThresholdSlider.value = parseFloat(value);
        compressor.threshold.value = parseFloat(value);
      } else if (key === "Compressor Ratio" && !isNaN(parseFloat(value))) {
        compressorRatioSlider.value = parseFloat(value);
        compressor.ratio.value = parseFloat(value);
      } else if (key === "Compressor Knee" && !isNaN(parseFloat(value))) {
        compressorKneeSlider.value = parseFloat(value);
        compressor.knee.value = parseFloat(value);
      } else if (key === "Compressor Attack" && !isNaN(parseFloat(value))) {
        compressorAttackSlider.value = parseFloat(value);
        compressor.attack.value = parseFloat(value);
      } else if (key === "Compressor Release" && !isNaN(parseFloat(value))) {
        compressorReleaseSlider.value = parseFloat(value);
        compressor.release.value = parseFloat(value);
      }
    });

    // Apply syntax highlighting
    const highlighted = applySyntaxHighlighting(newText);
    parametersTextbox.innerHTML = highlighted;

    // Sync UI visibility and configs
    syncUIFromText();

    // Restore cursor position
    setCursorOffset(parametersTextbox, waveInfo.start + newValue.length);
    return;
  }

  // Check for number
  const numberInfo = findNumberAtPosition(plainText, cursorOffset);

  if (!numberInfo) return;

  // Look at the line to determine parameter type
  const lineStart = plainText.lastIndexOf('\n', numberInfo.start - 1) + 1;
  const lineEnd = plainText.indexOf('\n', numberInfo.start);
  const line = plainText.substring(lineStart, lineEnd === -1 ? plainText.length : lineEnd);

  // Determine increment based on parameter type
  let increment;
  if (line.includes('Volume') || line.includes('Sustain')) {
    increment = shiftKey ? 1 : 0.1;
  } else if (line.includes('Attack') || line.includes('Release')) {
    increment = shiftKey ? 100 : 10;
  } else if (line.includes('Compressor Attack') || line.includes('Compressor Release')) {
    increment = shiftKey ? 0.01 : 0.001;
  } else {
    increment = shiftKey ? 10 : 1;
  }

  const delta = direction * increment;
  let newValue = numberInfo.value + delta;

  // Round to avoid floating point issues
  newValue = Math.round(newValue * 1000) / 1000;

  // Apply appropriate bounds
  if (line.includes('Volume') || line.includes('Sustain')) {
    newValue = Math.max(0, Math.min(1, newValue));
  } else if (line.includes('Attack') || line.includes('Release')) {
    newValue = Math.max(0, newValue);
  } else if (line.includes('Octave')) {
    newValue = Math.max(-2, Math.min(2, newValue));
  } else if (line.includes('Threshold')) {
    newValue = Math.max(-100, Math.min(0, newValue));
  } else if (line.includes('Ratio')) {
    newValue = Math.max(1, Math.min(20, newValue));
  } else if (line.includes('Knee')) {
    newValue = Math.max(0, Math.min(40, newValue));
  }

  // Replace in text
  const newText = plainText.substring(0, numberInfo.start) +
                  newValue +
                  plainText.substring(numberInfo.end);

  // Update the textbox
  parametersTextbox.textContent = newText;

  // Trigger parameter updates
  const lines = newText.split("\n");
  lines.forEach((line) => {
    const [key, value] = line.split(":").map((str) => str.trim());

    // Oscillator 1
    if (key === "Oscillator 1 Wave" && ["sine", "square", "sawtooth", "triangle"].includes(value)) {
      osc1Wave.value = value;
    } else if (key === "Oscillator 1 Octave" && !isNaN(parseInt(value))) {
      osc1Octave.value = parseInt(value);
    } else if (key === "Oscillator 1 Volume" && !isNaN(parseFloat(value))) {
      osc1Volume.value = parseFloat(value);
    }
    // Oscillator 2
    else if (key === "Oscillator 2 Wave" && ["sine", "square", "sawtooth", "triangle"].includes(value)) {
      osc2Wave.value = value;
    } else if (key === "Oscillator 2 Octave" && !isNaN(parseInt(value))) {
      osc2Octave.value = parseInt(value);
    } else if (key === "Oscillator 2 Volume" && !isNaN(parseFloat(value))) {
      osc2Volume.value = parseFloat(value);
    }
    // Oscillator 3
    else if (key === "Oscillator 3 Wave" && ["sine", "square", "sawtooth", "triangle"].includes(value)) {
      osc3Wave.value = value;
    } else if (key === "Oscillator 3 Octave" && !isNaN(parseInt(value))) {
      osc3Octave.value = parseInt(value);
    } else if (key === "Oscillator 3 Volume" && !isNaN(parseFloat(value))) {
      osc3Volume.value = parseFloat(value);
    }
    // Envelope
    else if (key === "Attack Time" && !isNaN(parseInt(value))) {
      attackSlider.value = parseInt(value);
    } else if (key === "Sustain Level" && !isNaN(parseFloat(value))) {
      sustainSlider.value = parseFloat(value);
    } else if (key === "Release Time" && !isNaN(parseInt(value))) {
      releaseSlider.value = parseInt(value);
    } else if (key === "Master Volume" && !isNaN(parseFloat(value))) {
      masterVolumeSlider.value = parseFloat(value);
      masterGain.gain.value = parseFloat(value);
    }
    // Compressor
    else if (key === "Compressor Threshold" && !isNaN(parseFloat(value))) {
      compressorThresholdSlider.value = parseFloat(value);
      compressor.threshold.value = parseFloat(value);
    } else if (key === "Compressor Ratio" && !isNaN(parseFloat(value))) {
      compressorRatioSlider.value = parseFloat(value);
      compressor.ratio.value = parseFloat(value);
    } else if (key === "Compressor Knee" && !isNaN(parseFloat(value))) {
      compressorKneeSlider.value = parseFloat(value);
      compressor.knee.value = parseFloat(value);
    } else if (key === "Compressor Attack" && !isNaN(parseFloat(value))) {
      compressorAttackSlider.value = parseFloat(value);
      compressor.attack.value = parseFloat(value);
    } else if (key === "Compressor Release" && !isNaN(parseFloat(value))) {
      compressorReleaseSlider.value = parseFloat(value);
      compressor.release.value = parseFloat(value);
    }
  });

  // Apply syntax highlighting
  const highlighted = applySyntaxHighlighting(newText);
  parametersTextbox.innerHTML = highlighted;

  // Sync UI visibility and configs
  syncUIFromText();

  // Restore cursor position
  setCursorOffset(parametersTextbox, numberInfo.start + String(newValue).length);
}


parametersTextbox.addEventListener("keydown", (e) => {
  const modifier = e.metaKey || e.ctrlKey;
  const isUp = e.key === "ArrowUp";
  const isDown = e.key === "ArrowDown";

  if (!modifier || (!isUp && !isDown)) return;

  e.preventDefault();

  const direction = isUp ? 1 : -1;
  performIncrement(direction, e.shiftKey);
});

// Live Updates from Textbox
let updateTimeout;
parametersTextbox.addEventListener("input", () => {
  // First, sync UI visibility and configs from text
  syncUIFromText();

  const lines = parametersTextbox.textContent.split("\n");

  // Process each line
  lines.forEach((line) => {
    const [key, value] = line.split(":").map((str) => str.trim());

    // Oscillator 1
    if (key === "Oscillator 1 Wave" && ["sine", "square", "sawtooth", "triangle"].includes(value)) {
      osc1Wave.value = value;
    } else if (key === "Oscillator 1 Octave" && !isNaN(parseInt(value))) {
      osc1Octave.value = parseInt(value);
    } else if (key === "Oscillator 1 Volume" && !isNaN(parseFloat(value))) {
      osc1Volume.value = parseFloat(value);
    }
    // Oscillator 2
    else if (key === "Oscillator 2 Wave" && ["sine", "square", "sawtooth", "triangle"].includes(value)) {
      osc2Wave.value = value;
    } else if (key === "Oscillator 2 Octave" && !isNaN(parseInt(value))) {
      osc2Octave.value = parseInt(value);
    } else if (key === "Oscillator 2 Volume" && !isNaN(parseFloat(value))) {
      osc2Volume.value = parseFloat(value);
    }
    // Oscillator 3
    else if (key === "Oscillator 3 Wave" && ["sine", "square", "sawtooth", "triangle"].includes(value)) {
      osc3Wave.value = value;
    } else if (key === "Oscillator 3 Octave" && !isNaN(parseInt(value))) {
      osc3Octave.value = parseInt(value);
    } else if (key === "Oscillator 3 Volume" && !isNaN(parseFloat(value))) {
      osc3Volume.value = parseFloat(value);
    }
    // Envelope
    else if (key === "Attack Time" && !isNaN(parseInt(value))) {
      attackSlider.value = parseInt(value);
    } else if (key === "Sustain Level" && !isNaN(parseFloat(value))) {
      sustainSlider.value = parseFloat(value);
    } else if (key === "Release Time" && !isNaN(parseInt(value))) {
      releaseSlider.value = parseInt(value);
    } else if (key === "Master Volume" && !isNaN(parseFloat(value))) {
      masterVolumeSlider.value = parseFloat(value);
      masterGain.gain.value = parseFloat(value);
    }
    // Compressor
    else if (key === "Compressor Threshold" && !isNaN(parseFloat(value))) {
      compressorThresholdSlider.value = parseFloat(value);
      compressor.threshold.value = parseFloat(value);
    } else if (key === "Compressor Ratio" && !isNaN(parseFloat(value))) {
      compressorRatioSlider.value = parseFloat(value);
      compressor.ratio.value = parseFloat(value);
    } else if (key === "Compressor Knee" && !isNaN(parseFloat(value))) {
      compressorKneeSlider.value = parseFloat(value);
      compressor.knee.value = parseFloat(value);
    } else if (key === "Compressor Attack" && !isNaN(parseFloat(value))) {
      compressorAttackSlider.value = parseFloat(value);
      compressor.attack.value = parseFloat(value);
    } else if (key === "Compressor Release" && !isNaN(parseFloat(value))) {
      compressorReleaseSlider.value = parseFloat(value);
      compressor.release.value = parseFloat(value);
    }
  });

  // Debounce syntax highlighting
  clearTimeout(updateTimeout);
  updateTimeout = setTimeout(() => {
    const plainText = parametersTextbox.textContent;
    const highlighted = applySyntaxHighlighting(plainText);

    // Only update if content changed
    if (parametersTextbox.innerHTML !== highlighted) {
      const selection = window.getSelection();
      const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      const offset = range ? range.startOffset : 0;

      parametersTextbox.innerHTML = highlighted;

      // Try to restore cursor position
      if (range) {
        try {
          const newRange = document.createRange();
          const textNode = parametersTextbox.firstChild;
          if (textNode) {
            newRange.setStart(textNode, Math.min(offset, textNode.length));
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
          }
        } catch (e) {
          // Cursor restoration failed, that's okay
        }
      }
    }
  }, 500);
});


// Sync Sliders and Dropdown to Textbox on Change
// Oscillator 1
osc1Wave.addEventListener("change", () => {
  updateParametersTextbox();
  syncUIFromText();
});
osc1Octave.addEventListener("input", () => {
  updateParametersTextbox();
  syncUIFromText();
});
osc1Volume.addEventListener("input", () => {
  updateParametersTextbox();
  syncUIFromText();
});

// Oscillator 2
osc2Wave.addEventListener("change", () => {
  updateParametersTextbox();
  syncUIFromText();
});
osc2Octave.addEventListener("input", () => {
  updateParametersTextbox();
  syncUIFromText();
});
osc2Volume.addEventListener("input", () => {
  updateParametersTextbox();
  syncUIFromText();
});

// Oscillator 3
osc3Wave.addEventListener("change", () => {
  updateParametersTextbox();
  syncUIFromText();
});
osc3Octave.addEventListener("input", () => {
  updateParametersTextbox();
  syncUIFromText();
});
osc3Volume.addEventListener("input", () => {
  updateParametersTextbox();
  syncUIFromText();
});

// Envelope
attackSlider.addEventListener("input", updateParametersTextbox);
sustainSlider.addEventListener("input", updateParametersTextbox);
releaseSlider.addEventListener("input", updateParametersTextbox);
masterVolumeSlider.addEventListener("input", () => {
  updateParametersTextbox();
  masterGain.gain.value = parseFloat(masterVolumeSlider.value);
});

// Compressor slider event listeners
compressorThresholdSlider.addEventListener("input", () => {
  updateParametersTextbox();
  compressor.threshold.value = parseFloat(compressorThresholdSlider.value);
});
compressorRatioSlider.addEventListener("input", () => {
  updateParametersTextbox();
  compressor.ratio.value = parseFloat(compressorRatioSlider.value);
});
compressorKneeSlider.addEventListener("input", () => {
  updateParametersTextbox();
  compressor.knee.value = parseFloat(compressorKneeSlider.value);
});
compressorAttackSlider.addEventListener("input", () => {
  updateParametersTextbox();
  compressor.attack.value = parseFloat(compressorAttackSlider.value);
});
compressorReleaseSlider.addEventListener("input", () => {
  updateParametersTextbox();
  compressor.release.value = parseFloat(compressorReleaseSlider.value);
});

// MIDI Support
navigator.requestMIDIAccess()
  .then((midiAccess) => {
    const inputs = midiAccess.inputs.values();
    for (const input of inputs) {
      input.onmidimessage = handleMIDIMessage;
    }
  })
  .catch((err) => console.error("Failed to get MIDI access:", err));

function handleMIDIMessage(message) {
  const [status, note, velocity] = message.data;
  const frequency = 440 * Math.pow(2, (note - 69) / 12);
  const noteId = `midi-${note}`;

  if (status === 144 && velocity > 0) {
    polyphonyManager.startNote(frequency, noteId, velocity);
  } else if (status === 128 || (status === 144 && velocity === 0)) {
    polyphonyManager.stopNote(noteId);
  }
}

// Initialize
updateParametersTextbox();
syncUIFromText();
