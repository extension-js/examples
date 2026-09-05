// scripts.js loads this module with a dynamic import(), so the build emits
// it as a chunk of its own that the content script fetches at runtime.
export function greet(name) {
  return `Hello from a lazy-loaded chunk, ${name}.`
}
