// btoa/atob work on latin1, so the bytes are converted explicitly both ways.
export class Base64 {
    public static b64ToString(data: string): string {
        const binary = atob(data)
        const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
        return new TextDecoder().decode(bytes)
    }

    public static stringToB64(data: string): string {
        const bytes = new TextEncoder().encode(data)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i])
        }
        return btoa(binary)
    }
}
