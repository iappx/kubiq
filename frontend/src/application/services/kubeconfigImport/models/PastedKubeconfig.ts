import { YamlDocument } from '@/application/services/resourceYaml/models/YamlDocument'

export class PastedKubeconfig {
    public static readonly directory: string = 'userdata:kubeconfigs'

    public static readonly empty: string = 'Paste the contents of a kubeconfig file'

    public static readonly notYaml: string = 'That is not valid YAML — paste a whole kubeconfig file'

    public static readonly fallbackName: string = 'kubeconfig'

    private static readonly nameLimit: number = 48

    public static problemWith(text: string): string {
        if (text.trim() === '') {
            return PastedKubeconfig.empty
        }

        const document = PastedKubeconfig.documentOf(text)
        if (!document) {
            return PastedKubeconfig.notYaml
        }

        const missing = ['clusters', 'contexts'].filter(section => !PastedKubeconfig.lists(document, section))
        if (missing.length === 0) {
            return ''
        }

        return `A kubeconfig lists clusters and contexts — this text has no ${missing.join(' and no ')}`
    }

    public static pathFor(text: string): string {
        const name = PastedKubeconfig.slugOf(PastedKubeconfig.nameOf(text))

        return `${PastedKubeconfig.directory}/${name}-${PastedKubeconfig.fingerprintOf(text)}.yaml`
    }

    private static documentOf(text: string): Record<string, unknown> | null {
        const parsed = YamlDocument.tryParse(text)

        // Only the verdict leaves this class: the parser quotes the offending source
        // line, and in a kubeconfig that line can hold a token or a private key.
        return parsed.error === '' ? parsed.document : null
    }

    private static lists(document: Record<string, unknown>, section: string): boolean {
        const value = document[section]

        return Array.isArray(value) && value.length > 0
    }

    private static nameOf(text: string): string {
        const document = PastedKubeconfig.documentOf(text)
        if (!document) {
            return ''
        }

        const current = document['current-context']
        if (typeof current === 'string' && current.trim() !== '') {
            return current
        }

        return PastedKubeconfig.firstContextName(document)
    }

    private static firstContextName(document: Record<string, unknown>): string {
        const contexts = Array.isArray(document.contexts) ? document.contexts : []

        for (const entry of contexts) {
            const name = (entry as { name?: unknown })?.name
            if (typeof name === 'string' && name.trim() !== '') {
                return name
            }
        }

        return ''
    }

    private static slugOf(name: string): string {
        const slug = name
            .replace(/[^a-zA-Z0-9._-]+/g, '-')
            .slice(0, PastedKubeconfig.nameLimit)
            .replace(/^[-.]+|[-.]+$/g, '')

        return slug || PastedKubeconfig.fallbackName
    }

    private static fingerprintOf(text: string): string {
        // FNV-1a offset basis and prime.
        let hash = 0x811c9dc5

        for (let index = 0; index < text.length; index++) {
            hash ^= text.charCodeAt(index)
            hash = Math.imul(hash, 0x01000193)
        }

        return (hash >>> 0).toString(36)
    }
}
