package main

import (
	"embed"
	_ "embed"
	"log"
	"sync"
	"time"

	"iappx_k8s_admin/core/services/channel"
	"iappx_k8s_admin/core/services/download"
	"iappx_k8s_admin/core/services/env"
	"iappx_k8s_admin/core/services/io"
	"iappx_k8s_admin/core/services/journal"
	"iappx_k8s_admin/core/services/kube"
	"iappx_k8s_admin/core/services/process"
	"iappx_k8s_admin/core/services/storage"
	"iappx_k8s_admin/core/tray"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/appicon.png
var trayIcon []byte

const (
	appDescription  = "Kubernetes cluster management console"
	windowWidth     = 1280
	windowHeight    = 800
	minWindowWidth  = 960
	minWindowHeight = 600
	revealFallback  = 3 * time.Second
)

func main() {
	kubeSessions := kube.NewSessionRegistry()
	userData := openUserData()
	appJournal := openJournal(userData)

	app := application.New(application.Options{
		Name:        appName,
		Description: appDescription,
		// Shutdown runs in reverse order: the stream service stops before the
		// sessions it streams over are closed.
		Services: []application.Service{
			application.NewService(&io.IoService{}),
			application.NewService(&env.EnvService{}),
			application.NewService(storage.NewStorageService(userData)),
			application.NewService(journal.NewJournalService(appJournal)),
			application.NewService(kube.NewConnectionService(kubeSessions)),
			application.NewService(kube.NewKubeService(kubeSessions)),
			application.NewService(channel.NewChannelService(kubeSessions)),
			application.NewService(process.NewProcessService()),
			application.NewService(download.NewDownloadService()),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	window := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:     appName,
		Width:     windowWidth,
		Height:    windowHeight,
		MinWidth:  minWindowWidth,
		MinHeight: minWindowHeight,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: application.NewRGB(21, 27, 30),
		URL:              "/",
		// The native background would flash before the page paints its splash in the stored theme.
		Hidden: true,
	})

	revealWhenLoaded(app, window)

	tray.New(app, window, appName, trayIcon).Setup()

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}

func revealWhenLoaded(app *application.App, window *application.WebviewWindow) {
	var reveal sync.Once
	show := func() { reveal.Do(func() { window.Show() }) }

	window.OnWindowEvent(events.Common.WindowRuntimeReady, func(*application.WindowEvent) { show() })

	// A page that never loads must not leave the window invisible.
	app.Event.OnApplicationEvent(events.Common.ApplicationStarted, func(*application.ApplicationEvent) {
		time.AfterFunc(revealFallback, show)
	})
}

func openUserData() *storage.Storage {
	userData, err := storage.Open()
	if err != nil {
		log.Printf("user data directory is unavailable: %v", err)
		return nil
	}

	if err := userData.Migrate(); err != nil {
		log.Printf("user data migration failed: %v", err)
	}

	return userData
}

func openJournal(userData *storage.Storage) *journal.Journal {
	if userData == nil {
		return nil
	}

	appJournal, err := journal.Open(journal.Options{Dir: userData.LogsDir()})
	if err != nil {
		log.Printf("application journal is unavailable: %v", err)
		return nil
	}

	journal.SetDefault(appJournal)
	journal.Record(journal.Entry{Level: journal.LevelInfo, Component: "app", Event: "start"})

	return appJournal
}
