import EditorWorker from 'monaco-editor/editor/editor.worker?worker'

// The ?worker import puts the worker bundle in this module's chunk, so importing this
// module statically anywhere would download Monaco before a manifest is ever opened.
export class MonacoWorkers {
    public static register(): void {
        const environment = globalThis as unknown as { MonacoEnvironment?: unknown }

        environment.MonacoEnvironment = {
            getWorker(): Worker {
                return new EditorWorker()
            },
        }
    }
}
