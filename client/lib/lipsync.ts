export type MouthPose = { open: number; wide: number; round: number };

export const CLOSED_MOUTH: MouthPose = { open: 0, wide: 0, round: 0 };

const FPS = 30;

/** Turn a downloaded TTS wav into one mouth pose per frame. */
export function mouthTrackFromWav(buffer: ArrayBuffer): MouthPose[] {
  const { samples, rate } = decodeWavMono(buffer);
  return analyse(samples, rate);
}

export function mouthAt(track: MouthPose[], timeSec: number): MouthPose {
  if (!track.length) return CLOSED_MOUTH;
  const index = Math.min(track.length - 1, Math.max(0, Math.floor(timeSec * FPS)));
  return track[index] ?? CLOSED_MOUTH;
}

function decodeWavMono(buffer: ArrayBuffer): { samples: Float32Array; rate: number } {
  const view = new DataView(buffer);
  if (buffer.byteLength < 44 || readTag(view, 0) !== "RIFF" || readTag(view, 8) !== "WAVE") {
    throw new Error("TTS audio is not a wav");
  }
  let format = 1;
  let channels = 1;
  let rate = 24000;
  let bits = 16;
  let dataOffset = 0;
  let dataSize = 0;
  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const id = readTag(view, offset);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (id === "fmt ") {
      format = view.getUint16(start, true);
      channels = view.getUint16(start + 2, true);
      rate = view.getUint32(start + 4, true);
      bits = view.getUint16(start + 14, true);
    } else if (id === "data") {
      dataOffset = start;
      dataSize = Math.min(size, view.byteLength - start);
      break;
    }
    offset = start + size + (size & 1);
  }
  if (!dataOffset || channels < 1) throw new Error("wav has no audio data");

  const bytesPerSample = bits / 8;
  const frames = Math.floor(dataSize / (channels * bytesPerSample));
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let acc = 0;
    for (let c = 0; c < channels; c++) {
      const at = dataOffset + (i * channels + c) * bytesPerSample;
      if (format === 3 && bits === 32) acc += view.getFloat32(at, true);
      else if (bits === 16) acc += view.getInt16(at, true) / 32768;
      else if (bits === 8) acc += (view.getUint8(at) - 128) / 128;
      else if (bits === 32) acc += view.getInt32(at, true) / 2147483648;
    }
    samples[i] = acc / channels;
  }
  return { samples, rate };
}

function analyse(samples: Float32Array, rate: number): MouthPose[] {
  const nFrames = Math.max(1, Math.ceil((samples.length / rate) * FPS));
  const hop = rate / FPS;
  const loud = new Float32Array(nFrames);
  const bright = new Float32Array(nFrames);
  const rc = Math.exp((-2 * Math.PI * 1400) / rate);

  for (let frame = 0; frame < nFrames; frame++) {
    const start = Math.max(0, Math.floor((frame + 1) * hop - hop));
    const end = Math.min(samples.length, start + Math.floor(hop * 2));
    let energy = 0;
    let count = 0;
    let low = 0;
    let lowEnergy = 0;
    let highEnergy = 0;
    for (let i = start; i < end; i++) {
      const sample = samples[i] ?? 0;
      energy += sample * sample;
      count++;
      low = low * rc + sample * (1 - rc);
      lowEnergy += low * low;
      const high = sample - low;
      highEnergy += high * high;
    }
    loud[frame] = Math.sqrt(energy / Math.max(count, 1));
    bright[frame] = highEnergy / (highEnergy + lowEnergy + 1e-9);
  }

  const voiced: number[] = [];
  for (let i = 0; i < nFrames; i++) if (loud[i]! > 1e-5) voiced.push(loud[i]!);
  const ref = percentile(voiced, 95) || 1;
  const level = new Float32Array(nFrames);
  for (let i = 0; i < nFrames; i++) level[i] = clamp((loud[i]! / ref - 0.1) / 0.9, 0, 1);

  const smooth = new Float32Array(nFrames);
  for (let i = 0; i < nFrames; i++) {
    const prev = i ? smooth[i - 1]! : 0;
    const follow = level[i]! > prev ? 0.75 : 0.5;
    smooth[i] = prev + (level[i]! - prev) * follow;
  }
  const openness = new Float32Array(nFrames);
  for (let i = 0; i < nFrames; i++) {
    let peak = 0;
    for (let j = Math.max(0, i - 4); j < Math.min(nFrames, i + 5); j++) peak = Math.max(peak, smooth[j]!);
    const contrast = smooth[i]! / Math.max(peak, 1e-3);
    openness[i] = (smooth[i]! * (0.4 + 0.6 * contrast * contrast)) ** 0.8;
  }

  const spoken: number[] = [];
  for (let i = 0; i < nFrames; i++) if (level[i]! > 0.2) spoken.push(bright[i]!);
  const tone = spoken.length >= 4 ? spoken : Array.from(bright);
  const lo = percentile(tone, 8);
  const midLo = percentile(tone, 30);
  const midHi = percentile(tone, 70);
  const hi = percentile(tone, 95);

  const track: MouthPose[] = [];
  for (let i = 0; i < nFrames; i++) {
    const wide = clamp((bright[i]! - midHi) / Math.max(hi - midHi, 1e-3), 0, 1) * 0.85;
    const round = clamp((midLo - bright[i]!) / Math.max(midLo - lo, 1e-3), 0, 1) * 0.8;
    const openAmount = openness[i]!;
    track.push({
      open: openAmount * (1 - 0.6 * wide - 0.5 * round),
      wide: openAmount * wide,
      round: openAmount * round,
    });
  }
  return track;
}

function readTag(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3)
  );
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[index] ?? 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
