import { stringify } from 'yaml'
import type { TKubeconfigOverlay } from '@/application/services/localShell/types/TKubeconfigOverlay'

export class KubeconfigOverlay {
    public static readonly directory: string = 'userdata:shell'

    public static readonly prefix: string = 'kubiq'

    public static pathFor(clusterId: string): string {
        const slug = clusterId.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'context'

        return `${KubeconfigOverlay.directory}/${slug}.kubeconfig`
    }

    public static contextNameFor(contextName: string): string {
        return `${KubeconfigOverlay.prefix}-${contextName}`
    }

    // The file carries names only — no credentials — and wins on merge because it is
    // first in KUBECONFIG, so the shell opens on the cluster the window is showing.
    public static document(overlay: TKubeconfigOverlay): string {
        return stringify(KubeconfigOverlay.body(overlay))
    }

    private static body(overlay: TKubeconfigOverlay): Record<string, unknown> {
        const base = { apiVersion: 'v1', kind: 'Config' }

        if (overlay.namespace === '' || overlay.clusterName === '' || overlay.userName === '') {
            return { ...base, 'current-context': overlay.contextName }
        }

        const name = KubeconfigOverlay.contextNameFor(overlay.contextName)

        return {
            ...base,
            'current-context': name,
            contexts: [{
                name,
                context: {
                    cluster: overlay.clusterName,
                    user: overlay.userName,
                    namespace: overlay.namespace,
                },
            }],
        }
    }
}
