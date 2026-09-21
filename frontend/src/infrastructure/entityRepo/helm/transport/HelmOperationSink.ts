import { HelmValuesFile } from '@/infrastructure/entityRepo/helm/transport/HelmValuesFile'
import type { IHelmOutputHandler } from '@/infrastructure/entityRepo/helm/transport/types/IHelmOutputHandler'
import type { IProcessSink } from '@/infrastructure/process/types/IProcessSink'

export class HelmOperationSink implements IProcessSink {
    constructor(
        private readonly handler: IHelmOutputHandler,
        private readonly valuesPath: string,
    ) {}

    public onOutput(text: string, isError: boolean): void {
        this.handler.onOutput(text, isError)
    }

    public onExit(code: number): void {
        void HelmValuesFile.remove(this.valuesPath)
        this.handler.onExit(code)
    }
}
