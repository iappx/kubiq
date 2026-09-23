export class UpdateInstaller {
    // `/relaunch` is ours: build/windows/nsis/project.nsi starts kubiq again once the silent install ends.
    public static readonly args: readonly string[] = ['/S', '/relaunch']

    public static readonly uninstaller: string = 'uninstall.exe'
}
