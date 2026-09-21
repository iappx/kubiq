export interface IHelmOutputHandler {
    onOutput(text: string, isError: boolean): void

    onExit(code: number): void
}
