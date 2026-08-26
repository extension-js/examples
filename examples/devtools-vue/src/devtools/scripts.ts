// The devtools page is a registrar, not a surface. Nothing here is ever shown,
// so this file stays a plain script and the Vue app lives in the panel.
chrome.devtools.panels.create('Example', '', 'panel/index.html')
