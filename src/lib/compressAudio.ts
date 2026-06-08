/**
 * Compress any browser-decodable audio file (WAV, MP3, FLAC, etc.)
 * into a 128 kbps MP3 suitable for streaming.
 *
 * Uses the Web Audio API to decode the source to PCM, then re-encodes
 * with lamejs.  Processes in chunks and yields to the UI thread so the
 * browser stays responsive on large files.
 */

import { Mp3Encoder } from "lamejs";

const STREAMING_BITRATE = 128; // kbps — good quality, much smaller than 192/256/320

export async function compressAudioToMp3(
  file: File,
  onProgress?: (percent: number) => void,
  bitrate: number = STREAMING_BITRATE,
): Promise<Blob> {
  onProgress?.(0);

  // 1. Decode audio to PCM via Web Audio API
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext ||
    (window as any).webkitAudioContext)();

  let decoded: AudioBuffer;
  try {
    decoded = await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    await audioCtx.close();
  }

  const channels = decoded.numberOfChannels;
  const sampleRate = decoded.sampleRate;
  const leftFloat = decoded.getChannelData(0);
  const rightFloat = channels > 1 ? decoded.getChannelData(1) : null;

  console.log(
    `[CompressAudio] ${channels}ch ${sampleRate}Hz, ` +
      `${decoded.length} samples → ${bitrate}kbps MP3`,
  );

  // 2. Encode to MP3 in chunks
  const encoder = new Mp3Encoder(channels, sampleRate, bitrate);
  const mp3Parts: Uint8Array[] = [];

  const SAMPLES_PER_CHUNK = 1152 * 64; // ~73k samples per iteration
  const totalSamples = decoded.length;
  let offset = 0;
  let yieldCounter = 0;

  while (offset < totalSamples) {
    const end = Math.min(offset + SAMPLES_PER_CHUNK, totalSamples);
    const count = end - offset;

    // Convert float32 [-1,1] → Int16
    const left = new Int16Array(count);
    const right = rightFloat ? new Int16Array(count) : undefined;

    for (let i = 0; i < count; i++) {
      left[i] = Math.max(
        -32768,
        Math.min(32767, Math.round(leftFloat[offset + i] * 32767)),
      );
      if (right && rightFloat) {
        right[i] = Math.max(
          -32768,
          Math.min(32767, Math.round(rightFloat[offset + i] * 32767)),
        );
      }
    }

    const mp3buf = right
      ? encoder.encodeBuffer(left, right)
      : encoder.encodeBuffer(left);

    if (mp3buf.length > 0) {
      mp3Parts.push(new Uint8Array(mp3buf));
    }

    offset = end;
    onProgress?.(Math.round((offset / totalSamples) * 100));

    if (++yieldCounter % 4 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const flush = encoder.flush();
  if (flush.length > 0) mp3Parts.push(new Uint8Array(flush));

  const totalBytes = mp3Parts.reduce((s, p) => s + p.length, 0);
  console.log(
    `[CompressAudio] Done — ${(totalBytes / 1024 / 1024).toFixed(1)} MB MP3`,
  );

  return new Blob(mp3Parts as BlobPart[], { type: "audio/mpeg" });
}
