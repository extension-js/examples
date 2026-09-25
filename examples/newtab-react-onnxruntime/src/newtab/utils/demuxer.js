import {createFile, DataStream, Endianness, MP4BoxBuffer} from 'mp4box'

/**
 * Demuxes the first video track of an MP4 file using MP4Box, calling
 *
 */
export class MP4Demuxer {
  constructor(file, onConfig, onChunk, onDone) {
    this.onDone = onDone
    this.file = createFile()
    this.file.onError = (error) => console.error('MP4Box error:', error)

    // If demuxer done
    this.file.onReady = (info) => {
      const track = info.videoTracks[0] // get the first video track
      const config = {
        codec: track.codec,
        bitrate: track.bitrate,
        codedHeight: track.video.height,
        codedWidth: track.video.width,
        nb_frames: track.nb_samples,
        description: this.getDescription(track)
      }
      onConfig(config) // send the config to the decoder
      this.file.setExtractionOptions(track.id) // get data from the track
      this.file.start() // start get samples track
    }

    // If get samples
    this.file.onSamples = (trackId, ref, samples) => {
      for (const sample of samples) {
        // for each sample
        const chunk = new EncodedVideoChunk({
          // sample to chunk
          type: sample.is_sync ? 'key' : 'delta',
          timestamp: (1e6 * sample.cts) / sample.timescale,
          duration: (1e6 * sample.duration) / sample.timescale,
          data: sample.data
        })
        onChunk(chunk)
      }
    }

    this.readFile(file) // start reading the file
  }

  // get track description for initialization demuxer
  getDescription(track) {
    const trak = this.file.getTrackById(track.id)

    for (const entry of trak.mdia.minf.stbl.stsd.entries) {
      // for each track sample description list
      const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C

      if (box) {
        const stream = new DataStream(undefined, 0, Endianness.BIG_ENDIAN)
        box.write(stream)

        return new Uint8Array(stream.buffer, 8)
      }
    }

    throw new Error('avcC, hvcC, vpcC, or av1C box not found')
  }

  async readFile(file) {
    const reader = new FileReader()

    reader.onload = () => {
      const buffer = MP4BoxBuffer.fromArrayBuffer(reader.result, 0)
      this.file.appendBuffer(buffer)
      this.file.flush()
      this.onDone?.()
    }

    reader.onerror = () => this.onDone?.(reader.error)
    reader.readAsArrayBuffer(file)
  }
}
