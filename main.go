package main

import (
	"embed"
	_ "embed"
	"log"

	"iappx_k8s_admin/core/services/channel"
	"iappx_k8s_admin/core/services/env"
	"iappx_k8s_admin/core/services/io"
	"iappx_k8s_admin/core/services/kube"
	"iappx_k8s_admin/core/services/process"
	"iappx_k8s_admin/core/tray"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// The frontend build output is embedded into the binary, so a release build is a
// single self-contained executable. See https://pkg.go.dev/embed.
//
//go:embed all:frontend/dist
var assets embed.FS

// trayIcon is the icon shown in the system tray when the app is minimised to it.
//
//go:embed build/appicon.png
var trayIcon []byte

const (
	appName        = "kubiq"
	appDescription = "Kubernetes cluster management console"
	windowWidth    = 1280
	windowHeight   = 800
	minWindowWidth = 960
	minWindowHeight = 600
)

func main() {
	// Services listed here are bound into the frontend: every exported method
	// becomes a typed TS function under frontend/bindings after
	// `wails3 generate bindings`. Add your own services alongside IoService.
	kubeSessions := kube.NewSessionRegistry()

	app := application.New(application.Options{
		Name:        appName,
		Description: appDescription,
		// Shutdown runs in reverse order: the stream service stops before the
		// sessions it streams over are closed.
		Services: []application.Service{
			application.NewService(&io.IoService{}),
			application.NewService(&env.EnvService{}),
			application.NewService(kube.NewConnectionService(kubeSessions)),
			application.NewService(kube.NewKubeService(kubeSessions)),
			application.NewService(channel.NewChannelService(kubeSessions)),
			application.NewService(process.NewProcessService()),
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
		BackgroundColour: application.NewRGB(255, 255, 255),
		URL:              "/",
	})

	// Keep the app resident in the system tray: closing the window hides it
	// instead of terminating the process. Quit from the tray menu to exit.
	// Drop this line if the app should quit when its window is closed.
	tray.New(app, window, appName, trayIcon).Setup()

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
