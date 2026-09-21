export class PodShellCommand {
    public static readonly shells: readonly string[] = ['bash', 'sh']

    public static readonly missing: string = 'No shell was found in this container'

    public static argv(): string[] {
        return ['/bin/sh', '-c', PodShellCommand.script()]
    }

    public static script(): string {
        return `for candidate in ${PodShellCommand.shells.join(' ')}; do`
            + ' command -v "$candidate" >/dev/null 2>&1 && exec "$candidate"; done;'
            + ` echo "${PodShellCommand.missing}" >&2; exit 127`
    }
}
