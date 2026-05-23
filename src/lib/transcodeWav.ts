/**
 * Memory-efficient WAV → MP3 transcoder.
 *
 * Reads the WAV in ~500 KB slices via File.slice() so an 800 MB+
 * file never has to sit in memory all at once.  Yields to the UI
 * thread periodically so the browser stays responsive.
 */

import { Mp3Encoder } from "lamejs";

/* ------------------------------------------------------------------ */
/*  WAV header parser                                                  */
/* ------------------------------------------------------------------ */

interface WavInfo {
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataOffset: number;
  dataSize: number;
}

function readChunkId(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

function parseWavHeader(buffer: ArrayBuffer): WavInfo {
  const view = new DataView(buffer);

  if (readChunkId(view, 0) !== "RIFF" || readChunkId(view, 8) !== "WAVE") {
    throw new Error("Not a valid WAV file");
  }

  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataSize = -1;

  let pos = 12;
  while (pos < buffer.byteLength - 8) {
    const id = readChunkId(view, pos);
    const size = view.getUint32(pos + 4, true);

    if (id === "fmt ") {
      channels = view.getUint16(pos + 10, true);
      sampleRate = view.getUint32(pos + 12, true);
      bitsPerSample = view.getUint16(pos + 22, true);
    } else if (id === "data") {
      dataOffset = pos + 8;
      dataSize = size;
      break;
    }

    pos += 8 + size;
    if (size % 2 !== 0) pos++; // RIFF pad byte
  }

  if (dataOffset < 0 || !channels || !sampleRate || !bitsPerSample) {
    throw new Error("Could not parse WAV header");
  }

  return { channels, sampleRate, bitsPerSample, dataOffset, dataSize };
}

/* ------------------------------------------------------------------ */
/*  Public transcoder                                                  */
/* ------------------------------------------------------------------ */

export async function transcodeWavToMp3(
  wavFile: File,
  bitrate = 192,
  onProgress?: (percent: number) => void,
): Promise<Blob> {
  // 1. Parse header (first 8 KB covers even extended fmt chunks)
  const headerBuf = await wavFile.slice(0, 8192).arrayBuffer();
  const info = parseWavHeader(headerBuf);

  console.log(
    `[Transcode] ${info.channels}ch ${info.sampleRate}Hz ` +
      `${info.bitsPerSample}bit — ${(info.dataSize / 1024 / 1024).toFixed(0)} MB PCM`,
  );

  const encoder = new Mp3Encoder(info.channels, info.sampleRate, bitrate);
  const mp3Parts: Uint8Array[] = [];

  const bytesPerSample = info.bitsPerSample / 8;
  const blockAlign = info.channels * bytesPerSample;

  // ~0.5 MB of PCM per iteration keeps memory low
  const samplesPerChunk = 1152 * 64; // 73 728 samples ≈ 1.7 s @ 44.1 kHz
  const bytesPerChunk = samplesPerChunk * blockAlign;

  let filePos = info.dataOffset;
  const fileEnd = info.dataOffset + info.dataSize;
  let totalRead = 0;
  let yieldCounter = 0;

  while (filePos < fileEnd) {
    const chunkEnd = Math.min(filePos + bytesPerChunk, fileEnd);
    const buf = await wavFile.slice(filePos, chunkEnd).arrayBuffer();
    const dv = new DataView(buf);
    const numSamples = Math.floor(buf.byteLength / blockAlign);

    const left = new Int16Array(numSamples);
    const right = info.channels > 1 ? new Int16Array(numSamples) : undefined;

    for (let i = 0; i < numSamples; i++) {
      const off = i * blockAlign;

      if (info.bitsPerSample === 16) {
        left[i] = dv.getInt16(off, true);
        if (right) right[i] = dv.getInt16(off + 2, true);
      } else if (info.bitsPerSample === 24) {
        // Keep top 16 bits of 24-bit sample
        left[i] = dv.getUint8(off + 1) | (dv.getInt8(off + 2) << 8);
        if (right) {
          right[i] =
            dv.getUint8(off + bytesPerSample + 1) |
            (dv.getInt8(off + bytesPerSample + 2) << 8);
        }
      } else if (info.bitsPerSample === 32) {
        // 32-bit float PCM
        const v = dv.getFloat32(off, true);
        left[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
        if (right) {
          const rv = dv.getFloat32(off + 4, true);
          right[i] = Math.max(-32768, Math.min(32767, Math.round(rv * 32767)));
        }
      }
    }

    const mp3buf = right
      ? encoder.encodeBuffer(left, right)
      : encoder.encodeBuffer(left);

    if (mp3buf.length > 0) {
      mp3Parts.push(new Uint8Array(mp3buf));
    }

    filePos = chunkEnd;
    totalRead += buf.byteLength;
    onProgress?.(Math.round((totalRead / info.dataSize) * 100));

    // Yield to UI thread every ~4 chunks so progress bar updates
    if (++yieldCounter % 4 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const flush = encoder.flush();
  if (flush.length > 0) mp3Parts.push(new Uint8Array(flush));

  const totalBytes = mp3Parts.reduce((s, p) => s + p.length, 0);
  console.log(
    `[Transcode] Complete — ${mp3Parts.length} chunks, ` +
      `${(totalBytes / 1024 / 1024).toFixed(1)} MB MP3`,
  );

  return new Blob(mp3Parts as BlobPart[], { type: "audio/mpeg" });
}