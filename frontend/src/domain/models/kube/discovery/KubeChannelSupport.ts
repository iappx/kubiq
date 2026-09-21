import { KubeServerVersion } from '@/domain/models/kube/discovery/KubeServerVersion'

export class KubeChannelSupport {
    public static readonly minimumMajor: number = 1

    public static readonly minimumMinor: number = 30

    public static readonly minimumText: string = '1.30'

    public static isSupported(version: KubeServerVersion): boolean {
        return version.atLeast(KubeChannelSupport.minimumMajor, KubeChannelSupport.minimumMinor)
    }

    public static reason(version: KubeServerVersion): string {
        if (KubeChannelSupport.isSupported(version)) {
            return ''
        }

        if (!version.isKnown) {
            return 'Kubiq could not read this cluster\'s version, so terminals and port forwarding stay off. '
                + `Check that your account may read /version, then reconnect — Kubernetes ${KubeChannelSupport.minimumText} or newer is required.`
        }

        return `Terminals and port forwarding need Kubernetes ${KubeChannelSupport.minimumText} or newer, and this cluster runs ${version.short}. `
            + 'Use kubectl exec and kubectl port-forward here, or ask your administrator to upgrade the cluster.'
    }
}
