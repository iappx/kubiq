export class PodLogArchive {
    public static readonly directory: string = 'userdata:logs'

    public static readonly extension: string = '.log'

    public static pathFor(namespace: string, podName: string, container: string, at: Date): string {
        const parts = [namespace, podName, container]
            .map(part => PodLogArchive.safe(part))
            .filter(part => part !== '')

        return `${PodLogArchive.directory}/${parts.join('_')}_${PodLogArchive.stamp(at)}${PodLogArchive.extension}`
    }

    public static stamp(at: Date): string {
        const pad = (value: number) => String(value).padStart(2, '0')

        return [
            at.getFullYear(),
            pad(at.getMonth() + 1),
            pad(at.getDate()),
        ].join('') + '-' + [
            pad(at.getHours()),
            pad(at.getMinutes()),
            pad(at.getSeconds()),
        ].join('')
    }

    private static safe(part: string): string {
        return part.replace(/[^a-zA-Z0-9._-]/g, '-')
    }
}
