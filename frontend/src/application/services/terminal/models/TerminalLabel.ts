export class TerminalLabel {
    public static forPod(podName: string, container: string): string {
        return container === '' ? podName : `${podName}/${container}`
    }

    public static forNode(nodeName: string): string {
        return `node/${nodeName}`
    }

    public static forLocal(clusterId: string): string {
        return clusterId === '' ? 'Local shell' : `Shell: ${clusterId}`
    }
}
