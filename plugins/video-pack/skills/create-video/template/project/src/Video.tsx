import React from "react";
import { AbsoluteFill, Audio, Sequence, Series, staticFile } from "remotion";
import { PaperBackground } from "./components/PaperBackground";
import { Sfx } from "./components/Sfx";
import { buildTimeline } from "./components/timeline";
// import { Scene01 } from "./scenes/scene-01-...";

export const FPS = 30;

// One entry per dialog line. Line durations come from the section audio
// transcripts (scripts/transcribe.mjs) — never guessed. Comment each entry
// with the line/audio span it covers.
const SCENES: {
  Comp: React.FC<{ durationInFrames: number }>;
  duration: number;
}[] = [
  // { Comp: Scene01, duration: 150 }, // S1 L1 (0–4.5s of section-1.mp3)
];

// Absolute frames are DERIVED — write mounts/boundaries as T.startOf(i)+offset
// so a duration edit never means re-hunting hand-computed numbers.
const T = buildTimeline(SCENES);
export const TOTAL_DURATION = Math.max(T.total, 1);

// Section audio at absolute frames — files never edited, mounts may split
// around inserted silence (endAt + second mount with startFrom). Character
// sections are NOT mounted: their clips carry their own audio.
const AUDIO: {
  file: string;
  from: number;
  startFrom?: number;
  endAt?: number;
}[] = [
  // { file: "audio/section-1.mp3", from: T.startOf(0) },
];

// Boundary whooshes ONLY where the incoming scene has no entrance sound of
// its own, e.g. [T.startOf(1), T.startOf(5)].
const WHOOSH_BOUNDARIES: number[] = [];

// Music ducking: absolute frame windows where someone is speaking —
// transcript speech spans + character clip speech (trimmed spans, not full
// scenes). Inserted-silence gaps and tail holds stay FULL.
const SPEECH_WINDOWS: Array<[number, number]> = [
  // [T.startOf(0), T.startOf(0) + sec(3.67)],
];
const MUSIC_FULL = 0.9;
const MUSIC_DUCKED = 0.35;
const DUCK_RAMP = 12; // frames to glide between levels

const musicVolume = (frame: number): number => {
  let v = MUSIC_FULL;
  for (const [start, end] of SPEECH_WINDOWS) {
    if (frame < start - DUCK_RAMP || frame > end + DUCK_RAMP) continue;
    const rampIn = Math.min(Math.max((frame - (start - DUCK_RAMP)) / DUCK_RAMP, 0), 1);
    const rampOut = Math.min(Math.max((end + DUCK_RAMP - frame) / DUCK_RAMP, 0), 1);
    const duck = Math.min(rampIn, rampOut);
    v = Math.min(v, MUSIC_FULL - (MUSIC_FULL - MUSIC_DUCKED) * duck);
  }
  return v;
};

// Set true after scripts/prep-music.mjs writes public/audio/music-bed.wav —
// a missing file would break the studio.
const HAS_MUSIC = false;

export const Video: React.FC = () => (
  <AbsoluteFill>
    <PaperBackground />
    <Series>
      {SCENES.map(({ Comp, duration }, i) => (
        <Series.Sequence key={i} durationInFrames={duration}>
          <Comp durationInFrames={duration} />
        </Series.Sequence>
      ))}
    </Series>
    {WHOOSH_BOUNDARIES.map((b) => (
      <Sfx key={b} name="whoosh" at={b - 4} volume={0.8} />
    ))}
    {HAS_MUSIC ? (
      <Audio src={staticFile("audio/music-bed.wav")} volume={musicVolume} />
    ) : null}
    {AUDIO.map(({ file, from, startFrom, endAt }) => (
      <Sequence key={`${file}-${from}`} from={from}>
        <Audio src={staticFile(file)} startFrom={startFrom} endAt={endAt} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
