import {createApp} from 'vue'
import {initializeImageMagick, Magick} from '@imagemagick/magick-wasm'
import NewTabApp from './NewTabApp.vue'
import router from './router'
import magickWasmUrl from '@imagemagick/magick-wasm/magick.wasm'
import './styles.css'

const fontUrl = new URL('./assets/fonts/Hack-Regular.ttf', import.meta.url)

const readBundled = async (url: string | URL): Promise<Uint8Array> => {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to load ${response.url}: ${response.status}`)
  }

  return new Uint8Array(await response.arrayBuffer())
}

const bootstrap = async () => {
  const root = document.querySelector('#app')

  try {
    // Pass bytes. initializeImageMagick() rejects chrome-extension: URLs,
    // and the wasm file is the copy the bundler emitted from the package.
    await initializeImageMagick(await readBundled(magickWasmUrl))
    Magick.addFont('Hack', await readBundled(fontUrl))
    createApp(NewTabApp).use(router).mount('#app')
  } catch (error) {
    console.error('Failed to initialize ImageMagick.wasm', error)

    if (root) {
      root.textContent =
        error instanceof Error
          ? error.message
          : 'Failed to initialize ImageMagick.'
    }
  }
}

bootstrap()
