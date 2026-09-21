import { QueryStringRequestFactory } from '@iappx/entity-repo-rest'
import type { IRequestFactory, TRequestContext, TRestRequest } from '@iappx/entity-repo-rest'

export class KubePatchRequestFactory implements IRequestFactory {
    public static readonly mergePatchType: string = 'application/merge-patch+json'

    private readonly factory: IRequestFactory = new QueryStringRequestFactory()

    public create(context: TRequestContext): TRestRequest {
        const request = this.factory.create(context)
        if (context.kind !== 'patch') {
            return request
        }

        // The API server reads the patch kind off the content type and refuses a
        // plain application/json.
        return { ...request, headers: { ...request.headers, 'content-type': KubePatchRequestFactory.mergePatchType } }
    }
}
