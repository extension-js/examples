import React, {memo} from 'react'

const ResultsTable = memo(function ResultsTable({details, currentClasses}) {
  return (
    <div className="container bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 mb-4 sm:mb-6">
      <details className="text-gray-200 group">
        <summary className="flex items-center cursor-pointer select-none">
          <div className="flex-1 text-lg sm:text-xl font-bold border-b border-gray-700 pb-2">
            Detection Results ({details.length})
          </div>
          <div className="text-gray-400">
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 transform group-open:rotate-180 transition-transform duration-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </summary>

        <div className="transition-all duration-300 ease-in-out transform origin-top group-open:animate-details-show mt-3 sm:mt-4">
          {details.length === 0 ? (
            <div className="bg-gray-700 rounded-lg p-4 sm:p-8 text-center">
              <svg
                className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-gray-400 text-base sm:text-lg">
                No objects detected
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-3 px-3">
              <table className="w-full border-collapse min-w-full">
                <thead>
                  <tr className="bg-gray-700 text-left">
                    <th className="p-2 sm:p-3 rounded-tl-lg text-xs sm:text-sm text-left">
                      ID
                    </th>
                    <th className="p-2 sm:p-3 text-xs sm:text-sm text-left">
                      Class
                    </th>
                    <th className="p-2 sm:p-3 rounded-tr-lg text-xs sm:text-sm text-left">
                      Confidence
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {details.map((item, index) => (
                    <tr
                      key={index}
                      className={`border-b border-gray-700 hover:bg-gray-700 transition-colors text-gray-300 ${
                        index === details.length - 1 ? 'border-b-0' : ''
                      }`}
                    >
                      <td className="p-2 sm:p-3 font-mono text-xs sm:text-sm text-left">
                        {index}
                      </td>
                      <td className="p-2 sm:p-3 font-medium text-xs sm:text-sm text-left">
                        {currentClasses[item.classIdx] ||
                          `Class ${item.classIdx}`}
                      </td>
                      <td className="p-2 sm:p-3 text-xs sm:text-sm text-left">
                        <div className="flex items-center">
                          <div className="w-full bg-gray-600 rounded-full h-1.5 sm:h-2.5 mr-1 sm:mr-2 max-w-[70px] sm:max-w-[100px]">
                            <div
                              className="bg-lime-500 h-1.5 sm:h-2.5 rounded-full"
                              style={{width: `${item.score * 100}%`}}
                            ></div>
                          </div>
                          <span>{(item.score * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>
    </div>
  )
})

export default ResultsTable
