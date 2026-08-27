// The devtools page is a registrar, not a surface. Nothing here is ever shown,
// so the panel HTML is where the UI belongs.
chrome.devtools.panels.create('Example', '', 'panel/index.html')
