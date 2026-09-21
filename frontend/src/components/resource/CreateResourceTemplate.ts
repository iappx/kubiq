import type { KubeResourceKind } from '@/domain/models/kube'

export class CreateResourceTemplate {
    public static of(kind: KubeResourceKind | null, namespace: string): string {
        const lines = [
            `apiVersion: ${kind?.apiVersion ?? ''}`,
            `kind: ${kind?.kind ?? ''}`,
            'metadata:',
            '  name: ',
        ]

        if (namespace !== '' && kind?.namespaced !== false) {
            lines.push(`  namespace: ${namespace}`)
        }

        return `${lines.join('\n')}\n`
    }
}
