import React, {memo} from 'react'

const ControlButtons = memo(function ControlButtons({
  imgSrc,
  fileVideoRef,
  fileImageRef,
  handle_OpenVideo,
  handle_OpenImage,
  sampleUrl,
  handle_ToggleCamera,
  handle_AddModel,
  handle_AddClassesFile,
  activeFeature
}) {
  return (
    <div className="container bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 mb-4 sm:mb-6">
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {/* Input and buttons */}
        <input
          type="file"
          accept="video/mp4"
          hidden
          ref={fileVideoRef}
          onChange={(e) => {
            if (e.target.files[0]) {
              handle_OpenVideo(e.target.files[0])
              e.target.value = null
            }
          }}
        />

        <button
          className="btn-primary flex items-center justify-center text-sm sm:text-base"
          onClick={() => fileVideoRef.current.click()}
          disabled={activeFeature !== null}
        >
          <svg
            className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <span className="truncate">Open Video</span>
        </button>

        <input
          type="file"
          accept="image/*"
          hidden
          ref={fileImageRef}
          onChange={(e) => {
            if (e.target.files[0]) {
              const file = e.target.files[0]
              const imgUrl = URL.createObjectURL(file)
              handle_OpenImage(imgUrl)
              e.target.value = null
            }
          }}
        />

        <button
          className={`${
            activeFeature === 'image' ? 'btn-danger' : 'btn-primary'
          } flex items-center justify-center`}
          onClick={() =>
            imgSrc ? handle_OpenImage() : fileImageRef.current.click()
          }
          disabled={activeFeature !== null && activeFeature !== 'image'}
        >
          {activeFeature === 'image' ? (
            <>
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Close Image
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Open Image
            </>
          )}
        </button>

        <button
          className="btn-primary flex items-center justify-center"
          onClick={() => handle_OpenImage(sampleUrl)}
          disabled={activeFeature !== null}
        >
          Sample image
        </button>

        <button
          className={`${
            activeFeature === 'camera' ? 'btn-danger' : 'btn-primary'
          } flex items-center justify-center`}
          onClick={handle_ToggleCamera}
          disabled={activeFeature !== null && activeFeature !== 'camera'}
        >
          {activeFeature === 'camera' ? (
            <>
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Close Camera
            </>
          ) : (
            <>
              <svg
                className="w-5 h-5 mr-2"
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
              Open Camera
            </>
          )}
        </button>

        <button
          className="btn-secondary flex items-center justify-center"
          onClick={(e) => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = '.onnx'
            input.onchange = handle_AddModel
            input.click()
          }}
          disabled={activeFeature !== null}
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Add Model
        </button>

        <button
          className="btn-secondary flex items-center justify-center"
          onClick={(e) => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = '.json'
            input.onchange = handle_AddClassesFile
            input.click()
          }}
          disabled={activeFeature !== null}
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
          Add Classes.json
        </button>
      </div>
    </div>
  )
})

export default ControlButtons
