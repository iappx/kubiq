import { KubeColumns } from '@/domain/models/kube/KubeColumns'
import { KubeResourceKind } from '@/domain/models/kube/KubeResourceKind'
import { KubeVerbCatalog } from '@/domain/models/kube/KubeVerbCatalog'

// Discovery decides which of these a cluster serves and with which verbs; these definitions
// only give the entity sets a registry key to be found by.
export class ArgoResourceKinds {
    public static readonly group: string = 'argoproj.io'

    public static readonly version: string = 'v1alpha1'

    public static readonly applicationsResource: string = 'applications'

    public static readonly appProjectsResource: string = 'appprojects'

    public static readonly applicationSetsResource: string = 'applicationsets'

    public static applications(): KubeResourceKind {
        return new KubeResourceKind({
            group: ArgoResourceKinds.group,
            version: ArgoResourceKinds.version,
            resource: ArgoResourceKinds.applicationsResource,
            kind: 'Application',
            title: 'Applications',
            namespaced: true,
            section: 'custom',
            icon: 'Rocket',
            verbs: KubeVerbCatalog.all(),
            isCustom: true,
            columns: [
                KubeColumns.objectName(),
                KubeColumns.namespace(),
                { key: 'project', title: 'Project' },
                { key: 'syncStatus', title: 'Sync' },
                { key: 'healthStatus', title: 'Health' },
                KubeColumns.age(),
            ],
        })
    }

    public static appProjects(): KubeResourceKind {
        return new KubeResourceKind({
            group: ArgoResourceKinds.group,
            version: ArgoResourceKinds.version,
            resource: ArgoResourceKinds.appProjectsResource,
            kind: 'AppProject',
            title: 'App Projects',
            namespaced: true,
            section: 'custom',
            icon: 'FolderGit2',
            verbs: KubeVerbCatalog.all(),
            isCustom: true,
            columns: [
                KubeColumns.objectName(),
                KubeColumns.namespace(),
                { key: 'description', title: 'Description' },
                KubeColumns.age(),
            ],
        })
    }

    public static applicationSets(): KubeResourceKind {
        return new KubeResourceKind({
            group: ArgoResourceKinds.group,
            version: ArgoResourceKinds.version,
            resource: ArgoResourceKinds.applicationSetsResource,
            kind: 'ApplicationSet',
            title: 'Application Sets',
            namespaced: true,
            section: 'custom',
            icon: 'Boxes',
            verbs: KubeVerbCatalog.all(),
            isCustom: true,
            columns: [
                KubeColumns.objectName(),
                KubeColumns.namespace(),
                { key: 'generatorsText', title: 'Generators' },
                KubeColumns.state(),
                KubeColumns.age(),
            ],
        })
    }
}
