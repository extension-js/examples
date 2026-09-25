import './assets/App.css'
import {useEffect, useRef, useState, useCallback} from 'react'
import classes from './utils/yolo_classes.json'
import {bundledModelUrl, SAMPLE_IMAGE_URL} from './utils/ort-env.js'
import {renderOverlay} from './utils/render-overlay'
import {handOverDetection} from '../last-detection.js'

// Hooks
import {useInferenceWorker} from './hooks/useInferenceWorker'
import {useWebcam} from './hooks/useWebcam'
import {useVideoProcessWorker} from './hooks/useVideoProcessWorker'

// Components
import SettingsPanel from './components/SettingsPanel'
import ImageDisplay from './components/ImageDisplay'
import ControlButtons from './components/ControlButtons'
import ModelStatus from './components/ModelStatus'
import ResultsTable from './components/ResultsTable'

const DEFAULT_MODEL_CONFIG = {
  inputShape: [1, 3, 640, 640],
  overlaySize: [640, 640],
  iouThreshold: 0.35,
  scoreThreshold: 0.45,
  backend: 'wasm',
  model: 'yolo11n',
  modelPath: '',
  task: 'detect',
  imgszType: 'dynamic',
  classes: classes
}

function App() {
  // --- State ---
  const [processingStatus, setProcessingStatus] = useState({
    warnUpTime: 0,
    inferenceTime: 0,
    statusMsg: 'Model not loaded',
    statusColor: 'inherit'
  })

  const [customModels, setCustomModels] = useState([])
  const [customClasses, setCustomClasses] = useState([])
  const [imgSrc, setImgSrc] = useState(null)
  const [details, setDetails] = useState([])
  const [activeFeature, setActiveFeature] = useState(null) // null, 'video', 'image', 'camera', 'loading'

  // --- Refs ---
  const modelConfigRef = useRef(DEFAULT_MODEL_CONFIG)
  const cameraSelectorRef = useRef(null)
  const imgszTypeSelectorRef = useRef(null)

  const imgRef = useRef(null)
  const overlayRef = useRef(null)
  const cameraRef = useRef(null)
  const fileImageRef = useRef(null)
  const fileVideoRef = useRef(null)
  const activeFeatureRef = useRef(activeFeature)
  const isProcessingRef = useRef(false)

  // Sync activeFeatureRef
  useEffect(() => {
    activeFeatureRef.current = activeFeature
  }, [activeFeature])

  // --- Callbacks for Workers ---
  const handleInferenceResult = useCallback((data) => {
    // Determine context for drawing
    const overlayCtx = overlayRef.current?.getContext('2d')
    if (!overlayCtx) return

    // Clear and draw
    overlayCtx.clearRect(
      0,
      0,
      overlayCtx.canvas.width,
      overlayCtx.canvas.height
    )

    renderOverlay(data.results, overlayCtx, modelConfigRef.current.classes)

    setDetails(data.results)
    handOverDetection(data.results, modelConfigRef.current.classes?.classes)
    setProcessingStatus((prev) => ({
      ...prev,
      inferenceTime: data.inferenceTime
    }))

    // Mark processing as done so loop can continue
    isProcessingRef.current = false
  }, [])

  const handleModelError = useCallback((data) => {
    setProcessingStatus((prev) => ({
      ...prev,
      statusMsg: data.msg || 'Failed to load model.',
      statusColor: 'red'
    }))

    setActiveFeature(null)
  }, [])

  const handleInferenceError = useCallback((data) => {
    setProcessingStatus((prev) => ({
      ...prev,
      statusMsg: data.msg || 'Inference failed.',
      statusColor: 'red'
    }))

    isProcessingRef.current = false
  }, [])

  const handleModelLoaded = useCallback((data) => {
    setProcessingStatus((prev) => ({
      ...prev,
      statusMsg: data.msg,
      statusColor: 'green',
      warnUpTime: data.loadTime
    }))

    setActiveFeature(null)
  }, [])

  const handleVideoStatusKey = useCallback((msg) => {
    setProcessingStatus((prev) => ({...prev, statusMsg: msg}))
  }, [])

  const handleVideoComplete = useCallback((blob) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'processed_video.mp4'
    a.click()
    URL.revokeObjectURL(url)
    setActiveFeature(null)
  }, [])

  // --- Hooks ---
  const {postMessage: postInferenceMessage} = useInferenceWorker({
    onModelLoaded: handleModelLoaded,
    onModelError: handleModelError,
    onResult: handleInferenceResult,
    onResultError: handleInferenceError
  })

  const {cameras, getCameras, openCamera, closeCamera, cameraStatus} =
    useWebcam(cameraRef)

  // Sync camera status to processing status
  useEffect(() => {
    if (cameraStatus.msg) {
      setProcessingStatus((prev) => ({
        ...prev,
        statusMsg: cameraStatus.msg,
        statusColor: cameraStatus.color
      }))
    }
  }, [cameraStatus])

  const {processVideo} = useVideoProcessWorker({
    onStatusUpdate: handleVideoStatusKey,
    onComplete: handleVideoComplete
  })

  // --- Logic ---

  const loadModel = useCallback(async () => {
    setProcessingStatus((prev) => ({
      ...prev,
      statusMsg: 'Loading model...',
      statusColor: 'red'
    }))

    setActiveFeature('loading')

    const customModel = customModels.find(
      (model) => model.url === modelConfigRef.current.model
    )

    const modelPath = customModel
      ? customModel.url
      : bundledModelUrl(
          modelConfigRef.current.model,
          modelConfigRef.current.task
        )

    modelConfigRef.current.modelPath = modelPath

    postInferenceMessage({
      type: 'LOAD_MODEL',
      config: modelConfigRef.current
    })
  }, [customModels, postInferenceMessage])

  const imageLoad = useCallback(async () => {
    if (!imgRef.current) return

    overlayRef.current.width = imgRef.current.naturalWidth
    overlayRef.current.height = imgRef.current.naturalHeight

    modelConfigRef.current.overlaySize = [
      overlayRef.current.width,
      overlayRef.current.height
    ]

    const bitmap = await createImageBitmap(imgRef.current)
    postInferenceMessage(
      {
        type: 'INFERENCE',
        config: modelConfigRef.current,
        bitmap: bitmap
      },
      [bitmap]
    )
  }, [postInferenceMessage])

  // Initial load
  useEffect(() => {
    loadModel()
  }, [])

  // Camera Loop
  const startCameraLoop = useCallback(() => {
    const loop = async () => {
      if (activeFeatureRef.current !== 'camera') return

      if (
        !isProcessingRef.current &&
        cameraRef.current &&
        cameraRef.current.readyState >= 2
      ) {
        isProcessingRef.current = true

        // Create bitmap from camera
        try {
          const bitmap = await createImageBitmap(cameraRef.current)

          // Adjust overlay size if needed
          if (
            overlayRef.current.width !== cameraRef.current.videoWidth ||
            overlayRef.current.height !== cameraRef.current.videoHeight
          ) {
            overlayRef.current.width = cameraRef.current.videoWidth
            overlayRef.current.height = cameraRef.current.videoHeight
          }

          modelConfigRef.current.overlaySize = [
            overlayRef.current.width,
            overlayRef.current.height
          ]

          postInferenceMessage(
            {
              type: 'INFERENCE',
              config: modelConfigRef.current,
              bitmap: bitmap
            },
            [bitmap]
          )
        } catch (e) {
          console.error('Frame capture error:', e)
          isProcessingRef.current = false
        }
      }

      requestAnimationFrame(loop)
    }

    loop()
  }, [postInferenceMessage])

  // Handlers
  const handleAddModel = useCallback((event) => {
    const file = event.target.files[0]

    if (file) {
      const fileName = file.name.replace('.onnx', '')
      const fileUrl = URL.createObjectURL(file)
      setCustomModels((prev) => [...prev, {name: fileName, url: fileUrl}])
    }
  }, [])

  const handleAddClassesFile = useCallback((event) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target.result)
        const fileName = file.name.replace(/\.json$/i, '')
        setCustomClasses((prev) => [...prev, {name: fileName, data: jsonData}])
        setProcessingStatus((prev) => ({
          ...prev,
          statusMsg: `Classes file "${fileName}" loaded successfully`,
          statusColor: 'green'
        }))
      } catch (error) {
        setProcessingStatus((prev) => ({
          ...prev,
          statusMsg: error.message || 'Error parsing JSON file',
          statusColor: 'red'
        }))
      }
    }

    reader.readAsText(file)
  }, [])

  const handleOpenImage = useCallback(
    (imgUrl = null) => {
      if (imgUrl) {
        setImgSrc(imgUrl)
        setActiveFeature('image')
      } else if (imgSrc) {
        if (imgSrc.startsWith('blob:')) {
          URL.revokeObjectURL(imgSrc)
        }

        if (overlayRef.current) {
          overlayRef.current.width = 0
          overlayRef.current.height = 0
        }

        setImgSrc(null)
        setDetails([])
        setActiveFeature(null)
      }
    },
    [imgSrc]
  )

  const toggleCamera = useCallback(async () => {
    if (activeFeature === 'camera') {
      closeCamera()

      if (overlayRef.current) {
        overlayRef.current.width = 0
        overlayRef.current.height = 0
      }

      setActiveFeature(null)
      setDetails([])
    } else {
      const camerasList = await getCameras()

      if (camerasList.length > 0) {
        const selectedDeviceId = cameraSelectorRef.current
          ? cameraSelectorRef.current.value
          : camerasList[0].deviceId
        const success = await openCamera(selectedDeviceId)

        if (success) {
          setActiveFeature('camera')
        }
      } else {
        setProcessingStatus((prev) => ({
          ...prev,
          statusMsg: 'No cameras found',
          statusColor: 'red'
        }))
      }
    }
  }, [activeFeature, closeCamera, getCameras, openCamera])

  const handleCameraLoad = useCallback(() => {
    startCameraLoop()
  }, [startCameraLoop])

  const handleOpenVideo = useCallback(
    (file) => {
      if (file) {
        processVideo(file, modelConfigRef.current)
        setActiveFeature('video')
      }
    },
    [processVideo]
  )

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-4 sm:py-6 bg-gray-900 min-h-screen">
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-4 sm:mb-6 text-white">
        <span className="block sm:inline">YOLO</span>
        <span className="bg-gradient-to-r from-violet-500 to-fuchsia-500 bg-clip-text text-transparent block sm:inline">
          {' '}
          Object Detection
        </span>
      </h1>
      <SettingsPanel
        cameraSelectorRef={cameraSelectorRef}
        imgszTypeSelectorRef={imgszTypeSelectorRef}
        modelConfigRef={modelConfigRef}
        customClasses={customClasses}
        cameras={cameras}
        customModels={customModels}
        activeFeature={activeFeature}
        defaultClasses={classes}
        loadModel={loadModel}
      />

      <ImageDisplay
        cameraRef={cameraRef}
        imgRef={imgRef}
        overlayRef={overlayRef}
        imgSrc={imgSrc}
        onCameraLoad={handleCameraLoad}
        onImageLoad={imageLoad}
        activeFeature={activeFeature}
      />
      <ControlButtons
        imgSrc={imgSrc}
        fileVideoRef={fileVideoRef}
        fileImageRef={fileImageRef}
        handle_OpenVideo={handleOpenVideo}
        handle_OpenImage={handleOpenImage}
        sampleUrl={SAMPLE_IMAGE_URL}
        handle_ToggleCamera={toggleCamera}
        handle_AddModel={handleAddModel}
        handle_AddClassesFile={handleAddClassesFile}
        activeFeature={activeFeature}
      />

      <ModelStatus
        warnUpTime={processingStatus.warnUpTime}
        inferenceTime={processingStatus.inferenceTime}
        statusMsg={processingStatus.statusMsg}
        statusColor={processingStatus.statusColor}
      />

      <ResultsTable
        details={details}
        currentClasses={modelConfigRef.current.classes.classes}
      />
    </div>
  )
}

export default App
