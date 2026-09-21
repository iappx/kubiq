package env

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestGetReturnsNamedVariable(t *testing.T) {
	t.Setenv("IAPPX_TEST_KUBECONFIG", "C:/clusters/config")

	service := &EnvService{}

	result := service.Get("IAPPX_TEST_KUBECONFIG")
	if !result.Success || result.Value != "C:/clusters/config" {
		t.Fatalf("unexpected result: %+v", result)
	}
}

func TestGetReportsMissingVariable(t *testing.T) {
	service := &EnvService{}

	missing := service.Get("IAPPX_TEST_DEFINITELY_UNSET")
	if missing.Success || missing.Error == "" {
		t.Fatalf("expected a failure, got %+v", missing)
	}

	empty := service.Get("   ")
	if empty.Success || empty.Error == "" {
		t.Fatalf("expected a failure, got %+v", empty)
	}
}

func TestUserHomeDirIsAbsolute(t *testing.T) {
	result := (&EnvService{}).UserHomeDir()

	if !result.Success {
		t.Fatalf("unexpected failure: %s", result.Error)
	}
	if !filepath.IsAbs(filepath.FromSlash(result.Value)) {
		t.Fatalf("expected an absolute path, got %q", result.Value)
	}
}

func TestPathSeparatorMatchesTheHost(t *testing.T) {
	result := (&EnvService{}).PathSeparator()

	if !result.Success || result.Value != string(os.PathListSeparator) {
		t.Fatalf("unexpected result: %+v", result)
	}
}

func TestExpandResolvesVariablesAndHome(t *testing.T) {
	t.Setenv("IAPPX_TEST_ROOT", "clusters")

	service := &EnvService{}
	home, err := os.UserHomeDir()
	if err != nil {
		t.Fatalf("home directory unavailable: %v", err)
	}

	percent := service.Expand("%IAPPX_TEST_ROOT%/config")
	if !percent.Success || !strings.HasSuffix(percent.Value, "clusters/config") {
		t.Fatalf("percent form was not expanded: %+v", percent)
	}

	dollar := service.Expand("$IAPPX_TEST_ROOT/config")
	if !dollar.Success || !strings.HasSuffix(dollar.Value, "clusters/config") {
		t.Fatalf("dollar form was not expanded: %+v", dollar)
	}

	tilde := service.Expand("~/.kube/config")
	if !tilde.Success {
		t.Fatalf("home form was not expanded: %s", tilde.Error)
	}
	expected := filepath.ToSlash(filepath.Join(home, ".kube/config"))
	if tilde.Value != expected {
		t.Fatalf("expected %q, got %q", expected, tilde.Value)
	}
}

func TestExpandLeavesNonVariablePercentsAlone(t *testing.T) {
	result := (&EnvService{}).Expand("C:/100%/reports")

	if !result.Success {
		t.Fatalf("unexpected failure: %s", result.Error)
	}
	if !strings.Contains(result.Value, "100%") {
		t.Fatalf("a literal percent was eaten: %q", result.Value)
	}
}

func TestExpandRejectsEmptyInput(t *testing.T) {
	result := (&EnvService{}).Expand("   ")

	if result.Success || result.Error == "" {
		t.Fatalf("expected a failure, got %+v", result)
	}
}

func TestExpandMakesRelativePathsAbsolute(t *testing.T) {
	result := (&EnvService{}).Expand("data/clusters.json")

	if !result.Success {
		t.Fatalf("unexpected failure: %s", result.Error)
	}
	if !filepath.IsAbs(filepath.FromSlash(result.Value)) {
		t.Fatalf("expected an absolute path, got %q", result.Value)
	}
}
