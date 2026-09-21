export class UiKeyboard {
    public static isTyping(target: EventTarget | null): boolean {
        const element = target as HTMLElement | null
        if (!element || typeof element.tagName !== 'string') {
            return false
        }

        const tag = element.tagName
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable === true
    }
}
