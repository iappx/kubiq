export class PortForwardKey {
    public static readonly prefix: string = 'forwards'

    public static readonly separator: string = '|'

    public static of(clusterId: string): string {
        return [PortForwardKey.prefix, clusterId].join(PortForwardKey.separator)
    }

    public static isPortForward(key: string): boolean {
        return key.startsWith(PortForwardKey.prefix + PortForwardKey.separator)
    }

    public static clusterOf(key: string): string {
        return PortForwardKey.isPortForward(key) ? key.split(PortForwardKey.separator)[1] ?? '' : ''
    }
}
