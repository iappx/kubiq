import { PodShellCommand } from '@/domain/models/terminal/PodShellCommand'

export class NodeShellCommand {
    public static readonly namespaces: readonly string[] = ['--mount', '--uts', '--ipc', '--net', '--pid']

    public static argv(): string[] {
        return ['nsenter', '--target', '1', ...NodeShellCommand.namespaces, '--', '/bin/sh', '-c', PodShellCommand.script()]
    }
}
