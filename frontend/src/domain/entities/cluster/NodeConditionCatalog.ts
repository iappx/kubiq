export class NodeConditionCatalog {
    public static readonly ready: string = 'Ready'

    public static readonly values: Record<string, string> = {
        Ready: 'Ready',
        MemoryPressure: 'Memory pressure',
        DiskPressure: 'Disk pressure',
        PIDPressure: 'PID pressure',
        NetworkUnavailable: 'Network unavailable',
    }

    // Every pressure condition reports trouble when it is True, unlike Ready.
    private static readonly pressure: string[] = ['MemoryPressure', 'DiskPressure', 'PIDPressure', 'NetworkUnavailable']

    public static title(type: string): string {
        return NodeConditionCatalog.values[type] ?? type
    }

    public static has(type: string): boolean {
        return Object.prototype.hasOwnProperty.call(NodeConditionCatalog.values, type)
    }

    public static pressureTypes(): string[] {
        return [...NodeConditionCatalog.pressure]
    }
}
