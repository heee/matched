// Builds material-specific match cues from real CC0 field recordings.
// Source and license details live in assets/audio/SOURCES.md. There are no
// synthesized resonances, noise layers, pitch effects, or artificial reverb.

const fs = require("fs");
const path = require("path");

const RATE = 44100;
const CHANNELS = 2;
const DURATION = 0.33;
const frames = Math.round(RATE * DURATION);
const sourceDir = path.join(__dirname, "..", "assets", "audio", "source");
const outputDir = path.join(__dirname, "..", "assets", "audio");

function readPcm(filename) {
  const wav = fs.readFileSync(filename);
  if (wav.toString("ascii", 0, 4) !== "RIFF" || wav.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error(`${filename} is not a WAV file`);
  }
  if (wav.readUInt16LE(20) !== 1 || wav.readUInt16LE(22) !== CHANNELS || wav.readUInt16LE(34) !== 16) {
    throw new Error(`${filename} must be stereo 16-bit PCM`);
  }
  const samples = new Float32Array((wav.length - 44) / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = wav.readInt16LE(44 + i * 2) / 32768;
  return { samples, sampleRate: wav.readUInt32LE(24) };
}

function addRecordedClack(mix, hit) {
  const { samples: source, sampleRate: sourceRate } = readPcm(path.join(sourceDir, hit.file));
  const startFrame = Math.round(hit.start * RATE);
  const sourceFrames = source.length / CHANNELS;
  const outputFrames = Math.floor(sourceFrames * RATE / sourceRate);
  const fadeFrames = Math.round(0.045 * RATE);
  const leftGain = hit.gain * Math.sqrt((1 - hit.pan) / 2);
  const rightGain = hit.gain * Math.sqrt((1 + hit.pan) / 2);

  let dcLeft = 0;
  let dcRight = 0;
  for (let i = 0; i < sourceFrames; i++) {
    dcLeft += source[i * 2];
    dcRight += source[i * 2 + 1];
  }
  dcLeft /= sourceFrames;
  dcRight /= sourceFrames;

  for (let i = 0; i < outputFrames && startFrame + i < frames; i++) {
    const position = i * sourceRate / RATE;
    const index = Math.floor(position);
    const fraction = position - index;
    const next = Math.min(sourceFrames - 1, index + 1);
    const channelA = hit.swap ? 1 : 0;
    const channelB = hit.swap ? 0 : 1;
    const left = source[index * 2 + channelA] * (1 - fraction) + source[next * 2 + channelA] * fraction;
    const right = source[index * 2 + channelB] * (1 - fraction) + source[next * 2 + channelB] * fraction;
    const fade = i >= outputFrames - fadeFrames ? (outputFrames - i - 1) / fadeFrames : 1;
    mix[(startFrame + i) * 2] += (left - dcLeft) * leftGain * fade;
    mix[(startFrame + i) * 2 + 1] += (right - dcRight) * rightGain * fade;
  }
}

function writeCue(filename, hits, targetPeak = 0.86) {
  const mix = new Float32Array(frames * CHANNELS);
  for (const hit of hits) addRecordedClack(mix, hit);

  let peak = 0;
  for (const sample of mix) peak = Math.max(peak, Math.abs(sample));
  const scale = peak ? targetPeak / peak : 1;
  const dataBytes = frames * CHANNELS * 2;
  const wav = Buffer.alloc(44 + dataBytes);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataBytes, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(CHANNELS, 22);
  wav.writeUInt32LE(RATE, 24);
  wav.writeUInt32LE(RATE * CHANNELS * 2, 28);
  wav.writeUInt16LE(CHANNELS * 2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < mix.length; i++) {
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[i] * scale)) * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(outputDir, filename), wav);
  console.log(`Generated assets/audio/${filename} from recorded material impacts`);
}

const pair = (first, second = first) => [
  { file: first, start: 0.006, gain: 0.96, pan: -0.08, swap: false },
  { file: second, start: 0.073, gain: 0.80, pan: 0.07, swap: first === second },
];

writeCue("tile-match.wav", pair("wooden-piece-click-a.wav", "wooden-piece-click-b.wav"), 0.88);
writeCue("tile-match-stone.wav", pair("stone-click.wav"));
writeCue("tile-match-resin.wav", pair("resin-click.wav"));
writeCue("tile-match-bamboo.wav", pair("bamboo-click-a.wav", "bamboo-click-b.wav"));
writeCue("tile-match-bone.wav", pair("bone-click-a.wav", "bone-click-b.wav"));
writeCue("tile-match-porcelain.wav", pair("porcelain-click.wav"), 0.82);
