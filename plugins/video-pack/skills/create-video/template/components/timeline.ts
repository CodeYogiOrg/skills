/**
 * Derived timing — absolute frames come FROM the SCENES array, never from
 * hand arithmetic. In v27 every boundary ("S3 starts at 126+110=236 · S5
 * starts at 1191") was hand-computed and re-hunted on every duration change;
 * with this, audio mounts, whoosh boundaries and speech windows are written
 * as `T.startOf(i) + offset` and follow duration edits automatically.
 *
 * Usage in Video.tsx:
 *   const T = buildTimeline(SCENES);
 *   export const TOTAL_DURATION = T.total;
 *   const AUDIO = [
 *     { file: "audio/section-1.mp3", from: T.startOf(0) },
 *     // address bridge: section-3 mounts 27f before the S3 scene
 *     { file: "audio/section-3.mp3", from: T.startOf(2) - 27, endAt: S3_CUT },
 *   ];
 *   const WHOOSH_BOUNDARIES = [T.startOf(1), T.startOf(5), T.startOf(6)];
 *   const SPEECH_WINDOWS: Array<[number, number]> = [
 *     [T.startOf(0), T.startOf(0) + sec(3.67)],
 *   ];
 */

export type TimedScene = { duration: number };

export const buildTimeline = <T extends TimedScene>(scenes: readonly T[]) => {
  const starts: number[] = [];
  let acc = 0;
  for (const s of scenes) {
    starts.push(acc);
    acc += s.duration;
  }
  return {
    /** Absolute start frame of each scene, by index. */
    starts,
    /** Total composition duration in frames. */
    total: acc,
    startOf: (i: number): number => {
      if (i < 0 || i >= starts.length) {
        throw new Error(`startOf(${i}): no scene at that index (${starts.length} scenes)`);
      }
      return starts[i];
    },
    endOf: (i: number): number => {
      if (i < 0 || i >= starts.length) {
        throw new Error(`endOf(${i}): no scene at that index (${starts.length} scenes)`);
      }
      return starts[i] + scenes[i].duration;
    },
  };
};

/** Seconds → frames at the project fps (default 30). */
export const sec = (s: number, fps = 30): number => Math.round(s * fps);
