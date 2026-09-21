export class KubeSelectorPath {
    public static readonly metadata: string = 'metadata'

    public static readonly labels: string = 'labels'

    public static namePath(): string[] {
        return [KubeSelectorPath.metadata, 'name']
    }

    public static namespacePath(): string[] {
        return [KubeSelectorPath.metadata, 'namespace']
    }

    public static labelPath(key: string): string[] {
        return [KubeSelectorPath.metadata, KubeSelectorPath.labels, key]
    }

    public static isLabelPath(path: string[]): boolean {
        return path.length === 3 && path[0] === KubeSelectorPath.metadata && path[1] === KubeSelectorPath.labels
    }

    public static labelKey(path: string[]): string | undefined {
        return KubeSelectorPath.isLabelPath(path) ? path[2] : undefined
    }

    public static fieldName(path: string[]): string {
        return path.join('.')
    }
}
