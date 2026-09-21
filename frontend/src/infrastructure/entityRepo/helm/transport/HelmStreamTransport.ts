import { HelmCommand } from '@/domain/models/helm/HelmCommand'
import { HelmInvocationBase } from '@/infrastructure/entityRepo/helm/transport/base/HelmInvocationBase'
import { HelmOperationSink } from '@/infrastructure/entityRepo/helm/transport/HelmOperationSink'
import { HelmValuesFile } from '@/infrastructure/entityRepo/helm/transport/HelmValuesFile'
import type { IHelmOutputHandler } from '@/infrastructure/entityRepo/helm/transport/types/IHelmOutputHandler'
import type { THelmStreamRequest } from '@/infrastructure/entityRepo/helm/transport/types/THelmStreamRequest'
import type { ProcessRun } from '@/infrastructure/process/ProcessRun'

export class HelmStreamTransport extends HelmInvocationBase {
    public async run(request: THelmStreamRequest, handler: IHelmOutputHandler): Promise<ProcessRun> {
        const valuesPath = request.values === undefined ? '' : await HelmValuesFile.write(request.values)
        const args = valuesPath === ''
            ? [...request.args]
            : [...request.args, ...HelmCommand.valuesFile(valuesPath)]

        try {
            return await this.processes.start({
                command: this.environment.executable,
                args: this.argsOf(args),
                env: this.env(),
            }, new HelmOperationSink(handler, valuesPath))
        } catch (err) {
            await HelmValuesFile.remove(valuesPath)
            throw err
        }
    }
}
