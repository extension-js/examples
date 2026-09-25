import React, {memo} from 'react'

const ImageDisplay = memo(function ImageDisplay({
  cameraRef,
  imgRef,
  overlayRef,
  imgSrc,
  onCameraLoad,
  onImageLoad,
  activeFeature
}) {
  return (
    <div className="container bg-gray-800 rounded-xl shadow-lg relative min-h-[200px] sm:min-h-[320px] flex justify-center items-center overflow-hidden p-2 md:p-4 mb-4 sm:mb-6">
      {activeFeature === null && (
        <div className="text-gray-400 text-center p-4 sm:p-8">
          <svg
            className="w-16 h-16 sm:w-24 sm:h-24 mx-auto mb-2 sm:mb-4 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <p className="text-base sm:text-xl font-medium">No media selected</p>
          <p className="mt-1 sm:mt-2 text-xs sm:text-base">
            Use the controls below to open an image, video, or camera
          </p>
        </div>
      )}
      <div className="relative">
        <video
          className="block max-h-[400px] sm:max-h-[640px] rounded-lg mx-auto object-contain"
          ref={cameraRef}
          onLoadedMetadata={onCameraLoad}
          hidden={activeFeature !== 'camera'}
          autoPlay
          playsInline
        />
        <img
          id="img"
          ref={imgRef}
          src={imgSrc}
          onLoad={onImageLoad}
          hidden={activeFeature !== 'image'}
          className="block max-h-[400px] sm:max-h-[640px] rounded-lg mx-auto object-contain"
          alt="Uploaded"
        />
        <canvas
          ref={overlayRef}
          hidden={activeFeature === null}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
        ></canvas>
      </div>
    </div>
  )
})

export default ImageDisplay
