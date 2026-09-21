import { inject, singleton } from 'tsyringe'
import { MonacoEditorService } from '@/application/services/monacoEditor/MonacoEditorService'
import { ThemeChangedEvent } from '@/domain/events/app/ThemeChangedEvent'
import { EventBus } from '@/infrastructure/eventBus/EventBus'

@singleton()
export class EditorThemeHandler {
    constructor(
        @inject(EventBus) private readonly eventBus: EventBus,
        @inject(MonacoEditorService) private readonly editorService: MonacoEditorService,
    ) {
        this.eventBus.registerHandler(ThemeChangedEvent, () => this.editorService.applyTheme())
    }
}
