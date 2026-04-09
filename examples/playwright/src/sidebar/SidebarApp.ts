function SidebarApp() {
  const root = document.getElementById('root')
  if (!root) return

  root.innerHTML = `
    <div class="sidebar_app">
      <h1 class="sidebar_title">Playwright Contract Example</h1>
      <p class="sidebar_description">
        This page is loaded by Playwright after waiting for
        <code>ready.json</code>.
      </p>
    </div>
  `
}

SidebarApp()
