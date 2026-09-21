package journal

import (
	"net/url"
	"regexp"
	"strings"
	"time"
	"unicode"
)

const (
	LevelDebug = "debug"
	LevelInfo  = "info"
	LevelWarn  = "warn"
	LevelError = "error"
)

const (
	dropped = "[dropped]"
	invalid = "[invalid]"

	maxWordRunes  = 64
	maxMixedRun   = 20
	maxLetterRun  = 40
	maxNameRunes  = 48
	maxSessionLen = 64
	maxPathRunes  = 512
	maxTextRunes  = 512
	maxTraceLines = 24
)

var (
	allowedLevels = map[string]struct{}{
		LevelDebug: {},
		LevelInfo:  {},
		LevelWarn:  {},
		LevelError: {},
	}

	allowedMethods = map[string]struct{}{
		"GET":     {},
		"HEAD":    {},
		"POST":    {},
		"PUT":     {},
		"PATCH":   {},
		"DELETE":  {},
		"OPTIONS": {},
		"CONNECT": {},
		"TRACE":   {},
	}

	namePattern    = regexp.MustCompile(`^[a-z][a-z0-9]*([.\-][a-z0-9]+)*$`)
	sessionPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]*$`)
	framePattern   = regexp.MustCompile(`:\d+`)
)

// Adding a field here widens what the journal is able to write: there is no
// other way for a value to reach the file.
type line struct {
	Time      string `json:"time"`
	Level     string `json:"level"`
	Component string `json:"component,omitempty"`
	Event     string `json:"event,omitempty"`
	Method    string `json:"method,omitempty"`
	Path      string `json:"path,omitempty"`
	Status    int    `json:"status,omitempty"`
	Session   string `json:"session,omitempty"`
	Duration  int64  `json:"durationMs,omitempty"`
	Message   string `json:"message,omitempty"`
	Trace     string `json:"trace,omitempty"`
}

func normalise(entry Entry, at time.Time) line {
	return line{
		Time:      at.UTC().Format(time.RFC3339Nano),
		Level:     level(entry.Level),
		Component: name(entry.Component),
		Event:     name(entry.Event),
		Method:    method(entry.Method),
		Path:      resourcePath(entry.Path),
		Status:    status(entry.Status),
		Session:   session(entry.Session),
		Duration:  duration(entry.Duration),
		Message:   text(entry.Message),
		Trace:     trace(entry.Trace),
	}
}

func level(value string) string {
	normalised := strings.ToLower(strings.TrimSpace(value))
	if _, found := allowedLevels[normalised]; found {
		return normalised
	}
	return LevelInfo
}

func name(value string) string {
	normalised := strings.ToLower(strings.TrimSpace(value))
	if normalised == "" {
		return ""
	}
	if len(normalised) > maxNameRunes || !namePattern.MatchString(normalised) {
		return invalid
	}
	return normalised
}

func method(value string) string {
	normalised := strings.ToUpper(strings.TrimSpace(value))
	if normalised == "" {
		return ""
	}
	if _, found := allowedMethods[normalised]; found {
		return normalised
	}
	return invalid
}

func status(value int) int {
	if value < 100 || value > 599 {
		return 0
	}
	return value
}

func duration(value int64) int64 {
	if value < 0 {
		return 0
	}
	return value
}

func session(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}
	if len(trimmed) > maxSessionLen || !sessionPattern.MatchString(trimmed) {
		return invalid
	}
	return trimmed
}

func resourcePath(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}

	parsed, err := url.Parse(truncate(trimmed, maxPathRunes))
	if err != nil {
		return dropped
	}

	segments := strings.Split(parsed.EscapedPath(), "/")
	for index, segment := range segments {
		segments[index] = word(segment)
	}
	path := strings.Join(segments, "/")

	if parsed.Scheme == "" || parsed.Host == "" {
		return path
	}

	return word(parsed.Scheme) + "://" + word(parsed.Host) + path
}

func text(value string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return ""
	}

	words := strings.Fields(truncate(trimmed, maxTextRunes))
	for index, candidate := range words {
		if strings.Contains(candidate, "://") {
			words[index] = resourcePath(candidate)
			continue
		}
		words[index] = word(candidate)
	}

	return strings.Join(words, " ")
}

func trace(value string) string {
	if strings.TrimSpace(value) == "" {
		return ""
	}

	frames := make([]string, 0, maxTraceLines)
	for _, candidate := range strings.Split(value, "\n") {
		frame := strings.TrimSpace(candidate)
		if frame == "" || !isFrame(frame) {
			continue
		}

		frames = append(frames, text(frame))
		if len(frames) == maxTraceLines {
			break
		}
	}

	return strings.Join(frames, " | ")
}

func isFrame(value string) bool {
	return strings.HasPrefix(value, "at ") || framePattern.MatchString(value)
}

func word(value string) string {
	if value == "" {
		return ""
	}
	if len([]rune(value)) > maxWordRunes {
		return dropped
	}

	run, onlyLetters := 0, true

	for _, symbol := range value {
		if isRunRune(symbol) {
			run++
			onlyLetters = onlyLetters && unicode.IsLetter(symbol)
			continue
		}
		if !isPrintable(symbol) || !runAccepted(run, onlyLetters) {
			return dropped
		}
		run, onlyLetters = 0, true
	}

	if !runAccepted(run, onlyLetters) {
		return dropped
	}

	return value
}

// A credential is an unbroken run that mixes letters with digits or base64
// padding, so a run of plain letters is allowed to be longer than a mixed one.
func runAccepted(length int, onlyLetters bool) bool {
	if onlyLetters {
		return length <= maxLetterRun
	}
	return length <= maxMixedRun
}

func isRunRune(symbol rune) bool {
	switch {
	case symbol >= 'a' && symbol <= 'z':
		return true
	case symbol >= 'A' && symbol <= 'Z':
		return true
	case symbol >= '0' && symbol <= '9':
		return true
	}
	return strings.ContainsRune("+/=_-", symbol)
}

func isPrintable(symbol rune) bool {
	return unicode.IsLetter(symbol) || (symbol >= 0x20 && symbol <= 0x7e)
}

func truncate(value string, limit int) string {
	symbols := []rune(value)
	if len(symbols) <= limit {
		return value
	}
	return string(symbols[:limit])
}
