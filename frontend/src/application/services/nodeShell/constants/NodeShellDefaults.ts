export class NodeShellDefaults {
    public static readonly namespace: string = 'kube-system'

    public static readonly containerName: string = 'shell'

    public static readonly managedByLabel: string = 'app.kubernetes.io/managed-by'

    public static readonly managedByValue: string = 'kubiq'

    public static readonly componentLabel: string = 'kubiq.dev/component'

    public static readonly componentValue: string = 'node-shell'

    public static readonly nodeLabel: string = 'kubiq.dev/node'

    public static readonly maxNameLength: number = 63

    public static readonly deadlineSeconds: number = 12 * 60 * 60

    public static readonly readyTimeoutMs: number = 60_000

    public static readonly pollIntervalMs: number = 700
}
