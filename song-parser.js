/**
 * Song Parser - Parses .song DSL into an AST
 *
 * Syntax:
 *   song <name>
 *   key <note> <scale>        # e.g., key E minor
 *   bpm <number>
 *   swing <number>
 *
 *   voice <role> = <oscillator>   # e.g., voice kick = kick-drum
 *
 *   rhythm <name>
 *     x - - - x - - -         # x=hit, .=ghost, -=rest
 *
 *   chords <name>
 *     Em - - - | Am - - -     # chord symbols, | optional
 *
 *   bass <name>
 *     1 - - 1 | - - 5 -       # scale degrees of current chord
 *
 *   melody <name>
 *     1 - 3 - | 5 - 3 -       # scale degrees of key
 *
 *   section <name>
 *     kick: <pattern>
 *     bass: <pattern>
 *
 *   structure
 *     verse verse chorus      # section names
 */

class SongParser {
  constructor() {
    this.reset();
  }

  reset() {
    this.ast = {
      name: 'Untitled',
      key: { root: 'c', scale: 'major' },
      bpm: 120,
      swing: 50,
      voices: {},           // role -> oscillator name
      rhythms: {},          // name -> array of hits
      chords: {},           // name -> array of chord symbols
      basslines: {},        // name -> array of scale degrees
      melodies: {},         // name -> array of scale degrees
      sections: {},         // name -> { patterns: { role: patternName } }
      structure: []         // array of section names
    };
  }

  /**
   * Parse .song text into AST
   * @param {string} text - Song DSL text
   * @returns {object} AST
   */
  parse(text) {
    this.reset();
    const lines = text.split('\n');
    let currentBlock = null;  // { type: 'rhythm'|'chords'|'bass'|'melody'|'section'|'structure', name: string }
    let currentContent = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Check if this is a block header (non-indented)
      const isIndented = line.startsWith('  ') || line.startsWith('\t');

      if (!isIndented) {
        // Flush previous block
        if (currentBlock) {
          this._processBlock(currentBlock, currentContent);
          currentContent = [];
        }

        // Parse new block or single-line directive
        currentBlock = this._parseHeader(trimmed);
      } else {
        // Indented content belongs to current block
        if (currentBlock) {
          currentContent.push(trimmed);
        }
      }
    }

    // Flush final block
    if (currentBlock) {
      this._processBlock(currentBlock, currentContent);
    }

    return this.ast;
  }

  /**
   * Parse a non-indented header line
   * @param {string} line - Trimmed line
   * @returns {object|null} Block descriptor or null for single-line directives
   */
  _parseHeader(line) {
    // song <name>
    const songMatch = line.match(/^song\s+(.+)$/i);
    if (songMatch) {
      this.ast.name = songMatch[1].trim();
      return null;
    }

    // key <root> <scale>
    const keyMatch = line.match(/^key\s+([a-g][#b]?)\s+(major|minor|dorian|phrygian|lydian|mixolydian|locrian)$/i);
    if (keyMatch) {
      this.ast.key = {
        root: keyMatch[1].toLowerCase(),
        scale: keyMatch[2].toLowerCase()
      };
      return null;
    }

    // bpm <number>
    const bpmMatch = line.match(/^bpm\s+(\d+)$/i);
    if (bpmMatch) {
      this.ast.bpm = parseInt(bpmMatch[1], 10);
      return null;
    }

    // swing <number>
    const swingMatch = line.match(/^swing\s+(\d+)$/i);
    if (swingMatch) {
      this.ast.swing = parseInt(swingMatch[1], 10);
      return null;
    }

    // voice <role> = <oscillator>
    const voiceMatch = line.match(/^voice\s+(\w+)\s*=\s*(.+)$/i);
    if (voiceMatch) {
      this.ast.voices[voiceMatch[1].toLowerCase()] = voiceMatch[2].trim();
      return null;
    }

    // rhythm <name>
    const rhythmMatch = line.match(/^rhythm\s+(\w+)$/i);
    if (rhythmMatch) {
      return { type: 'rhythm', name: rhythmMatch[1].toLowerCase() };
    }

    // chords <name>
    const chordsMatch = line.match(/^chords\s+(\w+)$/i);
    if (chordsMatch) {
      return { type: 'chords', name: chordsMatch[1].toLowerCase() };
    }

    // bass <name>
    const bassMatch = line.match(/^bass\s+(\w+)$/i);
    if (bassMatch) {
      return { type: 'bass', name: bassMatch[1].toLowerCase() };
    }

    // melody <name>
    const melodyMatch = line.match(/^melody\s+(\w+)$/i);
    if (melodyMatch) {
      return { type: 'melody', name: melodyMatch[1].toLowerCase() };
    }

    // section <name>
    const sectionMatch = line.match(/^section\s+(\w+)$/i);
    if (sectionMatch) {
      return { type: 'section', name: sectionMatch[1].toLowerCase() };
    }

    // structure
    if (line.match(/^structure$/i)) {
      return { type: 'structure', name: null };
    }

    console.warn(`[SongParser] Unknown line: ${line}`);
    return null;
  }

  /**
   * Process a completed block
   * @param {object} block - Block descriptor
   * @param {array} content - Array of content lines
   */
  _processBlock(block, content) {
    const joined = content.join(' ').replace(/\|/g, ' ').trim();  // Remove bar markers
    const tokens = joined.split(/\s+/).filter(t => t);

    switch (block.type) {
      case 'rhythm':
        this.ast.rhythms[block.name] = this._parseRhythm(tokens);
        break;

      case 'chords':
        this.ast.chords[block.name] = this._parseChords(tokens);
        break;

      case 'bass':
        this.ast.basslines[block.name] = this._parseScaleDegrees(tokens);
        break;

      case 'melody':
        this.ast.melodies[block.name] = this._parseScaleDegrees(tokens);
        break;

      case 'section':
        this.ast.sections[block.name] = this._parseSection(content);
        break;

      case 'structure':
        this.ast.structure = tokens.map(t => t.toLowerCase());
        break;
    }
  }

  /**
   * Parse rhythm tokens (x, ., -)
   * @param {array} tokens
   * @returns {array} Array of { hit: boolean, velocity: number }
   */
  _parseRhythm(tokens) {
    return tokens.map(t => {
      if (t === 'x' || t === 'X') {
        return { hit: true, velocity: 100 };
      } else if (t === '.') {
        return { hit: true, velocity: 40 };  // Ghost note
      } else {
        return { hit: false, velocity: 0 };
      }
    });
  }

  /**
   * Parse chord symbols
   * @param {array} tokens
   * @returns {array} Array of chord symbol strings or '-' for sustain
   */
  _parseChords(tokens) {
    return tokens.map(t => {
      if (t === '-') return '-';
      return t;  // Keep chord symbol as-is
    });
  }

  /**
   * Parse scale degree tokens
   * @param {array} tokens
   * @returns {array} Array of { degree: number, octaveShift: number } or { rest: true }
   */
  _parseScaleDegrees(tokens) {
    return tokens.map(t => {
      if (t === '-') {
        return { rest: true };
      }

      // Parse degree with optional octave shift: 1, 1^, 1_, 5^^
      const match = t.match(/^(\d+)([\^_]*)$/);
      if (match) {
        const degree = parseInt(match[1], 10);
        const shifts = match[2];
        let octaveShift = 0;
        for (const c of shifts) {
          if (c === '^') octaveShift++;
          if (c === '_') octaveShift--;
        }
        return { degree, octaveShift };
      }

      console.warn(`[SongParser] Invalid scale degree: ${t}`);
      return { rest: true };
    });
  }

  /**
   * Parse section content (role: pattern mappings)
   * @param {array} lines - Content lines
   * @returns {object} { patterns: { role: patternName }, length: number }
   */
  _parseSection(lines) {
    const patterns = {};
    let explicitLength = null;

    for (const line of lines) {
      // role: pattern
      const match = line.match(/^(\w+)\s*:\s*(.+)$/);
      if (match) {
        patterns[match[1].toLowerCase()] = match[2].trim().toLowerCase();
      }

      // length: <number> (optional explicit length in steps)
      const lengthMatch = line.match(/^length\s*:\s*(\d+)$/i);
      if (lengthMatch) {
        explicitLength = parseInt(lengthMatch[1], 10);
      }
    }

    return { patterns, length: explicitLength };
  }
}

// Scale definitions (intervals from root in semitones)
const SCALE_INTERVALS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10]
};

// Chord definitions (intervals from root in semitones)
const CHORD_INTERVALS = {
  // Major
  'maj': [0, 4, 7],
  '': [0, 4, 7],  // Default major
  'M': [0, 4, 7],
  // Minor
  'm': [0, 3, 7],
  'min': [0, 3, 7],
  // Seventh chords
  'maj7': [0, 4, 7, 11],
  'M7': [0, 4, 7, 11],
  '7': [0, 4, 7, 10],      // Dominant 7
  'm7': [0, 3, 7, 10],
  'min7': [0, 3, 7, 10],
  'dim': [0, 3, 6],
  'dim7': [0, 3, 6, 9],
  'aug': [0, 4, 8],
  'sus2': [0, 2, 7],
  'sus4': [0, 5, 7],
  'add9': [0, 4, 7, 14],
  '9': [0, 4, 7, 10, 14],
  'm9': [0, 3, 7, 10, 14],
  '6': [0, 4, 7, 9],
  'm6': [0, 3, 7, 9]
};

/**
 * Parse a chord symbol into root and type
 * @param {string} symbol - e.g., "Em7", "F#maj", "Bb"
 * @returns {object} { root: string, type: string, rootSemitone: number }
 */
function parseChordSymbol(symbol) {
  const match = symbol.match(/^([A-Ga-g][#b]?)(.*)$/);
  if (!match) return null;

  const root = match[1];
  const type = match[2] || '';

  // Convert root to semitone offset from C
  const noteMap = { 'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11 };
  let rootSemitone = noteMap[root[0].toLowerCase()];
  if (root[1] === '#') rootSemitone++;
  if (root[1] === 'b') rootSemitone--;
  rootSemitone = ((rootSemitone % 12) + 12) % 12;

  return { root, type, rootSemitone };
}

/**
 * Get chord notes as semitone offsets from C0
 * @param {string} symbol - Chord symbol
 * @param {number} octave - Base octave
 * @returns {array} Array of semitone offsets from C0
 */
function getChordNotes(symbol, octave = 3) {
  const parsed = parseChordSymbol(symbol);
  if (!parsed) return [];

  const intervals = CHORD_INTERVALS[parsed.type] || CHORD_INTERVALS[''];
  const baseSemitone = octave * 12 + parsed.rootSemitone;

  return intervals.map(interval => baseSemitone + interval);
}

/**
 * Convert semitone to note name
 * @param {number} semitone - Semitone offset from C0
 * @returns {string} Note name like "c4", "eb3"
 */
function semitoneToNoteName(semitone) {
  const noteNames = ['c', 'c#', 'd', 'eb', 'e', 'f', 'f#', 'g', 'g#', 'a', 'bb', 'b'];
  const octave = Math.floor(semitone / 12);
  const note = noteNames[((semitone % 12) + 12) % 12];
  return `${note}${octave}`;
}

// Export for use in browser
if (typeof window !== 'undefined') {
  window.SongParser = SongParser;
  window.SCALE_INTERVALS = SCALE_INTERVALS;
  window.CHORD_INTERVALS = CHORD_INTERVALS;
  window.parseChordSymbol = parseChordSymbol;
  window.getChordNotes = getChordNotes;
  window.semitoneToNoteName = semitoneToNoteName;
}
