import { PodLogAnsi } from '@/components/logs/PodLogAnsi'
import type { TPodLogSegment } from '@/components/logs/types/TPodLogSegment'

export class PodLogHighlighter {
    public static matches(text: string, query: string): boolean {
        if (query === '') {
            return true
        }

        // Stripped first, or a search for "32" would match the colour code every line carries.
        const plain = PodLogAnsi.strip(text)

        return PodLogHighlighter.haystack(plain).includes(PodLogHighlighter.needle(plain, query))
    }

    public static count(lines: readonly string[], query: string): number {
        if (query === '') {
            return 0
        }

        return lines.reduce((total, line) => (PodLogHighlighter.matches(line, query) ? total + 1 : total), 0)
    }

    public static segments(text: string, query: string): TPodLogSegment[] {
        if (query === '' || text === '') {
            return [{ text, match: false }]
        }

        const haystack = PodLogHighlighter.haystack(text)
        const needle = PodLogHighlighter.needle(text, query)
        const segments: TPodLogSegment[] = []

        let from = 0
        let at = haystack.indexOf(needle, from)

        while (at !== -1 && needle !== '') {
            if (at > from) {
                segments.push({ text: text.slice(from, at), match: false })
            }
            segments.push({ text: text.slice(at, at + needle.length), match: true })
            from = at + needle.length
            at = haystack.indexOf(needle, from)
        }

        if (from < text.length) {
            segments.push({ text: text.slice(from), match: false })
        }

        return segments.length === 0 ? [{ text, match: false }] : segments
    }

    // Lower-casing changes the length of a few characters, and indexes from a shifted string slice the original wrongly.
    protected static haystack(text: string): string {
        const lowered = text.toLowerCase()

        return lowered.length === text.length ? lowered : text
    }

    protected static needle(text: string, query: string): string {
        return text.toLowerCase().length === text.length ? query.toLowerCase() : query
    }
}
