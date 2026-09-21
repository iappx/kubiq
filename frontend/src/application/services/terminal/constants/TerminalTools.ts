export class TerminalTools {
    public static readonly kubectl: string = 'kubectl'

    public static readonly kubectlDocs: string = 'https://kubernetes.io/docs/tasks/tools/'

    public static readonly kubectlMissing: string = 'kubectl was not found on this machine'

    public static readonly kubectlHelp: string =
        'kubiq does not ship kubectl. Install it, or set its full path in Settings under Command-line tools.'
}
