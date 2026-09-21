import { YamlDiffLimits } from '@/application/services/resourceYaml/constants/YamlDiffLimits'
import { YamlDocument } from '@/application/services/resourceYaml/models/YamlDocument'
import type { TYamlDiffLine } from '@/application/services/resourceYaml/types/TYamlDiffLine'
import type { TYamlDiffSummary } from '@/application/services/resourceYaml/types/TYamlDiffSummary'

export class YamlDiff {
    public static of(left: string, right: string): TYamlDiffLine[] {
        return YamlDiff.compare(YamlDocument.lines(left), YamlDocument.lines(right))
    }

    public static compare(left: readonly string[], right: readonly string[]): TYamlDiffLine[] {
        const head = YamlDiff.commonPrefix(left, right)
        const tail = YamlDiff.commonSuffix(left, right, head)

        const lines: TYamlDiffLine[] = []
        for (let i = 0; i < head; i++) {
            lines.push(YamlDiff.line('context', left[i], i + 1, i + 1))
        }

        YamlDiff.alignMiddle(left, right, head, tail).forEach(line => lines.push(line))

        for (let i = 0; i < tail; i++) {
            const leftNumber = left.length - tail + i + 1
            lines.push(YamlDiff.line('context', left[leftNumber - 1], leftNumber, right.length - tail + i + 1))
        }

        return lines
    }

    public static summary(lines: readonly TYamlDiffLine[]): TYamlDiffSummary {
        return {
            added: lines.filter(line => line.kind === 'added').length,
            removed: lines.filter(line => line.kind === 'removed').length,
        }
    }

    public static hasChanges(lines: readonly TYamlDiffLine[]): boolean {
        return lines.some(line => line.kind === 'added' || line.kind === 'removed')
    }

    public static touchedLines(lines: readonly TYamlDiffLine[]): number[] {
        const touched = new Set<number>()

        lines.forEach((line, index) => {
            if (line.kind === 'added') {
                touched.add(line.rightNumber)
                return
            }
            if (line.kind !== 'removed') {
                return
            }
            // A removal has no line of its own on the right, so it is marked on the
            // line that now stands where it used to be.
            const anchor = YamlDiff.nextRightNumber(lines, index)
            if (anchor > 0) {
                touched.add(anchor)
            }
        })

        return [...touched].sort((a, b) => a - b)
    }

    public static condense(
        lines: readonly TYamlDiffLine[],
        context: number = YamlDiffLimits.contextLines,
    ): TYamlDiffLine[] {
        const keep = new Set<number>()
        lines.forEach((line, index) => {
            if (line.kind === 'context') {
                return
            }
            for (let at = index - context; at <= index + context; at++) {
                if (at >= 0 && at < lines.length) {
                    keep.add(at)
                }
            }
        })

        const condensed: TYamlDiffLine[] = []
        let skipping = false

        lines.forEach((line, index) => {
            if (keep.has(index)) {
                condensed.push(line)
                skipping = false
                return
            }
            if (!skipping) {
                condensed.push(YamlDiff.line('gap', '', 0, 0))
                skipping = true
            }
        })

        return condensed
    }

    private static alignMiddle(
        left: readonly string[],
        right: readonly string[],
        head: number,
        tail: number,
    ): TYamlDiffLine[] {
        const leftMiddle = left.slice(head, left.length - tail)
        const rightMiddle = right.slice(head, right.length - tail)

        if (leftMiddle.length === 0 && rightMiddle.length === 0) {
            return []
        }

        const aligned = YamlDiff.isAlignable(leftMiddle.length, rightMiddle.length)
            ? YamlDiff.longestCommon(leftMiddle, rightMiddle)
            : []

        return YamlDiff.walk(leftMiddle, rightMiddle, aligned, head)
    }

    private static isAlignable(leftLength: number, rightLength: number): boolean {
        return leftLength <= YamlDiffLimits.maxAlignedLines && rightLength <= YamlDiffLimits.maxAlignedLines
    }

    private static walk(
        left: readonly string[],
        right: readonly string[],
        common: readonly number[][],
        offset: number,
    ): TYamlDiffLine[] {
        const lines: TYamlDiffLine[] = []
        let leftAt = 0
        let rightAt = 0

        const emit = (untilLeft: number, untilRight: number): void => {
            while (leftAt < untilLeft) {
                lines.push(YamlDiff.line('removed', left[leftAt], offset + leftAt + 1, 0))
                leftAt++
            }
            while (rightAt < untilRight) {
                lines.push(YamlDiff.line('added', right[rightAt], 0, offset + rightAt + 1))
                rightAt++
            }
        }

        common.forEach((pair) => {
            emit(pair[0], pair[1])
            lines.push(YamlDiff.line('context', left[leftAt], offset + leftAt + 1, offset + rightAt + 1))
            leftAt++
            rightAt++
        })
        emit(left.length, right.length)

        return lines
    }

    // The table is quadratic, and what keeps it small is that the caller has
    // already stripped the common prefix and suffix before getting here.
    private static longestCommon(left: readonly string[], right: readonly string[]): number[][] {
        const rows = left.length
        const columns = right.length
        const table: number[][] = Array.from({ length: rows + 1 }, () => new Array<number>(columns + 1).fill(0))

        for (let i = rows - 1; i >= 0; i--) {
            for (let j = columns - 1; j >= 0; j--) {
                table[i][j] = left[i] === right[j]
                    ? table[i + 1][j + 1] + 1
                    : Math.max(table[i + 1][j], table[i][j + 1])
            }
        }

        const pairs: number[][] = []
        let i = 0
        let j = 0
        while (i < rows && j < columns) {
            if (left[i] === right[j]) {
                pairs.push([i, j])
                i++
                j++
            } else if (table[i + 1][j] >= table[i][j + 1]) {
                i++
            } else {
                j++
            }
        }

        return pairs
    }

    private static commonPrefix(left: readonly string[], right: readonly string[]): number {
        const limit = Math.min(left.length, right.length)
        let count = 0
        while (count < limit && left[count] === right[count]) {
            count++
        }

        return count
    }

    private static commonSuffix(left: readonly string[], right: readonly string[], head: number): number {
        const limit = Math.min(left.length, right.length) - head
        let count = 0
        while (count < limit && left[left.length - 1 - count] === right[right.length - 1 - count]) {
            count++
        }

        return count
    }

    private static nextRightNumber(lines: readonly TYamlDiffLine[], from: number): number {
        for (let at = from + 1; at < lines.length; at++) {
            if (lines[at].rightNumber > 0) {
                return lines[at].rightNumber
            }
        }

        return 0
    }

    private static line(
        kind: TYamlDiffLine['kind'],
        text: string,
        leftNumber: number,
        rightNumber: number,
    ): TYamlDiffLine {
        return { kind, text, leftNumber, rightNumber }
    }
}
