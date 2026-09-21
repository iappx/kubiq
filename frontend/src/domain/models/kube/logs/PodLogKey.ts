export class PodLogKey {
    public static readonly prefix: string = 'logs'

    public static readonly separator: string = '|'

    public static of(clusterId: string, namespace: string, podName: string, container: string): string {
        return [PodLogKey.prefix, clusterId, namespace, podName, container].join(PodLogKey.separator)
    }

    public static isLog(key: string): boolean {
        return key.startsWith(PodLogKey.prefix + PodLogKey.separator)
    }
}
