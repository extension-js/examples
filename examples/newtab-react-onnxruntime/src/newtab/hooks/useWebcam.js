import {useState, useCallback} from 'react'

export const useWebcam = (videoRef) => {
  const [cameras, setCameras] = useState([])
  const [cameraStatus, setCameraStatus] = useState({msg: '', color: ''})

  const getCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(
        (device) => device.kind === 'videoinput'
      )

      // If no labels, try requesting permission
      if (videoDevices.length > 0 && !videoDevices[0].label) {
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          })
          tempStream.getTracks().forEach((track) => track.stop())

          const updatedDevices = await navigator.mediaDevices.enumerateDevices()
          const updatedVideoDevices = updatedDevices.filter(
            (device) => device.kind === 'videoinput'
          )

          setCameras(updatedVideoDevices)

          return updatedVideoDevices
        } catch (err) {
          console.error('Error getting camera permissions:', err)
          setCameras(videoDevices)

          return videoDevices
        }
      } else {
        setCameras(videoDevices)

        return videoDevices
      }
    } catch (err) {
      console.error('Error enumerating devices:', err)
      setCameras([])

      return []
    }
  }, [])

  const openCamera = useCallback(
    async (deviceId) => {
      if (!videoRef.current) return

      try {
        setCameraStatus({msg: 'Opening camera...', color: 'blue'})

        const constraints = deviceId
          ? {video: {deviceId: {exact: deviceId}}, audio: false}
          : {video: true, audio: false}

        let stream

        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints)
        } catch (err) {
          if (err?.name === 'OverconstrainedError' && deviceId) {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {deviceId: {ideal: deviceId}},
              audio: false
            })
          } else {
            throw err
          }
        }

        videoRef.current.srcObject = stream
        setCameraStatus({msg: 'Camera opened successfully', color: 'green'})

        return true
      } catch (err) {
        console.error('Failed to open selected camera:', err)
        setCameraStatus({
          msg: 'Trying to open any available camera...',
          color: 'blue'
        })

        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          })
          videoRef.current.srcObject = fallbackStream
          setCameraStatus({
            msg: 'Default camera opened (selected unavailable)',
            color: 'green'
          })

          return true
        } catch (fallbackErr) {
          console.error('Error opening fallback camera:', fallbackErr)
          setCameraStatus({
            msg: `Camera open failed: ${fallbackErr.message}`,
            color: 'red'
          })

          return false
        }
      }
    },
    [videoRef]
  )

  const closeCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }

    setCameraStatus({msg: '', color: 'inherit'})
  }, [videoRef])

  return {cameras, getCameras, openCamera, closeCamera, cameraStatus}
}
