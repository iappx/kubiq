export class MetricsObjectKey {
    public static of(namespace: string, name: string): string {
        return namespace === '' ? name : `${namespace}/${name}`
    }
}
