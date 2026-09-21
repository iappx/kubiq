export class HelmCommand {
    public static readonly executable: string = 'helm'

    public static readonly kubeconfigVariable: string = 'KUBECONFIG'

    public static version(): string[] {
        return ['version', '--short']
    }

    public static list(): string[] {
        return ['list', ...HelmCommand.json()]
    }

    public static history(name: string, max: number): string[] {
        return ['history', name, '--max', String(max), ...HelmCommand.json()]
    }

    public static values(name: string, computed: boolean): string[] {
        const args = ['get', 'values', name, '--output', 'yaml']

        return computed ? [...args, '--all'] : args
    }

    public static manifest(name: string): string[] {
        return ['get', 'manifest', name]
    }

    public static notes(name: string): string[] {
        return ['get', 'notes', name]
    }

    public static repositories(): string[] {
        return ['repo', 'list', ...HelmCommand.json()]
    }

    public static addRepository(name: string, url: string): string[] {
        return ['repo', 'add', name, url, '--force-update']
    }

    public static removeRepository(name: string): string[] {
        return ['repo', 'remove', name]
    }

    public static updateRepositories(): string[] {
        return ['repo', 'update']
    }

    public static search(keyword: string, allVersions: boolean): string[] {
        const args = ['search', 'repo', ...HelmCommand.json()]
        const scoped = keyword === '' ? args : [...args, keyword]

        return allVersions ? [...scoped, '--versions'] : scoped
    }

    public static showReadme(chart: string, version: string): string[] {
        return ['show', 'readme', chart, ...HelmCommand.chartVersion(version)]
    }

    public static showValues(chart: string, version: string): string[] {
        return ['show', 'values', chart, ...HelmCommand.chartVersion(version)]
    }

    public static install(releaseName: string, chart: string, version: string, createNamespace: boolean): string[] {
        const args = ['install', releaseName, chart, ...HelmCommand.chartVersion(version)]

        return createNamespace ? [...args, '--create-namespace'] : args
    }

    public static upgrade(releaseName: string, chart: string, version: string, reuseValues: boolean): string[] {
        const args = ['upgrade', releaseName, chart, ...HelmCommand.chartVersion(version)]

        return reuseValues ? [...args, '--reuse-values'] : [...args, '--reset-values']
    }

    public static uninstall(releaseName: string, keepHistory: boolean): string[] {
        const args = ['uninstall', releaseName]

        return keepHistory ? [...args, '--keep-history'] : args
    }

    public static rollback(releaseName: string, revision: number): string[] {
        return ['rollback', releaseName, String(revision)]
    }

    public static context(contextName: string): string[] {
        return contextName === '' ? [] : ['--kube-context', contextName]
    }

    public static namespace(namespace: string): string[] {
        return namespace === '' ? [] : ['--namespace', namespace]
    }

    public static allNamespaces(): string[] {
        return ['--all-namespaces']
    }

    public static includeSuperseded(): string[] {
        return ['--all']
    }

    public static filter(pattern: string): string[] {
        return ['--filter', pattern]
    }

    public static limit(value: number): string[] {
        return ['--max', String(value)]
    }

    public static offset(value: number): string[] {
        return ['--offset', String(value)]
    }

    public static byDate(): string[] {
        return ['--date']
    }

    public static reverse(): string[] {
        return ['--reverse']
    }

    public static valuesFile(path: string): string[] {
        return ['--values', path]
    }

    public static json(): string[] {
        return ['--output', 'json']
    }

    public static literal(text: string): string {
        return text.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
    }

    private static chartVersion(version: string): string[] {
        return version === '' ? [] : ['--version', version]
    }
}
