import './ort-env.js'
import {MP4Demuxer} from './demuxer.js'
import {Muxer, ArrayBufferTarget} from 'mp4-muxer'
import {inferencePipeline} from './inference-pipeline.js'
import {modelLoader} from './model-loader.js'
import {renderOverlay} from './render-overlay.js'

self.onmessage = async function (e) {
  const {file, modelConfig} = e.data

  let yolo_model

  try {
    yolo_model = await modelLoader(modelConfig.modelPath, modelConfig.backend)
  } catch (error) {
    self.postMessage({
      statusMsg: `Model load failed: ${error?.message || error}`
    })

    return
  }

  // State variables
  let inputCanvas, inputCtx, resultCanvas, resultCtx
  let decoder = null
  let encoder = null
  let muxer = null
  let frameCount = 0
  let totalFrames = 0

  let frameQueue = []
  let demuxDone = false
  let decoderFlushed = false
  let pumping = false
  let finished = false

  const onConfig = (config) => {
    totalFrames = config.nb_frames

    // H.264 wants even dimensions. The decoded frame is drawn into this size.
    const width = config.codedWidth - (config.codedWidth % 2)
    const height = config.codedHeight - (config.codedHeight % 2)
    inputCanvas = new OffscreenCanvas(width, height)
    resultCanvas = new OffscreenCanvas(width, height)
    inputCtx = inputCanvas.getContext('2d', {
      willReadFrequently: true
    })

    resultCtx = resultCanvas.getContext('2d', {
      willReadFrequently: true
    })

    // Initialize Muxer
    muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: 'avc', // H.264
        width,
        height
      },
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset'
    })

    // Initialize Encoder
    encoder = new VideoEncoder({
      output: (chunk, meta) => {
        muxer.addVideoChunk(chunk, meta)
      },
      error: (e) => {
        console.error('Encoder Error: ', e)
        self.postMessage({statusMsg: `Encoder Error: ${e.message}`})
      }
    })

    encoder.configure({
      codec: 'avc1.640028', // H.264
      width,
      height,
      bitrate: config.bitrate || 2_000_000 // 2Mbps
    })

    // Initialize Decoder
    decoder = new VideoDecoder({
      output: (frame) => {
        frameQueue.push(frame)
        schedule()
      },
      error: (e) => {
        console.error('Decoder Error:', e)
        self.postMessage({statusMsg: `Decoder Error: ${e.message}`})
      }
    })

    decoder.configure(config)

    self.postMessage({
      statusMsg: '✅ Initialize End, Start process...'
    })
  }

  // Process video chunks
  const onChunk = (chunk) => {
    if (decoder && decoder.state === 'configured') {
      decoder.decode(chunk)
    } else {
      console.error('Encoder not ready')
      self.postMessage({statusMsg: 'Encoder not ready'})
    }
  }

  function schedule() {
    if (pumping || finished) return

    pumping = true
    pump()
      .catch((error) => {
        console.error('Video Processing Error:', error)
        self.postMessage({
          statusMsg: `Video Processing Error: ${error?.message || error}`
        })
      })
      .finally(() => {
        pumping = false
      })
  }

  async function pump() {
    while (frameQueue.length > 0) {
      const frame = frameQueue.shift()

      try {
        inputCtx.drawImage(frame, 0, 0, inputCanvas.width, inputCanvas.height)
        resultCtx.drawImage(
          frame,
          0,
          0,
          resultCanvas.width,
          resultCanvas.height
        )

        const frameConfig = {
          ...modelConfig,
          overlaySize: [inputCanvas.width, inputCanvas.height]
        }
        const [results, inferenceTime] = await inferencePipeline(
          inputCanvas,
          yolo_model,
          frameConfig
        )
        await renderOverlay(results, resultCtx, modelConfig.classes)

        const outputFrame = new VideoFrame(resultCanvas, {
          timestamp: frame.timestamp,
          duration: frame.duration
        })
        encoder.encode(outputFrame)
        outputFrame.close()
        frameCount++

        self.postMessage({
          statusMsg: `Processing ${frameCount}/${totalFrames || '?'} (${inferenceTime}ms)`,
          progress: totalFrames > 0 ? frameCount / totalFrames : 0
        })
      } catch (error) {
        console.error('Frame process error:', error)
        self.postMessage({
          statusMsg: `Frame process error: ${error?.message || error}`
        })
      } finally {
        frame.close()
      }
    }

    if (!demuxDone || !decoder || finished) return

    if (decoder.state === 'configured' && !decoderFlushed) {
      decoderFlushed = true
      self.postMessage({statusMsg: 'Finalizing video...'})
      await decoder.flush()

      return pump()
    }

    finished = true
    if (decoder.state === 'configured') decoder.close()

    if (encoder && encoder.state === 'configured') {
      await encoder.flush()
      encoder.close()
    }

    if (!muxer) return

    muxer.finalize()
    const blob = new Blob([muxer.target.buffer], {type: 'video/mp4'})
    inputCanvas = null
    self.postMessage({
      statusMsg: '✅ Video Processing Complete!',
      processedVideo: blob
    })
  }

  // Start demuxer
  try {
    new MP4Demuxer(file, onConfig, onChunk, () => {
      demuxDone = true
      schedule()
    })

    self.postMessage({statusMsg: '🔄 Start demuxer...'})
  } catch (e) {
    console.error('Demuxer Initialize Error:', e)
    self.postMessage({statusMsg: `Demuxer Initialize Error: ${e.message}`})
  }
}
