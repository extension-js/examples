export function trackEvent(eventName, payload = {}) {
  // no-op analytics interface for demonstration purposes
  return {event: eventName, ...payload}
}
