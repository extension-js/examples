import React, {memo} from 'react'

const SettingsPanel = memo(function SettingsPanel({
  cameraSelectorRef,
  imgszTypeSelectorRef,
  modelConfigRef,
  customClasses,
  cameras,
  customModels,
  activeFeature,
  defaultClasses,
  loadModel
}) {
  return (
    <div
      id="setting-container"
      className="container bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 mb-4 sm:mb-6 overflow-hidden"
    >
      <h2 className="text-lg sm:text-xl font-bold mb-3 text-gray-200 border-b border-gray-700 pb-2">
        Model Settings
      </h2>

      <div className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="flex flex-col">
            <label className="text-gray-300 mb-1 text-sm font-medium">
              Backend:
            </label>
            <select
              name="device-selector"
              onChange={(e) => {
                modelConfigRef.current.backend = e.target.value
                loadModel()
              }}
              disabled={activeFeature !== null}
              className="p-2 text-sm rounded-md bg-gray-700 text-white border border-gray-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500 transition-all"
            >
              <option value="wasm">Wasm (CPU)</option>
              <option value="webgpu">WebGPU</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-gray-300 mb-1 text-sm font-medium">
              Model:
            </label>
            <select
              name="model-selector"
              onChange={(e) => {
                modelConfigRef.current.model = e.target.value
                loadModel()
              }}
              disabled={activeFeature !== null}
              className="p-2 text-sm rounded-md bg-gray-700 text-white border border-gray-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500 transition-all"
            >
              <option value="yolo11n">YOLO11n</option>
              {customModels.map((model, index) => (
                <option key={index} value={model.url}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="flex flex-col">
            <label className="text-gray-300 mb-1 text-sm font-medium">
              Classes:
            </label>
            <select
              defaultValue="default"
              disabled={activeFeature !== null}
              onChange={(e) => {
                if (e.target.value === 'default') {
                  modelConfigRef.current.classes = defaultClasses
                } else {
                  const selectedIndex = parseInt(e.target.value)
                  modelConfigRef.current.classes =
                    customClasses[selectedIndex].data
                }
              }}
              className="p-2 text-sm rounded-md bg-gray-700 text-white border border-gray-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500 transition-all"
            >
              <option value="default">Default Classes (COCO)</option>
              {customClasses.map((classFile, index) => (
                <option key={index} value={index}>
                  {classFile.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-gray-300 mb-1 text-sm font-medium">
              Camera:
            </label>
            <select
              ref={cameraSelectorRef}
              disabled={activeFeature !== null}
              className="p-2 text-sm rounded-md bg-gray-700 text-white border border-gray-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500 transition-all"
            >
              {cameras.length === 0 ? (
                <option value="">No cameras detected</option>
              ) : (
                cameras.map((camera, index) => (
                  <option key={index} value={camera.deviceId}>
                    {camera.label || `Camera ${index + 1}`}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-gray-300 mb-1 text-sm font-medium">
              Image Type:
            </label>
            <select
              disabled={activeFeature !== null}
              ref={imgszTypeSelectorRef}
              onChange={(e) => {
                modelConfigRef.current.imgszType = e.target.value
              }}
              className="p-2 text-sm rounded-md bg-gray-700 text-white border border-gray-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500 transition-all"
            >
              <option value="dynamic">Dynamic</option>
              <option value="zeroPad">Zero Pad</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
})

export default SettingsPanel
