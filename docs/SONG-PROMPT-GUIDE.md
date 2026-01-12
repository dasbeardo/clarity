# Clarity Song Format - LLM Prompt Guide

You are generating music for Clarity, a text-based synthesizer. This guide explains the `.song` format, which is a high-level composition language that compiles to sequence data.

## Format Overview

The `.song` format lets you compose using:
- **Rhythm patterns** (x = hit, - = rest)
- **Chord symbols** (Am, Cmaj7, G7, etc.)
- **Scale degrees** (1, 3, 5 for bass/melody)
- **Sections** that combine patterns
- **Structure** that arranges sections

## Complete Example

```
song Midnight City
key E minor
bpm 108
swing 55

# Voice mappings (connect to oscillators in .instrument)
voice kick = kick
voice snare = snare
voice hat = hat
voice bass = bass
voice pad = pad
voice lead = lead

# Rhythm patterns (16 steps = 1 bar)
rhythm kick4
  x - - - x - - - x - - - x - - -

rhythm kick8
  x - x - x - x - x - x - x - x -

rhythm backbeat
  - - - - x - - - - - - - x - - -

rhythm hats
  x . x . x . x . x . x . x . x .

rhythm hats-open
  x . x - x . x x x . x - x . x -

# Chord progressions
chords verse
  Em - - - | Am - - - | C - - - | B7 - - -

chords chorus
  C - - - | G - - - | Am - - - | Em - - -

# Bass patterns (scale degrees relative to current chord)
bass verse
  1 - - 1 | - - 5 - | 1 - 3 - | 5 - 1 -

bass chorus
  1 - 5 - | 1 - 3 5 | 1 - - 1 | - - 5 -

# Melody patterns (scale degrees relative to key)
melody hook
  5 - - - | 6 - 7 - | 1^ - - - | - - - -

melody verse-mel
  3 - 2 - | 1 - - - | - - - - | - - - -

# Sections combine patterns
section intro
  kick: kick4
  hat: hats
  pad: verse

section verse
  kick: kick4
  snare: backbeat
  hat: hats
  bass: verse
  pad: verse

section chorus
  kick: kick8
  snare: backbeat
  hat: hats-open
  bass: chorus
  pad: chorus
  lead: hook

# Song structure
structure
  intro verse verse chorus verse chorus chorus
```

## Syntax Reference

### Header
```
song <name>
key <root> <scale>    # root: c, c#, db, d... | scale: major, minor, dorian, etc.
bpm <number>          # tempo (40-240)
swing <number>        # 50=straight, 67=triplet feel
```

### Voice Mapping
```
voice <role> = <oscillator-name>
```
Maps abstract roles (kick, bass, lead) to oscillator names defined in `.instrument`.

### Rhythm Patterns
```
rhythm <name>
  x - - - x - - - x - - - x - - -
```
- `x` = hit (velocity 100)
- `.` = ghost note (velocity 40)
- `-` = rest
- Each character = one 16th note
- 16 characters = 1 bar

### Chord Progressions
```
chords <name>
  Am - - - | Dm - - - | G - - - | C - - -
```
- Standard chord symbols: C, Cm, Cmaj7, Cm7, C7, Cdim, Caug, Csus2, Csus4
- `-` = sustain previous chord
- `|` = optional bar marker (ignored by parser)
- Chords are auto-voiced (no need to specify notes)

### Bass Patterns
```
bass <name>
  1 - - 1 | - - 5 - | 1 - 3 - | 5 - 1 -
```
Scale degrees relative to **current chord**:
- `1` = root
- `3` = third
- `5` = fifth
- `7` = seventh
- `1^` = root up an octave
- `5_` = fifth down an octave

### Melody Patterns
```
melody <name>
  1 - 3 - | 5 - 3 - | 1 - - - | - - - -
```
Scale degrees relative to **key** (not chord):
- Same degree notation as bass
- In E minor: 1=E, 2=F#, 3=G, 4=A, 5=B, 6=C, 7=D

### Sections
```
section <name>
  kick: <pattern-name>
  snare: <pattern-name>
  bass: <pattern-name>
  pad: <pattern-name>
```
- Map roles to patterns
- Patterns loop if shorter than section
- Section length = longest pattern

### Structure
```
structure
  intro verse verse chorus verse chorus outro
```
- List of section names
- Plays in order
- Sections can repeat

## Genre Templates

### Four-on-the-Floor (House/Techno)
```
rhythm kick4
  x - - - x - - - x - - - x - - -

rhythm offbeat
  - - x - - - x - - - x - - - x -
```

### Breakbeat
```
rhythm break
  x - - - x - x - - - x - - x - -
```

### Half-time
```
rhythm halftime
  x - - - - - - - x - - - - - - -
```

### Trap Hi-hats
```
rhythm trap
  x x x x x x x x x x x x x x x x
```

## Common Chord Progressions

### Pop (I-V-vi-IV)
```
chords pop
  C - - - | G - - - | Am - - - | F - - -
```

### Jazz ii-V-I
```
chords jazz
  Dm7 - - - | G7 - - - | Cmaj7 - - - | Cmaj7 - - -
```

### Minor i-iv-VII-III
```
chords minor
  Am - - - | Dm - - - | G - - - | C - - -
```

### 12-Bar Blues
```
chords blues
  E7 - - - | E7 - - - | E7 - - - | E7 - - - | A7 - - - | A7 - - - | E7 - - - | E7 - - - | B7 - - - | A7 - - - | E7 - - - | B7 - - -
```

## Tips for Good Output

1. **Match voices to .instrument oscillators** - Check what oscillators exist
2. **Keep patterns 16 or 32 steps** - Clean bar boundaries
3. **Use ghost notes** - `.` adds groove and humanization
4. **Vary sections** - Different patterns for verse vs chorus
5. **Bass follows chords** - Use scale degrees 1, 3, 5
6. **Leave space** - Not every step needs a note

## Scales Reference

| Scale | Intervals | Feel |
|-------|-----------|------|
| major | 1 2 3 4 5 6 7 | Happy, bright |
| minor | 1 2 b3 4 5 b6 b7 | Sad, dark |
| dorian | 1 2 b3 4 5 6 b7 | Minor but brighter |
| mixolydian | 1 2 3 4 5 6 b7 | Bluesy major |
| phrygian | 1 b2 b3 4 5 b6 b7 | Spanish, exotic |

## Output Format

When generating a song, output ONLY the song content - no markdown code blocks, no explanations before or after. The text should start with `song` and be ready to paste directly into Clarity's .song tab.
