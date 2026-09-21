import { inject, singleton } from 'tsyringe'
import { ChartTokens } from '@/application/services/chart/constants/ChartTokens'
import { ChartTheme } from '@/application/services/chart/models/ChartTheme'
import type { TChartApi } from '@/application/services/chart/types/TChartApi'
import type { TChartTheme } from '@/application/services/chart/types/TChartTheme'
import { CssTokenAdapter } from '@/infrastructure/theme/CssTokenAdapter'

// uPlot is loaded on demand for the same reason Monaco is: nothing on the startup
// path draws a chart, and a static import would put it in the entry chunk.
@singleton()
export class ChartService {
    private loading: Promise<TChartApi> | null = null

    constructor(
        @inject(CssTokenAdapter) private readonly tokens: CssTokenAdapter,
    ) {}

    public load(): Promise<TChartApi> {
        if (!this.loading) {
            this.loading = import('uplot').then(module => module.default)
        }

        return this.loading
    }

    public theme(): TChartTheme {
        return ChartTheme.build(this.tokens.read(ChartTokens.all()))
    }
}
