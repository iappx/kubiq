import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { container } from 'tsyringe'
import App from './App.vue'
import i18n from './locale'
import { createComponentRouter } from '@/router'
import { DiTokens } from '@/constants/DiTokens'
import { Constructor } from '@/lib/types/Constructor'
import { EventBus } from '@/infrastructure/eventBus/EventBus'
import { AppErrorEvent } from '@/domain/events/app/AppErrorEvent'

export class AppBootstrap {
    public static async createApp(): Promise<void> {
        const pinia = createPinia()
        const app = createApp(App)

        // Must precede anything that resolves a store: the handlers below inject them.
        app.use(pinia)

        AppBootstrap.registerHandlers()
        AppBootstrap.catchUnhandledErrors()

        const router = await createComponentRouter()
        container.register(DiTokens.Router, { useValue: router })

        app.use(i18n)
        app.use(router)
        app.mount('#app')
    }

    private static registerHandlers(): void {
        const modules = import.meta.glob('./application/handlers/**/*Handler.ts', { eager: true })

        const handlers = Object.values(modules)
            .flatMap(module => Object.values(module as Record<string, unknown>))
            .filter((exported): exported is Constructor<unknown> => typeof exported === 'function')

        if (handlers.length === 0) {
            throw new Error('No event handlers matched ./application/handlers/**/*Handler.ts')
        }

        handlers.forEach(handler => container.resolve(handler))
    }

    private static catchUnhandledErrors(): void {
        const eventBus = container.resolve(EventBus)

        window.addEventListener('unhandledrejection', event => {
            eventBus.emitEvent(new AppErrorEvent(event.reason, 'unhandledrejection'))
        })

        window.addEventListener('error', event => {
            eventBus.emitEvent(new AppErrorEvent(event.error ?? event.message, 'window.error'))
        })
    }
}
