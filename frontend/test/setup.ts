// Mirrors the bootstrap order in src/main.ts: reflect-metadata must land first,
// or the DI decorators lose their parameter metadata.
import 'reflect-metadata'
import { createPinia, setActivePinia } from 'pinia'

// @InjectableStore instantiates a store the moment its module is imported, and
// that needs an active pinia. Tests that assert on store state should still
// call setActivePinia themselves to get a clean slate per test.
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
