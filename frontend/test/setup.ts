// Must stay the first import, or the DI decorators lose their parameter metadata.
import 'reflect-metadata'
import { createPinia, setActivePinia } from 'pinia'
import { afterAll } from 'vitest'

// @InjectableStore instantiates a store the moment its module is imported, so pinia
// has to be active before a spec's own imports run.
setActivePinia(createPinia())

// jsdom ships no matchMedia.
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    }),
})

// @wailsio/runtime's drag.js polls `window` 50 ms after import; a spec that ends sooner
// has jsdom torn down under that tick, which fails the run with "window is not defined".
afterAll(async () => {
    if ('_wails' in window) {
        await new Promise(resolve => setTimeout(resolve, 60))
    }
})
