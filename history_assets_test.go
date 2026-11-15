package main

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

func TestHistoryAssetsAndNoExternalRuntimeURLs(t *testing.T) {
	chaptersBytes, err := os.ReadFile(filepath.Join("web", "src", "history", "chapters.ts"))
	if err != nil {
		t.Fatalf("no se pudo leer chapters.ts: %v", err)
	}
	chaptersText := string(chaptersBytes)

	creditsBytes, err := os.ReadFile(filepath.Join("web", "assets", "historia", "CREDITOS.md"))
	if err != nil {
		t.Fatalf("no se pudo leer web/assets/historia/CREDITOS.md: %v", err)
	}
	creditsText := string(creditsBytes)

	srcPattern := regexp.MustCompile(`src:\s*"(assets/historia/[^"]+)"`)
	matches := srcPattern.FindAllStringSubmatch(chaptersText, -1)
	if len(matches) == 0 {
		t.Fatal("no se encontraron retratos en chapters.ts")
	}
	seen := make(map[string]bool)
	for _, m := range matches {
		rel := m[1]
		if seen[rel] {
			t.Errorf("retrato repetido entre capítulos: %s", rel)
		}
		seen[rel] = true
		diskPath := filepath.Join("web", filepath.FromSlash(rel))
		info, err := os.Stat(diskPath)
		if err != nil {
			t.Errorf("falta retrato referenciado en chapters.ts: %s (%v)", diskPath, err)
			continue
		}
		if info.Size() > 60*1024 {
			t.Errorf("retrato %s supera 60 KB (%d bytes)", diskPath, info.Size())
		}
		base := filepath.Base(rel)
		if !strings.Contains(creditsText, base) {
			t.Errorf("retrato %s no aparece documentado en CREDITOS.md", base)
		}
	}

	altEmptyPattern := regexp.MustCompile(`alt:\s*""`)
	if altEmptyPattern.MatchString(chaptersText) {
		t.Error("se encontró un atributo alt vacío en chapters.ts")
	}

	extAssetPattern := regexp.MustCompile(`(?i)(\bsrc\s*=|\bfetch\s*\(|url\s*\(|<link[^>]+href\s*=)\s*["']?https?://`)
	err = filepath.WalkDir("web", func(path string, d os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() || strings.HasPrefix(path, filepath.Join("web", "build")) {
			return nil
		}
		ext := strings.ToLower(filepath.Ext(path))
		if ext != ".html" && ext != ".css" && ext != ".ts" && ext != ".js" {
			return nil
		}
		content, readErr := os.ReadFile(path)
		if readErr != nil {
			return readErr
		}
		if extAssetPattern.Match(content) {
			t.Errorf("se detectó URL externa en tiempo de ejecución dentro de %s", path)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("error recorriendo web/: %v", err)
	}
}
