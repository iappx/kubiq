export class TerminalBytes {
    public static decode(data: string): Uint8Array {
        if (data === '') {
            return new Uint8Array(0)
        }

        const binary = atob(data)
        return Uint8Array.from(binary, character => character.charCodeAt(0))
    }

    public static encode(data: Uint8Array): string {
        let binary = ''
        for (let index = 0; index < data.length; index++) {
            binary += String.fromCharCode(data[index])
        }

        return btoa(binary)
    }

    public static fromText(text: string): Uint8Array {
        return new TextEncoder().encode(text)
    }

    public static concat(chunks: readonly Uint8Array[]): Uint8Array {
        const total = chunks.reduce((size, chunk) => size + chunk.length, 0)
        const joined = new Uint8Array(total)

        let offset = 0
        for (const chunk of chunks) {
            joined.set(chunk, offset)
            offset += chunk.length
        }

        return joined
    }
}
