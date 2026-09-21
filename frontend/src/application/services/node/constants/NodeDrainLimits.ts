export class NodeDrainLimits {
    public static readonly maxPods: number = 500

    public static readonly evictionApiVersion: string = 'policy/v1'

    public static readonly evictionKind: string = 'Eviction'

    public static readonly evictionSubresource: string = 'eviction'
}
