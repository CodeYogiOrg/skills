import React from "react";
import {
  AbsoluteFill,
  Audio,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Hind";

// Finalized subtitle font: Hind Bold 700 — clean, equally clear for
// Devanagari and Latin (Hinglish) in one family.
const { fontFamily: hindFontFamily } = loadFont("normal", {
  weights: ["700"],
  subsets: ["devanagari", "latin"],
});

export type SubtitleWord = {
  /** Word text (any leading/trailing whitespace is trimmed). */
  word: string;
  /** Seconds from audio start when the word begins. */
  start: number;
  /** Seconds from audio start when the word ends. */
  end: number;
  /** Fill to the accent color instead of the main color (key terms —
      Harshit, 2026-07-21: e.g. code/coder/coding stressed in Video 3). */
  accent?: boolean;
};

type Props = {
  words: SubtitleWord[];
  /** Path under public/, e.g. "audio/video-1.mp3". Omit if audio mounts elsewhere. */
  audioFile?: string;
  /** Seconds into the audio file where this scene's dialog begins (default 0). */
  audioOffsetSec?: number;
  /** Characters accumulated before the screen clears to a fresh page. */
  maxCharsPerPage?: number;
  fontSize?: number;
  /** Seconds each letter takes to deepen from light to full color — the smoothness knob. */
  charFade?: number;
  /** Sung/filled text color (default: dark blue). */
  color?: string;
  /** Unsung text color — the whole sentence shows in this from the moment it starts. */
  lightColor?: string;
  /** Fill color for words marked `accent: true` (default: warm orange). */
  accentColor?: string;
};

type Sentence = { words: SubtitleWord[]; start: number };
type Page = { sentences: Sentence[]; start: number };

/** Split words into sentences at Devanagari purnaviram / . ? ! boundaries. */
const toSentences = (words: SubtitleWord[]): Sentence[] => {
  const sentences: Sentence[] = [];
  let current: SubtitleWord[] = [];
  for (const w of words) {
    const text = w.word.trim();
    if (text.length === 0) continue;
    current.push(w);
    if (/[।.?!]$/.test(text)) {
      sentences.push({ words: current, start: current[0].start });
      current = [];
    }
  }
  if (current.length > 0) {
    sentences.push({ words: current, start: current[0].start });
  }
  return sentences;
};

/** Group whole sentences into pages, clearing once a page passes maxChars. */
const paginate = (sentences: Sentence[], maxChars: number): Page[] => {
  const pages: Page[] = [];
  let current: Sentence[] = [];
  let chars = 0;
  for (const s of sentences) {
    const len = s.words.reduce((n, w) => n + w.word.trim().length + 1, 0);
    if (current.length > 0 && chars + len > maxChars) {
      pages.push({ sentences: current, start: current[0].start });
      current = [];
      chars = 0;
    }
    current.push(s);
    chars += len;
  }
  if (current.length > 0) {
    pages.push({ sentences: current, start: current[0].start });
  }
  return pages;
};

/** Grapheme-safe split so Devanagari matras never render half-colored. */
type SegmenterLike = new (
  locale?: string,
  opts?: { granularity: string },
) => { segment: (s: string) => Iterable<{ segment: string }> };

const toGraphemes = (text: string): string[] => {
  const Segmenter = (Intl as unknown as { Segmenter?: SegmenterLike })
    .Segmenter;
  if (Segmenter) {
    const seg = new Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(seg.segment(text), (s) => s.segment);
  }
  return Array.from(text);
};

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

const lerpColor = (
  from: [number, number, number],
  to: [number, number, number],
  p: number,
): string =>
  `rgb(${Math.round(from[0] + (to[0] - from[0]) * p)}, ${Math.round(
    from[1] + (to[1] - from[1]) * p,
  )}, ${Math.round(from[2] + (to[2] - from[2]) * p)})`;

const KaraokeWord: React.FC<{
  w: SubtitleWord;
  t: number;
  last: boolean;
  charFade: number;
  lightRgb: [number, number, number];
  mainRgb: [number, number, number];
  accentRgb: [number, number, number];
}> = ({ w, t, last, charFade, lightRgb, mainRgb, accentRgb }) => {
  const text = w.word.trim();
  const graphemes = React.useMemo(() => toGraphemes(text), [text]);
  const span = Math.max(w.end - w.start, 0.05);
  const perChar = span / graphemes.length;
  // Accent (red) applies ONLY to the term itself — trailing punctuation like
  // the purnaviram "।" stays the normal blue (Harshit 2026-07-30).
  const isPunct = (g: string) => /^[।.,?!:;]+$/.test(g);
  return (
    <span>
      {graphemes.map((g, i) => {
        const fillAt = w.start + i * perChar;
        const p = Math.min(Math.max((t - fillAt) / charFade, 0), 1);
        const gTarget = w.accent && !isPunct(g) ? accentRgb : mainRgb;
        return (
          <span key={i} style={{ color: lerpColor(lightRgb, gTarget, p) }}>
            {g}
          </span>
        );
      })}
      {last ? "" : " "}
    </span>
  );
};

/**
 * Karaoke-style full-screen subtitles synced to a voiceover (Harshit's rule,
 * 2026-07-16). Each SENTENCE appears whole and at once in a grey
 * the moment its audio begins; every letter then deepens to the main blue in
 * sync with the spoken word timings. When a page carries a second sentence,
 * it stays hidden until its own audio starts, then pops in whole (grey)
 * below the first and colors in the same way. Layout is fixed up front so
 * text never reflows. Word timings come from whisper word-level timestamps.
 */
export const SubtitleScreen: React.FC<Props> = ({
  words,
  audioFile,
  audioOffsetSec = 0,
  maxCharsPerPage = 140,
  fontSize = 72,
  charFade = 0.18,
  color = "#14306E",
  lightColor = "#8F8F8F",
  accentColor = "#C2410C",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps + audioOffsetSec;

  const pages = React.useMemo(
    () => paginate(toSentences(words), maxCharsPerPage),
    [words, maxCharsPerPage],
  );
  const mainRgb = React.useMemo(() => hexToRgb(color), [color]);
  const lightRgb = React.useMemo(() => hexToRgb(lightColor), [lightColor]);
  const accentRgb = React.useMemo(() => hexToRgb(accentColor), [accentColor]);

  let pageIndex = 0;
  for (let i = pages.length - 1; i >= 0; i--) {
    if (t >= pages[i].start) {
      pageIndex = i;
      break;
    }
  }
  const page = pages[pageIndex];

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      {audioFile ? (
        <Audio
          src={staticFile(audioFile)}
          startFrom={Math.round(audioOffsetSec * fps)}
        />
      ) : null}
      {page ? (
        <div
          style={{
            maxWidth: 920,
            padding: "0 60px",
            fontSize,
            fontWeight: 700,
            lineHeight: 1.5,
            textAlign: "center",
            fontFamily: hindFontFamily,
            letterSpacing: "-0.3px",
          }}
        >
          {page.sentences.map((s, si) => {
            // First sentence shows with the page; later ones pop in whole
            // right as their own audio begins (soft 0.15s fade, no reflow —
            // space is reserved via visibility, not display).
            const appearAt = si === 0 ? page.start : s.start - 0.1;
            const appear = Math.min(Math.max((t - appearAt) / 0.15, 0), 1);
            return (
              <div
                key={si}
                style={{
                  opacity: appear,
                  visibility: appear > 0 ? "visible" : "hidden",
                  marginTop: si > 0 ? 36 : 0,
                }}
              >
                {s.words.map((w, wi) => (
                  <KaraokeWord
                    key={wi}
                    w={w}
                    t={t}
                    last={wi === s.words.length - 1}
                    charFade={charFade}
                    lightRgb={lightRgb}
                    mainRgb={mainRgb}
                    accentRgb={accentRgb}
                  />
                ))}
              </div>
            );
          })}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
