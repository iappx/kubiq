export class YamlDiffLimits {
    public static readonly contextLines: number = 3

    // The alignment table is quadratic, so longer documents are shown as one replaced block.
    public static readonly maxAlignedLines: number = 1200
}
