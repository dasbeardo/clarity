# Clarity Synthesizer - Sequencer Edition

A text-based polyphonic synthesizer with multi-track step sequencer for the browser. Define your instrument and sequences by editing structured text that dynamically generates the user interface.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Interface Overview](#interface-overview)
3. [Instrument Tab (.instrument)](#instrument-tab-instrument)
   - [Oscillators](#oscillators)
   - [LFOs](#lfos-low-frequency-oscillators)
   - [Envelopes](#envelopes)
   - [Filter](#filter)
   - [Compressor](#compressor)
   - [Master Settings](#master-settings)
   - [Global Settings](#global-settings)
   - [Variables](#variables)
   - [Note-Specific Configuration](#note-specific-configuration)
   - [Key Definitions](#key-definitions)
4. [Sequencer Tab (.sequence)](#sequencer-tab-sequence)
   - [Sequencer Syntax](#sequencer-syntax)
   - [Multi-Track Sequencing](#multi-track-sequencing)
   - [Note Format](#note-format)
   - [Sequencer Controls](#sequencer-controls)
5. [Playing Notes](#playing-notes)
   - [Virtual Keyboard](#virtual-keyboard)
   - [MIDI Support](#midi-support)
6. [Command Palette](#command-palette)
7. [Keyboard Shortcuts](#keyboard-shortcuts)
8. [Example Configurations](#example-configurations)
9. [Technical Reference](#technical-reference)
10. [Tips & Best Practices](#tips--best-practices)
11. [Troubleshooting](#troubleshooting)

---

## Quick Start

1. Open `index.html` in a modern web browser (Chrome/Edge recommended)
2. Click the `.instrument` tab to define your sounds
3. Click the `.sequence` tab to create patterns
4. Click **Play** to hear your sequence
5. Or click the virtual keyboard and use your computer keyboard to play live

---

## Interface Overview

Clarity has a two-pane layout:

| Pane | Purpose |
|------|---------|
| **Left** | Text editor with two tabs: `.instrument` (synth definition) and `.sequence` (step sequencer) |
| **Right** | Dynamic UI controls generated from your text, plus transport controls for sequencer |

The text in the left pane IS your instrument. Every change updates the UI and audio engine in real-time.

---

## Instrument Tab (.instrument)

The instrument tab defines your synthesizer's sound. Use indented text format: non-indented lines define sections, indented lines (2 spaces) define parameters.

### Oscillators

Oscillators generate the raw sound. You can have multiple oscillators layered together.

```
oscillator main
  wave sine
  octave 0
  detune 0
  volume 50
  attack 100
  sustain 80
  release 500
```

#### Oscillator Parameters

| Parameter | Range | Description |
|-----------|-------|-------------|
| `wave` | sine, square, sawtooth, triangle, noise | Waveform type |
| `octave` | -2 to 2 | Octave offset from base pitch |
| `detune` | -100 to 100 | Fine tuning in cents (100 cents = 1 semitone) |
| `volume` | 0 to 100 | Oscillator volume level |
| `attack` | 0 to 5000 | Attack time in milliseconds |
| `sustain` | 0 to 100 | Sustain level (percentage of peak) |
| `release` | 0 to 5000 | Release time in milliseconds |
| `pitch` | (lfo name) | Apply an LFO for pitch modulation/vibrato |

#### Wave Types

- **sine** - Pure, smooth tone (good for bass, sub, pads)
- **square** - Hollow, buzzy tone (classic chiptune/8-bit sound)
- **sawtooth** - Bright, rich harmonics (leads, brass, strings)
- **triangle** - Soft, mellow (between sine and square)
- **noise** - White noise (percussion, effects, texture)

### LFOs (Low Frequency Oscillators)

LFOs create repeating modulation patterns. Connect them to oscillators for vibrato, tremolo, and other effects.

```
lfo vibrato
  wave sine
  rate 5
  depth 20
```

#### LFO Parameters

| Parameter | Range | Description |
|-----------|-------|-------------|
| `wave` | sine, square, sawtooth, triangle | LFO waveform shape |
| `rate` | 0.1 to 20 | Speed in Hz (cycles per second) |
| `depth` | 0 to 100 | Modulation intensity in cents |

#### Connecting LFO to Oscillator

```
lfo vibrato
  wave sine
  rate 5
  depth 15

oscillator lead
  wave square
  pitch vibrato
```

The `pitch vibrato` line connects the LFO named "vibrato" to this oscillator's pitch.

### Envelopes

Named envelopes for filter modulation. Create dynamic filter sweeps that trigger on each note.

```
envelope sweep
  attack 50
  decay 200
  sustain 50
  release 300
```

#### Envelope Parameters

| Parameter | Range | Description |
|-----------|-------|-------------|
| `attack` | 0 to 5000 | Time to reach peak (ms) |
| `decay` | 0 to 5000 | Time to fall to sustain level (ms) |
| `sustain` | 0 to 100 | Level to hold while note is pressed |
| `release` | 0 to 5000 | Time to fade to zero after release (ms) |

#### Apply Envelope to Filter

```
filter
  frequency 5000
  frequency envelope sweep
```

### Filter

Low-pass filter to shape the sound's brightness.

```
filter
  frequency 2000
  resonance 5
```

#### Filter Parameters

| Parameter | Range | Description |
|-----------|-------|-------------|
| `frequency` | 20 to 20000 | Cutoff frequency in Hz |
| `resonance` | 0.0001 to 20 | Resonance/Q factor (1 = flat, higher = more peak) |
| `frequency envelope` | (envelope name) | Modulate frequency with an envelope |
| `resonance envelope` | (envelope name) | Modulate resonance with an envelope |

### Compressor

Dynamics compressor to control volume peaks and add punch.

```
compressor
  threshold -20
  ratio 12
  knee 30
  attack 0.003
  release 0.25
```

#### Compressor Parameters

| Parameter | Range | Description |
|-----------|-------|-------------|
| `threshold` | -100 to 0 | Level (dB) where compression starts |
| `ratio` | 1 to 20 | Compression ratio (12:1 = heavy compression) |
| `knee` | 0 to 40 | Soft knee width in dB |
| `attack` | 0 to 1 | Attack time in seconds |
| `release` | 0 to 1 | Release time in seconds |

### Master Settings

Global volume and envelope for all notes.

```
master
  volume 80
  attack 10
  decay 100
  sustain 80
  release 300
```

### Global Settings

Global tuning and chord mode.

```
global
  chord major
  detune 0
```

#### Global Parameters

| Parameter | Values | Description |
|-----------|--------|-------------|
| `chord` | none, major, minor, sus2, sus4, maj7, min7, dom7, dim, aug | Play chords with single keys |
| `detune` | -100 to 100 | Global tuning offset in cents |

### Variables

Create reusable values to keep your instrument DRY (Don't Repeat Yourself).

```
variable myAttack 150
variable myRelease 800

oscillator one
  attack myAttack
  release myRelease

oscillator two
  attack myAttack
  release myRelease
```

### Note-Specific Configuration

Apply settings to specific notes:

```
note c4
  pitch vibrato

note c d e
  chord major
```

### Key Definitions

Define modifier keys that apply effects when held:

```
lfo vibrato
  wave sine
  rate 6
  depth 25

key f
  pitch vibrato
```

Now hold F while playing other keys to add vibrato in real-time. Keys with definitions:
- Don't play notes themselves
- Act as real-time modulation controls
- Shown with orange highlight on virtual keyboard

---

## Sequencer Tab (.sequence)

The sequencer lets you program multi-track step patterns that play automatically.

### Sequencer Syntax

```
bpm 140

oscillator lead
sequence e5 e5 - e5 - c5 e5 - g5 - - - g4 - - -

oscillator bass
sequence c3 - - c3 - - g2 - c3 - - - g2 - - -
```

### Multi-Track Sequencing

Each track consists of:
1. `oscillator <name>` - Which oscillator from the .instrument tab to use
2. `sequence <notes>` - Space-separated notes and rests

Tracks play simultaneously. Each track routes ONLY to its named oscillator.

**Example with 4 tracks:**

```
bpm 150

oscillator bass
sequence e2 e2 e3 e2 e2 e3 e2 e3

oscillator lead
sequence - - - - e4 - g4 - b4 - - - e5 - d5 -

oscillator harmony
sequence b3 - - - - - - - a3 - - - - - - -

oscillator drums
sequence c4 - c4 - c4 c4 c4 - c4 - c4 - c4 c4 c4 -
```

### Note Format

| Format | Example | Description |
|--------|---------|-------------|
| Letter + Octave | `c4`, `g3`, `a5` | Natural note |
| With Sharp | `c#4`, `f#3` | Sharp note |
| With Flat | `bb4`, `eb5` | Flat note |
| Rest | `-` | Silence (no note) |

**Octave Reference:**
- `c2` - Very low bass
- `c3` - Low bass
- `c4` - Middle C
- `c5` - High
- `c6` - Very high

### Sequencer Controls

The right pane shows sequencer controls when the .sequence tab is active:

| Control | Function |
|---------|----------|
| **BPM Slider** | Tempo (40-240 BPM) - updates in real-time while playing |
| **Play/Pause** | Start or pause playback |
| **Stop** | Stop and reset to beginning |
| **Step Indicators** | Visual display of each track's steps, highlights current position |

Each step = 1/16th note at the current BPM.

---

## Playing Notes

### Virtual Keyboard

Click the virtual keyboard panel in the right pane to focus it, then use your computer keyboard:

| Row | Keys | Notes |
|-----|------|-------|
| Bottom | Z X C V B N M , . / | C3 to A3 (chromatic) |
| Home | A S D F G H J K L ; | A#3 to G4 (chromatic) |
| Top | Q W E R T Y U I O P | G#4 to E5 (chromatic) |
| Number | 1 2 3 4 5 6 7 8 9 0 | F#5 to D#6 (chromatic) |

Keys with definitions (key f, etc.) show with orange highlight and don't play notes - they apply modulation.

### MIDI Support

Connect a MIDI controller and it works automatically. Velocity is supported.

---

## Command Palette

Press `/` in the text editor to open the command palette for quick actions:

| Command | Description |
|---------|-------------|
| New Oscillator | Create oscillator with default settings |
| New LFO | Create LFO with default settings |
| New Named Envelope | Create envelope for filter modulation |
| New Key | Create key definition for modulation |
| New Note | Create note-specific configuration |
| New Variable | Create reusable variable |
| New Master | Create master volume section |
| New Envelope | Create global envelope section |
| New Filter | Create low-pass filter section |
| New Compressor | Create compressor section |
| New Global | Create global settings section |
| Increase/Decrease Text Size | Adjust editor font size |
| Increase/Decrease Line Spacing | Adjust line spacing |

---

## Keyboard Shortcuts

### Editor Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Open command palette |
| `Cmd/Ctrl + Up/Down` | Increment/decrement numeric values |
| `Shift + Cmd/Ctrl + Up/Down` | Increment/decrement by 10 |
| `Cmd/Ctrl + =` | Increase text size |
| `Cmd/Ctrl + -` | Decrease text size |
| `Cmd/Ctrl + ]` | Increase line spacing |
| `Cmd/Ctrl + [` | Decrease line spacing |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Focus virtual keyboard |

---

## Example Configurations

### Simple Sine Wave

**.instrument:**
```
oscillator main
  wave sine
  volume 50
```

### NES-Style Chiptune

**.instrument:**
```
oscillator bass
  wave sawtooth
  octave -1
  volume 70
  attack 5
  sustain 85
  release 80

oscillator lead
  wave square
  octave 0
  volume 55
  attack 8
  sustain 75
  release 180
  pitch vibrato

oscillator harmony
  wave triangle
  octave 0
  volume 30
  attack 25
  sustain 90
  release 200

oscillator drums
  wave noise
  octave 0
  volume 35
  attack 1
  sustain 5
  release 40

lfo vibrato
  wave sine
  rate 5
  depth 12

master
  volume 75
  attack 5
  decay 80
  sustain 85
  release 250
```

**.sequence:**
```
bpm 150

oscillator bass
sequence e2 e2 e3 e2 e2 e3 e2 e3 e2 e2 e3 e2 e2 e3 e2 e3

oscillator lead
sequence - - - - e4 - g4 - b4 - - - e5 - d5 -

oscillator harmony
sequence b3 - - - - - - - a3 - - - - - - -

oscillator drums
sequence c4 - c4 - c4 c4 c4 - c4 - c4 - c4 c4 c4 -
```

### Detuned Pad

**.instrument:**
```
oscillator pad1
  wave sawtooth
  detune -10
  volume 40
  attack 800
  release 1200

oscillator pad2
  wave sawtooth
  detune 10
  volume 40
  attack 800
  release 1200

oscillator sub
  wave sine
  octave -1
  volume 30
```

### Dynamic Vibrato Control

**.instrument:**
```
lfo vibrato
  rate 6
  depth 25
  wave sine

key f
  pitch vibrato

oscillator main
  wave sine
  volume 50
```

Hold F while playing other keys to add vibrato in real-time.

---

## Technical Reference

### Architecture

Clarity uses a schema-driven architecture:

| File | Purpose |
|------|---------|
| `schemas.js` | Defines component types and their attributes |
| `parser.js` | Parses text into instance store based on schemas |
| `instance-store.js` | Holds all parsed components/variables |
| `audio-engine.js` | Creates Web Audio nodes from instance store |
| `ui-generator.js` | Builds UI controls from schemas |
| `sequencer.js` | Multi-track step sequencer engine |
| `script.js` | Main file - wires everything together |

### Audio Signal Chain

```
Oscillators (per note)
    ↓
Per-Oscillator Envelope Gain (ADSR)
    ↓
Master Envelope Gain (global ADSR)
    ↓
Master Gain (volume)
    ↓
Filter (BiquadFilter)
    ↓
Compressor (DynamicsCompressor)
    ↓
Analyser (for visualizations)
    ↓
Audio Output
```

### Sequencer Engine

- Step resolution: 16th notes
- Timing: `(60 / BPM) * 1000 / 4` ms per step
- Each track maintains independent step array
- Oscillator routing via `oscillatorFilter` parameter
- Real-time BPM changes restart interval with new timing

### Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome/Edge | Full support (recommended) |
| Firefox | Full support |
| Safari | Full support |
| Mobile | Limited (no MIDI, touch keyboard needed) |

---

## Tips & Best Practices

### Sound Design

1. **Start Simple** - Begin with one oscillator, add complexity gradually
2. **Layer Oscillators** - Combine different waves at different octaves for rich sounds
3. **Detune for Width** - Small detune values (±5-15) create stereo width
4. **Use Variables** - Define common values once, reuse everywhere
5. **Noise for Texture** - Low-volume noise adds presence to pads

### Sequencing

1. **Match Oscillator Names** - Sequencer track names must exactly match .instrument oscillator names
2. **Use Rests Creatively** - `-` creates rhythm and space
3. **Align Track Lengths** - Keep all tracks the same number of steps to avoid drift
4. **Bass + Lead + Drums** - Classic combo that works well
5. **Start with BPM** - Always define BPM first in your sequence

### Performance

1. **Focus Keyboard** - Click the keyboard panel before playing with keys
2. **Key Modifiers** - Set up LFO keys (like F for vibrato) for expressive playing
3. **MIDI Velocity** - Use a MIDI controller for velocity-sensitive playing

---

## Troubleshooting

### No Sound

1. Click somewhere in the browser first (browsers require user interaction for audio)
2. Check that oscillator `volume` is above 0
3. Check that `master volume` is above 0
4. Make sure virtual keyboard is focused (click on it)

### Sequencer Track Not Playing

1. Verify oscillator name in .sequence matches exactly with .instrument
2. Check that the oscillator has `volume` > 0
3. Make sure sequence has actual notes, not just rests

### Stuck Notes

Fixed in this version. If notes get stuck:
1. Click away from the keyboard - blur handler stops all notes
2. Switch tabs - visibility handler stops all notes
3. Refresh the page as last resort

### Copy/Paste Issues

The text editor uses contentEditable which can have formatting quirks. If pasting causes issues:
1. Paste as plain text (Cmd/Ctrl + Shift + V)
2. Or type the text manually

---

## Version History

### Sequencer Edition (Current)

- Multi-track step sequencer with dedicated tab
- Per-track oscillator routing
- Real-time BPM control
- Visual step indicators
- Fixed stuck notes on focus loss

### Original Release

- Text-based instrument definition
- Polyphonic playback
- LFO modulation
- Filter with envelope modulation
- MIDI support
- Command palette

---

## Credits

Built with the Web Audio API. No external dependencies.

---

## License

MIT License - See LICENSE file for details.
