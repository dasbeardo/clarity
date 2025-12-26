# Clarity Sequencer - Quick Start

A step sequencer built into Clarity. Write patterns in text, hear them play.

---

## The Basics

Switch to the `.sequence` tab in the left pane. Write your pattern like this:

```
bpm 120

oscillator lead
  sequence c4 e4 g4 c5 - - - -
```

Hit the **play button** (▶) in the header. Done.

---

## Note Syntax

| What | How | Example |
|------|-----|---------|
| Note | letter + octave | `c4`, `f#3`, `eb5` |
| Rest | dash | `-` |
| Velocity | `@0-100` | `c4@80` (80% loud) |
| Gate | `:0-100` | `c4:50` (50% duration) |
| Tie | `~` | `c4~` (hold into next step) |
| Chord | brackets | `[c4,e4,g4]` |
| Slide | `>` | `c4>e4` (glide pitch) |

**Combine them:** `c4@80:50~` = C4 at 80% velocity, 50% gate, tied

---

## Multi-Track

Each oscillator from your `.instrument` tab can have its own sequence:

```
bpm 100

oscillator kick
  sequence c2 - - - c2 - - - c2 - - - c2 - - -

oscillator bass
  sequence c2>e2 e2 - - g2>c3 c3 - - a2 - - - g2 - - -

oscillator lead
  sequence - - - - - - - - c4@90 - e4@80 - g4@70 - - -
```

---

## Chords & Voice Leading

Play multiple notes at once:
```
[c4,e4,g4]          # C major chord
[c4~,e4~,g4] [c4~,e4~,a4]   # C and E sustain, G changes to A
```

The `~` on individual notes lets some voices hold while others change.

---

## Slides / Portamento

Glide smoothly between pitches:
```
c4>e4    # Slide from C4 to E4
e2>g2 g2 g2>c3   # Bass line with slides
```

Slides automatically sustain - no need to add `~`.

---

## Swing

Add groove by offsetting every other 16th note:
```
bpm 110
swing 58    # 50=straight, 67=triplet feel
```

---

## Track Colors

In your `.instrument` tab, add colors to oscillators:
```
oscillator kick
  wave sine
  color red

oscillator bass
  color orange
```

During playback, colored indicators light up when each track plays.

---

## Tips

- **Ghost notes:** Use low velocity like `c4@30` for subtle hits
- **Staccato:** Use short gate like `c4:25` for punchy notes
- **Long notes:** Chain ties: `c4~ c4~ c4~ c4` holds for 4 steps
- **Build-ups:** Increase velocity: `c4@50 c4@60 c4@70 c4@80 c4@90 c4@100`

---

## Controls

- **Play/Pause:** ▶ button in header (works from any tab)
- **Stop:** ■ button resets to step 1
- **BPM slider:** Adjust tempo in real-time while playing

---

That's it. Write text, hit play, make music.
