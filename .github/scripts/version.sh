#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"

targets=(
    'build/config.yml|s/^  version: "\([^"]*\)" # The application version$/\1/p|s/^\(  version: \)"[^"]*"\( # The application version\)$/\1"@V@"\2/|@V@'
    'build/windows/info.json|s/.*"file_version": "\([^"]*\)".*/\1/p|s/\("file_version": \)"[^"]*"/\1"@V@"/|@V@'
    'build/windows/info.json|s/.*"ProductVersion": "\([^"]*\)".*/\1/p|s/\("ProductVersion": \)"[^"]*"/\1"@V@"/|@V@'
    'build/windows/nsis/wails_tools.nsh|s/^ *!define INFO_PRODUCTVERSION "\([^"]*\)".*/\1/p|s/^\( *!define INFO_PRODUCTVERSION \)"[^"]*"/\1"@V@"/|@V@'
    'build/windows/wails.exe.manifest|1,4{s/.*<assemblyIdentity [^>]*version="\([^"]*\)".*/\1/p;}|1,4s/\(<assemblyIdentity [^>]*version=\)"[^"]*"/\1"@V@"/|@V@'
    'build/windows/msix/app_manifest.xml|s/^ *Version="\([^"]*\)".*/\1/p|s/^\( *Version=\)"[^"]*"/\1"@V@.0"/|@V@.0'
    'build/windows/msix/template.xml|s/^ *Version="\([^"]*\)".*/\1/p|s/^\( *Version=\)"[^"]*"/\1"@V@.0"/|@V@.0'
    'build/linux/nfpm/nfpm.yaml|s/^version: "\([^"]*\)"$/\1/p|s/^version: "[^"]*"$/version: "@V@"/|@V@'
    'frontend/package.json|1,6{s/^  "version": "\([^"]*\)",$/\1/p;}|1,6s/^\(  "version": \)"[^"]*",$/\1"@V@",/|@V@'
    'frontend/package-lock.json|1,12{s/^ *"version": "\([^"]*\)",$/\1/p;}|1,12s/^\( *"version": \)"[^"]*",$/\1"@V@",/|@V@'
)

usage() {
    echo "usage: version.sh [check | set <major.minor.patch> | stale [version]]" >&2
    exit 2
}

declared() {
    [ -f VERSION ] || { echo "VERSION is missing" >&2; exit 2; }
    tr -d '[:space:]' < VERSION
}

check() {
    local expected failed=0 entry file extract replace want found line ok
    expected="$(declared)"
    printf '%-38s %s\n' 'VERSION' "$expected"
    for entry in "${targets[@]}"; do
        IFS='|' read -r file extract replace want <<<"$entry"
        want="${want//@V@/$expected}"
        if [ ! -f "$file" ]; then
            printf '%-38s file is missing\n' "$file"
            failed=1
            continue
        fi
        found="$(sed -n "$extract" "$file")"
        if [ -z "$found" ]; then
            printf '%-38s no version found\n' "$file"
            failed=1
            continue
        fi
        ok=1
        while IFS= read -r line; do
            [ "$line" = "$want" ] || ok=0
        done <<<"$found"
        if [ "$ok" = 1 ]; then
            printf '%-38s %s\n' "$file" "$want"
        else
            printf '%-38s %s (expected %s)\n' "$file" "$(echo "$found" | tr '\n' ' ')" "$want"
            failed=1
        fi
    done
    if [ "$failed" != 0 ]; then
        echo
        echo "The declared version and the build files disagree. Run: .github/scripts/version.sh set $expected" >&2
        exit 1
    fi
}

stale() {
    local expected="${1:-}" entry file extract replace want found line ok
    local -a behind=()
    [ -n "$expected" ] || expected="$(declared)"
    for entry in "${targets[@]}"; do
        IFS='|' read -r file extract replace want <<<"$entry"
        want="${want//@V@/$expected}"
        [ -f "$file" ] || continue
        found="$(sed -n "$extract" "$file")"
        ok=1
        [ -n "$found" ] || ok=0
        while IFS= read -r line; do
            [ "$line" = "$want" ] || ok=0
        done <<<"$found"
        [ "$ok" = 1 ] || behind+=("$file")
    done
    [ "${#behind[@]}" -gt 0 ] || return 0
    printf '%s\n' "${behind[@]}" | awk '!seen[$0]++'
}

apply() {
    local new="${1:-}" entry file extract replace want
    echo "$new" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || {
        echo "a version is three numbers, as in 1.4.0 — got '${new}'" >&2
        exit 2
    }
    printf '%s\n' "$new" > VERSION
    for entry in "${targets[@]}"; do
        IFS='|' read -r file extract replace want <<<"$entry"
        sed -i "${replace//@V@/$new}" "$file"
    done
    check
}

case "${1:-check}" in
    check) check ;;
    set) shift; apply "${1:-}" ;;
    stale) shift; stale "${1:-}" ;;
    *) usage ;;
esac
