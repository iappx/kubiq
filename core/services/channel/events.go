package channel

import "github.com/wailsapp/wails/v3/pkg/application"

type eventEmitter interface {
	Emit(name string, data any)
}

type wailsEmitter struct{}

func (wailsEmitter) Emit(name string, data any) {
	// application.Get() is nil until application.New has run: under tests and
	// during early startup an emit has to be a no-op rather than a panic.
	app := application.Get()
	if app == nil || app.Event == nil {
		return
	}

	app.Event.Emit(name, data)
}
