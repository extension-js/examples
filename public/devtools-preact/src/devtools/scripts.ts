// The devtools page is a registrar, not a surface. Nothing here is ever shown,
// so there is no Preact app on this page: the UI belongs in the panel.
chrome.devtools.panels.create('Example', '', 'panel/index.html')
