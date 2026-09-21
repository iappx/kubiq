import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import YamlWorker from 'monaco-yaml/yaml.worker?worker'
import { MonacoEditorDefaults } from '@/application/services/monacoEditor/constants/MonacoEditorDefaults'

// The ?worker imports put both worker bundles in this module's chunk, so importing this
// module statically anywhere would download Monaco before a manifest is ever opened.
export class MonacoWorkers {
    public static register(): void {
        const environment = globalThis as unknown as { MonacoEnvironment?: unknown }

        environment.MonacoEnvironment = {
            getWorker(moduleId: string, label: string): Worker {
                return label === MonacoEditorDefaults.language ? new YamlWorker() : new EditorWorker()
            },
        }
    }
}
