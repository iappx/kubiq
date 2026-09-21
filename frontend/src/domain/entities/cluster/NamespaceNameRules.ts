export class NamespaceNameRules {
    public static readonly maxLength: number = 63

    public static readonly reservedPrefix: string = 'kube-'

    // DNS-1123 label, which is what the API server enforces on a namespace name.
    private static readonly pattern: RegExp = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/

    public static isValid(name: string): boolean {
        return name.length > 0
            && name.length <= NamespaceNameRules.maxLength
            && NamespaceNameRules.pattern.test(name)
    }

    public static isReserved(name: string): boolean {
        return name.startsWith(NamespaceNameRules.reservedPrefix)
    }
}
