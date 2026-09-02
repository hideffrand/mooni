package media

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/jpeg"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	"mooni-backend/internal/dto"
	"mooni-backend/internal/thumbs"
)

type fakeCache struct {
	m   map[string][]byte
	inc map[string]int64
}

func newFake() *fakeCache {
	return &fakeCache{m: map[string][]byte{}, inc: map[string]int64{}}
}

func (f *fakeCache) Get(_ context.Context, key string) ([]byte, bool) {
	b, ok := f.m[key]
	return b, ok
}

func (f *fakeCache) GetInt64(_ context.Context, key string) int64 {
	b, ok := f.m[key]
	if !ok {
		return 0
	}
	n, _ := strconv.ParseInt(string(b), 10, 64)
	return n
}

func (f *fakeCache) Set(_ context.Context, key string, value []byte, _ time.Duration) {
	f.m[key] = append([]byte(nil), value...)
}

func (f *fakeCache) Incr(_ context.Context, key string) int64 {
	n := f.inc[key] + 1
	f.inc[key] = n
	f.m[key] = []byte(strconv.FormatInt(n, 10))
	return n
}

func writeJPEG(t *testing.T, path string, w, h int) {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{uint8(x % 255), uint8(y % 255), 128, 255})
		}
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if err := jpeg.Encode(f, img, nil); err != nil {
		t.Fatal(err)
	}
}

func TestListFiltersMediaAndSortsNewestFirst(t *testing.T) {
	dir := t.TempDir()
	svc := NewService(dir, newFake(), thumbs.New(t.TempDir()))
	ctx := context.Background()

	writeJPEG(t, filepath.Join(dir, "a.jpg"), 100, 100)
	if err := os.WriteFile(filepath.Join(dir, "b.txt"), []byte("nope"), 0o644); err != nil {
		t.Fatal(err)
	}
	writeJPEG(t, filepath.Join(dir, "sub", "c.png"), 50, 50)
	// Stale timestamps so ordering is deterministic: c newest, a oldest.
	old := time.Now().Add(-24 * time.Hour)
	os.Chtimes(filepath.Join(dir, "a.jpg"), old, old)
	mid := time.Now().Add(-1 * time.Hour)
	os.Chtimes(filepath.Join(dir, "sub", "c.png"), mid, mid)

	items, err := svc.List(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 media items, got %+v", items)
	}
	if items[0].Name != "c.png" || items[1].Name != "a.jpg" {
		t.Fatalf("expected newest-first order, got %+v", items)
	}
}

func TestThumbDownscalesAndCaches(t *testing.T) {
	dir := t.TempDir()
	thumbGen := thumbs.New(t.TempDir())
	svc := NewService(dir, newFake(), thumbGen)
	ctx := context.Background()

	writeJPEG(t, filepath.Join(dir, "big.jpg"), 400, 200)
	_, _ = svc.List(ctx) // prime the cache path

	p1, _, err := svc.ThumbFile("big.jpg", 256)
	if err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(p1)
	if err != nil {
		t.Fatal(err)
	}
	img, _, err := image.Decode(bytes.NewReader(b))
	if err != nil {
		t.Fatal(err)
	}
	if got := img.Bounds().Dx(); got != 256 {
		t.Fatalf("expected 256px wide thumb, got %d", got)
	}
	if got := img.Bounds().Dy(); got != 128 {
		t.Fatalf("expected 128px tall thumb, got %d", got)
	}

	// Second call must be served from the on-disk cache (same file).
	p2, _, err := svc.ThumbFile("big.jpg", 256)
	if err != nil {
		t.Fatal(err)
	}
	if p1 != p2 {
		t.Fatal("expected identical cached thumbnail path")
	}
}

func TestDeleteRefusesRoot(t *testing.T) {
	dir := t.TempDir()
	svc := NewService(dir, newFake(), thumbs.New(t.TempDir()))
	if err := svc.Delete(context.Background(), []string{""}); err == nil {
		t.Fatal("expected error when deleting the root")
	}
	if _, err := os.Stat(dir); err != nil {
		t.Fatalf("root was deleted: %v", err)
	}
}

func TestBrowseScopesToFolderAndFindsCovers(t *testing.T) {
	dir := t.TempDir()
	svc := NewService(dir, newFake(), thumbs.New(t.TempDir()))
	ctx := context.Background()

	writeJPEG(t, filepath.Join(dir, "a.jpg"), 100, 100)
	writeJPEG(t, filepath.Join(dir, "sub", "d.png"), 50, 50)
	writeJPEG(t, filepath.Join(dir, "sub", "nested", "c.jpg"), 40, 40)
	if err := os.WriteFile(filepath.Join(dir, "sub", "note.txt"), []byte("nope"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(dir, "empty"), 0o755); err != nil {
		t.Fatal(err)
	}
	// Deterministic cover: c.jpg is the newest file anywhere under sub/.
	newest := time.Now().Add(-1 * time.Minute)
	os.Chtimes(filepath.Join(dir, "sub", "nested", "c.jpg"), newest, newest)
	mid := time.Now().Add(-1 * time.Hour)
	os.Chtimes(filepath.Join(dir, "sub", "d.png"), mid, mid)
	old := time.Now().Add(-24 * time.Hour)
	os.Chtimes(filepath.Join(dir, "a.jpg"), old, old)

	folders, items, err := svc.Browse(ctx, "")
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].Name != "a.jpg" {
		t.Fatalf("expected only a.jpg at root, got %+v", items)
	}
	if len(folders) != 2 || folders[0].Name != "empty" || folders[1].Name != "sub" {
		t.Fatalf("expected folders [empty sub], got %+v", folders)
	}
	sub := folders[1]
	if sub.Count != 2 {
		t.Fatalf("expected recursive count 2 for sub, got %d", sub.Count)
	}
	if sub.Cover == nil || sub.Cover.Name != "c.jpg" {
		t.Fatalf("expected newest item c.jpg as cover, got %+v", sub.Cover)
	}
	if folders[0].Count != 0 || folders[0].Cover != nil {
		t.Fatalf("expected empty folder with no cover, got %+v", folders[0])
	}

	// Drilling in is scoped: no root files leak through.
	folders, items, err = svc.Browse(ctx, "sub")
	if err != nil {
		t.Fatal(err)
	}
	if len(folders) != 1 || folders[0].Name != "nested" {
		t.Fatalf("expected nested folder inside sub, got %+v", folders)
	}
	if len(items) != 1 || items[0].Name != "d.png" {
		t.Fatalf("expected only d.png directly in sub, got %+v", items)
	}

	// Outside-root paths are refused.
	if _, _, err := svc.Browse(ctx, "../../etc"); err == nil {
		t.Fatal("expected error for path outside root")
	}
}

func postUpload(t *testing.T, h *Handler, mux *http.ServeMux, destDir, filename string) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, err := mw.CreateFormFile("file", filename)
	if err != nil {
		t.Fatal(err)
	}
	img := image.NewRGBA(image.Rect(0, 0, 10, 10))
	if err := jpeg.Encode(fw, img, nil); err != nil {
		t.Fatal(err)
	}
	if err := mw.WriteField("path", destDir); err != nil {
		t.Fatal(err)
	}
	if err := mw.Close(); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest("POST", "/api/media/upload", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	return rec
}

func TestUploadIntoSubfolderAndTraversalNeutralized(t *testing.T) {
	dir := t.TempDir()
	svc := NewService(dir, newFake(), thumbs.New(t.TempDir()))
	h := NewHandler(svc, 1<<20)
	mux := http.NewServeMux()
	h.Register(mux)

	// Upload targets an existing folder (missing parents are not created).
	if err := os.MkdirAll(filepath.Join(dir, "sub"), 0o755); err != nil {
		t.Fatal(err)
	}
	if rec := postUpload(t, h, mux, "sub", "up.jpg"); rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if _, err := os.Stat(filepath.Join(dir, "sub", "up.jpg")); err != nil {
		t.Fatalf("upload did not land in the requested subfolder: %v", err)
	}

	// A traversal attempt must stay inside the library (cleaned to a normal
	// subfolder), never write outside it.
	if err := os.MkdirAll(filepath.Join(dir, "escaped"), 0o755); err != nil {
		t.Fatal(err)
	}
	if rec := postUpload(t, h, mux, "../escaped", "up2.jpg"); rec.Code != http.StatusOK {
		t.Fatalf("expected neutralized upload to succeed, got %d: %s", rec.Code, rec.Body.String())
	}
	if _, err := os.Stat(filepath.Join(dir, "escaped", "up2.jpg")); err != nil {
		t.Fatalf("traversal payload was not contained in root: %v", err)
	}

	// Uploads must invalidate browse cache: Browse now sees the new file.
	ctx := context.Background()
	_, items, err := svc.Browse(ctx, "sub")
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].Name != "up.jpg" {
		t.Fatalf("expected up.jpg after invalidation, got %+v", items)
	}
}

func waitForThumb(t *testing.T, g *thumbs.Generator, abs string, maxDim int) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if g.HasCached(abs, mustStat(abs), maxDim) {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("thumbnail at %dpx for %s was not generated in time", maxDim, abs)
}

func mustStat(path string) os.FileInfo {
	info, err := os.Stat(path)
	if err != nil {
		panic(err)
	}
	return info
}

func TestWarmAllGeneratesThumbsInBackground(t *testing.T) {
	dir := t.TempDir()
	thumbGen := thumbs.New(t.TempDir())
	svc := NewService(dir, newFake(), thumbGen)

	writeJPEG(t, filepath.Join(dir, "a.jpg"), 300, 150)
	writeJPEG(t, filepath.Join(dir, "sub", "b.png"), 200, 400)
	items, err := svc.List(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(items))
	}

	svc.WarmAll(context.Background(), items)
	waitForThumb(t, thumbGen, filepath.Join(dir, "a.jpg"), 256)
	waitForThumb(t, thumbGen, filepath.Join(dir, "sub", "b.png"), 256)
	// Large preview tier warms for images too.
	waitForThumb(t, thumbGen, filepath.Join(dir, "a.jpg"), 2560)

	// A second call inside the cooldown window is a no-op, not a panic or
	// a second pass; state stays consistent.
	svc.WarmAll(context.Background(), items)
}

func TestWarmPathsBypassesCooldown(t *testing.T) {
	dir := t.TempDir()
	thumbGen := thumbs.New(t.TempDir())
	svc := NewService(dir, newFake(), thumbGen)

	writeJPEG(t, filepath.Join(dir, "fresh.jpg"), 300, 150)
	entry, _, err := svc.Stat("fresh.jpg")
	if err != nil {
		t.Fatal(err)
	}

	// WarmPaths must work even though no WarmAll ran before (zero lastWarm
	// does not matter - it ignores the cooldown entirely).
	svc.WarmPaths([]dto.MediaItem{entry})
	waitForThumb(t, thumbGen, filepath.Join(dir, "fresh.jpg"), 256)
}
