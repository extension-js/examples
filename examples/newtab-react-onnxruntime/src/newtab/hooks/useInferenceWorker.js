import {useRef, useEffect, useCallback} from 'react'

export const useInferenceWorker = ({
  onModelLoaded,
  onModelError,
  onResult,
  onResultError
}) => {
  const workerRef = useRef(null)

  // Keep callbacks fresh in ref to avoid re-creating worker on callback change
  const callbacksRef = useRef({
    onModelLoaded,
    onModelError,
    onResult,
    onResultError
  })
  useEffect(() => {
    callbacksRef.current = {
      onModelLoaded,
      onModelError,
      onResult,
      onResultError
    }
  }, [onModelLoaded, onModelError, onResult, onResultError])

  useEffect(() => {
    const worker = new Worker(
      new URL('../utils/inference-pipeline-worker.js', import.meta.url),
      {type: 'module'}
    )

    worker.onmessage = (e) => {
      const {type} = e.data

      if (type === 'MODEL_LOADED') {
        callbacksRef.current.onModelLoaded?.(e.data)
      } else if (type === 'MODEL_ERROR') {
        callbacksRef.current.onModelError?.(e.data)
      } else if (type === 'RESULT') {
        callbacksRef.current.onResult?.(e.data)
      } else if (type === 'INFERENCE_ERROR') {
        callbacksRef.current.onResultError?.(e.data)
      }
    }

    workerRef.current = worker

    return () => {
      worker.terminate()
    }
  }, [])

  const postMessage = useCallback((message, transfer) => {
    workerRef.current?.postMessage(message, transfer)
  }, [])

  return {postMessage}
}
