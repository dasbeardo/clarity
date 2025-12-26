# Changelog - Sequencer Edition

All changes since forking from the original Clarity branch.

---

## Audio Engine Fixes

### Release Time 1000x Too Fast
- **Problem:** Notes were cutting off almost instantly instead of fading out
- **Cause:** Release time was being divided by 1000 twice (once in parsing, once in audio)
- **Fix:** Removed duplicate division, release now works correctly in milliseconds

### Sustain Default Mismatch
- **Problem:** Sustain level wasn't matching what was set in text
- **Cause:** Default was hardcoded to 50 but UI expected 100
- **Fix:** Changed default sustain to 100 for consistency

### Missing Oscillator Decay
- **Problem:** Decay parameter wasn't being applied to oscillators
- **Cause:** Decay was parsed but not wired to the envelope
- **Fix:** Added decay parameter to ADSR envelope generation

### Master Volume Not Applying
- **Problem:** Changing master volume had no effect
- **Cause:** Master gain node wasn't connected in signal chain
- **Fix:** Properly connected master volume to output chain

---

## Sequencer Features (New)

### Multi-Track Step Sequencer
- Tab-based UI: `.instrument` and `.sequence` tabs
- Each oscillator can have its own sequence
- Sequences route to their named oscillator only

### Expression Modifiers
- **Velocity:** `@0-100` controls note loudness
- **Gate:** `:0-100` controls note duration as percentage of step
- **Ties:** `~` extends note into next step without re-attack
- **Swing:** `swing 50-67` offsets every other 16th note

### Chords
- Bracket notation: `[c4,e4,g4]` plays multiple notes simultaneously
- Per-note modifiers: `[c4@80,e4@70,g4@90]`
- Voice leading: `[c4~,e4~,g4]` lets some notes sustain while others change

### Slides / Portamento
- Syntax: `c4>e4` glides from first note to second
- Uses exponential ramp for natural pitch curve
- Auto-sustains (implies tie) for smooth transitions

### Per-Oscillator Distortion
- Define multiple distortion effects with different settings
- Apply to individual oscillators: `distortion crunch`
- Gain compensation prevents volume spikes at high drive

### Track Color Visualizer
- Add `color red` (or hex `#ff3300`) to oscillators
- Colored indicators light up during playback
- Brightness varies with velocity

---

## Parser Fixes

### Multi-Word Attribute Names
- **Problem:** Attributes with spaces weren't being parsed
- **Fix:** Updated regex to handle multi-word attribute names

### Attribute Priority
- **Problem:** Some attributes were being treated as new component declarations
- **Fix:** Parser now checks for component attributes before new component headers

### Tied Notes Getting Stuck
- **Problem:** Notes with ties would never release
- **Cause:** Tie cleanup wasn't happening when notes ended
- **Fix:** Added proper tie state tracking with nested Maps for chords

### Modifiers Stripped on UI Update
- **Problem:** When UI updated text, velocity/gate/tie modifiers were lost
- **Fix:** Preserved modifiers when regenerating sequence text

---

## UI Improvements

### Header Transport Controls
- Play/stop buttons moved to header nav bar
- Accessible from both `.instrument` and `.sequence` tabs
- Visual feedback: play button changes when sequencer is running

### Keyboard Always Visible
- Removed compact keyboard toggle during playback
- Full QWERTY layout always shows
- Virtual keyboard works alongside sequencer

### Track Visualizer Layout
- Fixed overflow issue where indicators covered keyboard
- Indicators now wrap properly and push content down
- Works correctly on both tabs

### Stuck Notes on Focus Loss
- **Problem:** Notes would keep playing when switching apps
- **Fix:** Added window blur listener to stop all keyboard notes

---

## Documentation

### PROMPT-GUIDE.md
- Comprehensive AI prompt guide for generating instruments/sequences
- Covers all syntax: notes, modifiers, chords, slides, voice leading
- Includes tips for kicks, snares, bass, leads, pads, arps
- Example patterns for common use cases

### SEQUENCER-QUICKSTART.md
- One-page quick reference for sequencer features
- Syntax tables and examples
- Tips for expression and groove

---

## Default Content

### "Digital Dreams" Showcase
- 7-track demonstration song loads by default
- Shows: drums, bass with slides, lead with vibrato, pad with voice leading, arp
- 64-step pattern at 108 BPM with swing
- All tracks have unique colors for visualizer

---

## Commits (Chronological)

1. `1156fa0` - Add multi-track step sequencer with tab-based UI
2. `664229b` - Add oscillator routing, stuck notes fix
3. `1e2cafe` - Fix oscillator ADSR envelope bugs
4. `ae2ee5a` - Fix parser to handle multi-word attribute names
5. `8ad8153` - Fix release time being 1000x too fast
6. `c4f5cd7` - Add sequencer expression modifiers and AI prompt guide
7. `29e9509` - Add chords, voice leading, slides, and per-oscillator distortion
8. `ab6fc67` - Move sequencer play/stop controls to header nav bar
9. `e470d75` - Fix track visualizer overflow and add showcase song
10. `a3cabe8` - Set "Digital Dreams" as default instrument and sequence
