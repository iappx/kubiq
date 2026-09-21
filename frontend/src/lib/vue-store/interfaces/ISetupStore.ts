export interface ISetupStore {
    setup(): Promise<void> | void
}