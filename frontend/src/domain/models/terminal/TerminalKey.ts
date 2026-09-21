export class TerminalKey {
    public static readonly prefix: string = 'term'

    public static readonly separator: string = '|'

    public static of(clusterId: string, id: string): string {
        return [TerminalKey.prefix, clusterId, id].join(TerminalKey.separator)
    }

    public static isTerminal(key: string): boolean {
        return key.startsWith(TerminalKey.prefix + TerminalKey.separator)
    }

    public static clusterOf(key: string): string {
        return TerminalKey.isTerminal(key) ? key.split(TerminalKey.separator)[1] ?? '' : ''
    }
}
