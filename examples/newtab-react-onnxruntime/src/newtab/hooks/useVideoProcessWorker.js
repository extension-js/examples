import {useRef, useEffect, useCallback} from 'react'

export const useVideoProcessWorker = ({onStatusUpdate, onComplete}) => {
  const workerRef = useRef(null)

  const callbacksRef = useRef({onStatusUpdate, onComplete})
  useEffect(() => {
    callbacksRef.current = {onStatusUpdate, onComplete}
  }, [onStatusUpdate, onComplete])

  useEffect(() => {
    const worker = new Worker(
      new URL('../utils/video_process_worker.js', import.meta.url),
      {type: 'module'}
    )

    worker.onmessage = (e) => {
      if (e.data.statusMsg) {
        callbacksRef.current.onStatusUpdate?.(e.data.statusMsg)
      }

      if (e.data.processedVideo) {
        callbacksRef.current.onComplete?.(e.data.processedVideo)
      }
    }

    workerRef.current = worker

    return () => {
      worker.terminate()
    }
  }, [])

  const processVideo = useCallback((file, modelConfig) => {
    workerRef.current?.postMessage({
      file,
      modelConfig
    })
  }, [])

  return {processVideo}
}
