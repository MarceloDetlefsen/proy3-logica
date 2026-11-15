package main

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

var (
	markdownLinkRe = regexp.MustCompile(`\[[^\]]*\]\(([^)]+)\)`)
	backtickPathRe = regexp.MustCompile("`([^`\\s]+)`")
)

var knownPathPrefixes = []string{
	"internal/",
	"web/",
	"testdata/",
	"docs/",
	"scripts/",
	"cmd/",
	".github/",
}

func TestDocsLinksAndPaths(t *testing.T) {
	files := []string{"README.md"}
	docEntries, err := filepath.Glob("docs/*.md")
	if err != nil {
		t.Fatalf("glob docs/*.md: %v", err)
	}
	files = append(files, docEntries...)

	for _, file := range files {
		raw, err := os.ReadFile(file)
		if err != nil {
			t.Fatalf("read %s: %v", file, err)
		}
		content := string(raw)
		baseDir := filepath.Dir(file)

		for _, match := range markdownLinkRe.FindAllStringSubmatch(content, -1) {
			target := strings.TrimSpace(match[1])
			if target == "" ||
				strings.HasPrefix(target, "http://") ||
				strings.HasPrefix(target, "https://") ||
				strings.HasPrefix(target, "#") ||
				strings.HasPrefix(target, "mailto:") {
				continue
			}
			targetPath := strings.SplitN(target, "#", 2)[0]
			if targetPath == "" {
				continue
			}
			resolved := filepath.Clean(filepath.Join(baseDir, targetPath))
			if strings.HasPrefix(resolved, "docs/captures/") {
				continue
			}
			if _, err := os.Stat(resolved); err != nil {
				t.Errorf("%s: enlace relativo roto %q (resuelto a %q): %v", file, target, resolved, err)
			}
		}

		for _, match := range backtickPathRe.FindAllStringSubmatch(content, -1) {
			candidate := strings.TrimSpace(match[1])
			hasPrefix := false
			for _, prefix := range knownPathPrefixes {
				if strings.HasPrefix(candidate, prefix) {
					hasPrefix = true
					break
				}
			}
			if !hasPrefix {
				continue
			}
			if strings.ContainsAny(candidate, "*<>[]{}()") {
				continue
			}
			clean := strings.SplitN(candidate, "#", 2)[0]
			clean = strings.TrimRight(clean, ".,;:")
			if strings.HasPrefix(clean, "docs/captures/") {
				continue
			}
			if _, err := os.Stat(clean); err != nil {
				t.Errorf("%s: ruta citada inexistente %q: %v", file, candidate, err)
			}
		}
	}
}
