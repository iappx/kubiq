// Must stay the first import, or the DI decorators lose their parameter metadata.
import 'reflect-metadata'
import { createPinia, setActivePinia } from 'pinia'

// @InjectableStore instantiates a store the moment its module is imported, so pinia
// has to be active before a spec's own imports run.
setActivePinia(createPinia())

// jsdom ships no matchMedia; the theme store reads it during setup.
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
