/**
 * Song Compiler - Compiles .song AST to sequencer text
 *
 * Takes the AST from SongParser and generates sequence text
 * that the existing Sequencer can play.
 */

class SongCompiler {
  constructor() {
    this.ast = null;
  }

  /**
   * Compile AST to sequence text
   * @param {object} ast - AST from SongParser
   * @returns {string} Sequence text
   */
  compile(ast) {
    this.ast = ast;

    const lines = [];

    // Header
    lines.push(`# Compiled from: ${ast.name}`);
    lines.push(`# Key: ${ast.key.root} ${ast.key.scale}`);
    lines.push('');
    lines.push(`bpm ${ast.bpm}`);
    if (ast.swing !== 50) {
      lines.push(`swing ${ast.swing}`);
    }
    lines.push('');

    // Build the full sequence by expanding structure
    const tracks = this._buildTracks();

    // Output each track
    for (const [role, steps] of Object.entries(tracks)) {
      const oscillator = ast.voices[role] || role;
      lines.push(`oscillator ${oscillator}`);
      lines.push(`  sequence ${steps.join(' ')}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Build all tracks by expanding structure into sections
   * @returns {object} { role: [steps...] }
   */
  _buildTracks() {
    const tracks = {};

    // Process each section in structure
    for (const sectionName of this.ast.structure) {
      const section = this.ast.sections[sectionName];
      if (!section) {
        console.warn(`[SongCompiler] Unknown section: ${sectionName}`);
        continue;
      }

      // Determine section length (longest pattern)
      const sectionLength = this._getSectionLength(section);

      // Expand each role's pattern for this section
      for (const [role, patternName] of Object.entries(section.patterns)) {
        if (!tracks[role]) {
          tracks[role] = [];
        }

        const steps = this._expandPattern(role, patternName, sectionLength);
        tracks[role].push(...steps);
      }

      // Pad any tracks that weren't in this section
      for (const role of Object.keys(tracks)) {
        if (!section.patterns[role]) {
          // Add rests for this section
          for (let i = 0; i < sectionLength; i++) {
            tracks[role].push('-');
          }
        }
      }
    }

    return tracks;
  }

  /**
   * Get the length of a section in steps
   * @param {object} section - Section definition
   * @returns {number} Length in steps
   */
  _getSectionLength(section) {
    if (section.length) {
      return section.length;
    }

    // Find longest pattern
    let maxLength = 16;  // Default to one bar

    for (const patternName of Object.values(section.patterns)) {
      const length = this._getPatternLength(patternName);
      if (length > maxLength) {
        maxLength = length;
      }
    }

    return maxLength;
  }

  /**
   * Get the length of a named pattern
   * @param {string} name - Pattern name
   * @returns {number} Length in steps
   */
  _getPatternLength(name) {
    if (this.ast.rhythms[name]) {
      return this.ast.rhythms[name].length;
    }
    if (this.ast.chords[name]) {
      return this.ast.chords[name].length;
    }
    if (this.ast.basslines[name]) {
      return this.ast.basslines[name].length;
    }
    if (this.ast.melodies[name]) {
      return this.ast.melodies[name].length;
    }
    return 16;
  }

  /**
   * Expand a pattern to fill sectionLength, with looping
   * @param {string} role - Voice role
   * @param {string} patternName - Pattern name
   * @param {number} sectionLength - Target length
   * @returns {array} Array of step strings
   */
  _expandPattern(role, patternName, sectionLength) {
    // Determine pattern type and get raw pattern
    let rawPattern = null;
    let patternType = null;

    if (this.ast.rhythms[patternName]) {
      rawPattern = this.ast.rhythms[patternName];
      patternType = 'rhythm';
    } else if (this.ast.chords[patternName]) {
      rawPattern = this.ast.chords[patternName];
      patternType = 'chords';
    } else if (this.ast.basslines[patternName]) {
      rawPattern = this.ast.basslines[patternName];
      patternType = 'bass';
    } else if (this.ast.melodies[patternName]) {
      rawPattern = this.ast.melodies[patternName];
      patternType = 'melody';
    }

    if (!rawPattern) {
      console.warn(`[SongCompiler] Unknown pattern: ${patternName}`);
      return Array(sectionLength).fill('-');
    }

    // Expand pattern with looping
    const steps = [];
    const patternLength = rawPattern.length;

    // For chord-based patterns, we need to track current chord
    let currentChord = null;
    let chordPattern = null;

    // If this is a bass or melody, find the associated chord pattern
    if (patternType === 'bass' || patternType === 'melody') {
      // Look for a chord pattern in the same section
      // We assume chords have the same name or we use the first available
      chordPattern = this.ast.chords[patternName];
      if (!chordPattern) {
        // Try to find any chord pattern
        const chordNames = Object.keys(this.ast.chords);
        if (chordNames.length > 0) {
          chordPattern = this.ast.chords[chordNames[0]];
        }
      }
    }

    for (let i = 0; i < sectionLength; i++) {
      const patternIndex = i % patternLength;
      const item = rawPattern[patternIndex];

      // Update current chord if we have a chord pattern
      if (chordPattern) {
        const chordIndex = i % chordPattern.length;
        const chordItem = chordPattern[chordIndex];
        if (chordItem && chordItem !== '-') {
          currentChord = chordItem;
        }
      }

      // Convert pattern item to step string
      const step = this._convertToStep(item, patternType, role, currentChord, i);
      steps.push(step);
    }

    return steps;
  }

  /**
   * Convert a pattern item to a step string
   * @param {object} item - Pattern item
   * @param {string} type - Pattern type
   * @param {string} role - Voice role (for octave decisions)
   * @param {string} currentChord - Current chord symbol (for bass/melody)
   * @param {number} stepIndex - Current step index
   * @returns {string} Step string like "c4" or "-"
   */
  _convertToStep(item, type, role, currentChord, stepIndex) {
    switch (type) {
      case 'rhythm':
        return this._convertRhythmStep(item, role);

      case 'chords':
        return this._convertChordStep(item, role);

      case 'bass':
        return this._convertBassStep(item, currentChord, role);

      case 'melody':
        return this._convertMelodyStep(item, role);

      default:
        return '-';
    }
  }

  /**
   * Convert rhythm hit to step
   */
  _convertRhythmStep(item, role) {
    if (!item.hit) {
      return '-';
    }

    // For drums, use a fixed note based on role
    const drumNotes = {
      kick: 'c2',
      snare: 'e2',
      hihat: 'g#2',
      hat: 'g#2',
      clap: 'd2',
      tom: 'a2',
      perc: 'f2',
      rim: 'c#2'
    };

    const note = drumNotes[role] || 'c2';

    if (item.velocity < 100) {
      return `${note}@${item.velocity}`;
    }
    return note;
  }

  /**
   * Convert chord symbol to step
   */
  _convertChordStep(item, role) {
    if (item === '-') {
      return '-';
    }

    // Get chord notes
    const octave = this._getOctaveForRole(role, 'chord');
    const semitones = getChordNotes(item, octave);

    if (semitones.length === 0) {
      return '-';
    }

    // Convert to note names and create chord notation
    const notes = semitones.map(s => semitoneToNoteName(s));

    if (notes.length === 1) {
      return notes[0];
    }

    return `[${notes.join(',')}]`;
  }

  /**
   * Convert bass scale degree to step
   */
  _convertBassStep(item, currentChord, role) {
    if (item.rest) {
      return '-';
    }

    if (!currentChord) {
      // No chord context, use key root
      const octave = this._getOctaveForRole(role, 'bass');
      const rootSemitone = this._getRootSemitone(this.ast.key.root);
      return semitoneToNoteName(octave * 12 + rootSemitone);
    }

    // Get chord root and intervals
    const parsed = parseChordSymbol(currentChord);
    if (!parsed) {
      return '-';
    }

    const octave = this._getOctaveForRole(role, 'bass') + (item.octaveShift || 0);
    const chordIntervals = CHORD_INTERVALS[parsed.type] || CHORD_INTERVALS[''];

    // Scale degree 1 = root, 3 = third, 5 = fifth, etc.
    // Map to chord tone index
    const degreeToChordTone = {
      1: 0,  // Root
      2: null,  // Second (not a chord tone, use scale)
      3: 1,  // Third
      4: null,  // Fourth
      5: 2,  // Fifth
      6: null,  // Sixth
      7: chordIntervals.length > 3 ? 3 : null  // Seventh if exists
    };

    const chordToneIndex = degreeToChordTone[item.degree];

    if (chordToneIndex !== null && chordToneIndex < chordIntervals.length) {
      // Use chord tone
      const semitone = octave * 12 + parsed.rootSemitone + chordIntervals[chordToneIndex];
      return semitoneToNoteName(semitone);
    } else {
      // Use scale degree relative to chord root
      const scaleIntervals = SCALE_INTERVALS[this.ast.key.scale] || SCALE_INTERVALS.major;
      const degreeIndex = ((item.degree - 1) % 7);
      const semitone = octave * 12 + parsed.rootSemitone + scaleIntervals[degreeIndex];
      return semitoneToNoteName(semitone);
    }
  }

  /**
   * Convert melody scale degree to step
   */
  _convertMelodyStep(item, role) {
    if (item.rest) {
      return '-';
    }

    const octave = this._getOctaveForRole(role, 'melody') + (item.octaveShift || 0);
    const rootSemitone = this._getRootSemitone(this.ast.key.root);
    const scaleIntervals = SCALE_INTERVALS[this.ast.key.scale] || SCALE_INTERVALS.major;

    // Scale degree 1 = root of key
    const degreeIndex = ((item.degree - 1) % 7);
    const semitone = octave * 12 + rootSemitone + scaleIntervals[degreeIndex];

    return semitoneToNoteName(semitone);
  }

  /**
   * Get appropriate octave for a role
   */
  _getOctaveForRole(role, type) {
    const roleOctaves = {
      kick: 1,
      bass: 2,
      sub: 1,
      lead: 4,
      melody: 4,
      pad: 3,
      chord: 3,
      keys: 3,
      synth: 3,
      arp: 4,
      hihat: 2,
      snare: 2,
      perc: 2
    };

    if (roleOctaves[role] !== undefined) {
      return roleOctaves[role];
    }

    // Default by type
    const typeOctaves = {
      bass: 2,
      chord: 3,
      melody: 4,
      rhythm: 2
    };

    return typeOctaves[type] || 3;
  }

  /**
   * Get semitone offset for a note name
   */
  _getRootSemitone(note) {
    const noteMap = { 'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11 };
    let semitone = noteMap[note[0].toLowerCase()] || 0;
    if (note[1] === '#') semitone++;
    if (note[1] === 'b') semitone--;
    return ((semitone % 12) + 12) % 12;
  }
}

// Export for use in browser
if (typeof window !== 'undefined') {
  window.SongCompiler = SongCompiler;
}
