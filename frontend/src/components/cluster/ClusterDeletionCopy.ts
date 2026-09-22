import type { TKubeconfigDeletion } from '@/store/modules/clusterCatalog/types/TKubeconfigDeletion'

export class ClusterDeletionCopy {
    public static titleOf(target: TKubeconfigDeletion | null): string {
        const names = target?.clusterNames ?? []

        if (names.length === 0) {
            return 'Remove kubeconfig'
        }

        return names.length === 1 ? `Delete cluster ${names[0]}` : `Delete ${names.length} clusters`
    }

    public static descriptionOf(target: TKubeconfigDeletion | null): string {
        return `${ClusterDeletionCopy.leaving(target)} ${ClusterDeletionCopy.fate(target)}`
    }

    private static leaving(target: TKubeconfigDeletion | null): string {
        const names = target?.clusterNames ?? []

        if (names.length === 0) {
            return 'No cluster in the catalog comes from this kubeconfig.'
        }

        if (names.length === 1) {
            return `${names[0]} leaves the catalog and its open session is closed.`
        }

        return `${names.join(', ')} leave the catalog and their open sessions are closed.`
    }

    private static fate(target: TKubeconfigDeletion | null): string {
        if (target?.origin === 'paste') {
            return 'The kubeconfig Kubiq saved from the text you pasted is deleted from this machine, '
                + 'so the connection details go with it. This cannot be undone.'
        }

        return `${target?.filePath ?? 'The kubeconfig'} stays on disk untouched — Kubiq only stops reading it.`
    }
}
