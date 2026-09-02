// Package thumbs generates and disk-caches small JPEG thumbnails for images
// and (when ffmpeg is installed) videos. Shared by the /api/media/thumb and
// /api/files/thumb endpoints.
package thumbs

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	"image/jpeg"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// ErrUnsupported marks files we can't thumbnail (handlers map it to 415).
var ErrUnsupported = errors.New("thumbnail not supported for this file type")

var imageExt = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".bmp": true,
}
var videoExt = map[string]bool{
	".mp4": true, ".mov": true, ".m4v": true, ".webm": true, ".mkv": true,
}

func IsImageExt(ext string) bool { return imageExt[strings.ToLower(ext)] }
func IsVideoExt(ext string) bool { return videoExt[strings.ToLower(ext)] }

// maxConcurrentGen caps parallel generations so grids don't stampede the CPU.
const maxConcurrentGen = 4

// warmQueueSize bounds the background warm queue; overflow is dropped since
// on-demand requests generate on demand anyway.
const warmQueueSize = 512

type warmJob struct {
	abs    string
	info   os.FileInfo
	maxDim int
}

type Generator struct {
	dir    string
	sem    chan struct{}
	ffmpeg string // absolute path, or "" when ffmpeg isn't installed
	warm   chan warmJob
}

// New creates a generator caching into dir; video thumbs need ffmpeg on PATH.
func New(dir string) *Generator {
	p, err := exec.LookPath("ffmpeg")
	if err != nil {
		log.Println("ffmpeg not found - video thumbnails disabled")
	} else {
		log.Printf("video thumbnails enabled (%s)", p)
	}
	g := &Generator{dir: dir, sem: make(chan struct{}, maxConcurrentGen), ffmpeg: p, warm: make(chan warmJob, warmQueueSize)}
	go g.warmWorker()
	return g
}

func (g *Generator) warmWorker() {
	for job := range g.warm {
		if _, _, err := g.Get(job.abs, job.info, job.maxDim); err != nil && !errors.Is(err, ErrUnsupported) {
			log.Printf("warm thumbnail %s: %v", job.abs, err)
		}
	}
}

// HasCached reports whether abs already has a cached thumbnail at maxDim.
// One stat, no generation, safe from any goroutine.
func (g *Generator) HasCached(abs string, info os.FileInfo, maxDim int) bool {
	ext := strings.ToLower(filepath.Ext(abs))
	if !imageExt[ext] || ext == ".webp" {
		return false
	}
	if videoExt[ext] && g.ffmpeg == "" {
		// Video thumbs need ffmpeg; without it nothing can be cached.
		return false
	}
	_, err := os.Stat(g.cachePath(abs, info, maxDim))
	return err == nil
}

// WarmIfMissing schedules background generation of abs's thumbnail when it
// isn't cached yet. Never blocks and never generates inline.
func (g *Generator) WarmIfMissing(abs string, info os.FileInfo, maxDim int) {
	if g.HasCached(abs, info, maxDim) {
		return
	}
	select {
	case g.warm <- warmJob{abs: abs, info: info, maxDim: maxDim}:
	default: // queue full: the on-demand path will generate when asked
	}
}

// Get returns abs's cached thumbnail path, generating it if needed. The
// returned time is the source modtime for conditional serving.
func (g *Generator) Get(abs string, info os.FileInfo, maxDim int) (string, time.Time, error) {
	modTime := info.ModTime()
	ext := strings.ToLower(filepath.Ext(abs))
	switch {
	case imageExt[ext]:
		if ext == ".webp" {
			return "", modTime, ErrUnsupported
		}
	case videoExt[ext]:
		if g.ffmpeg == "" {
			return "", modTime, ErrUnsupported
		}
	default:
		return "", modTime, ErrUnsupported
	}

	cachePath := g.cachePath(abs, info, maxDim)
	if _, err := os.Stat(cachePath); err == nil {
		return cachePath, modTime, nil
	}

	g.sem <- struct{}{}
	defer func() { <-g.sem }()
	// Another request may have generated it while we waited on the semaphore.
	if _, err := os.Stat(cachePath); err == nil {
		return cachePath, modTime, nil
	}

	var genErr error
	if imageExt[ext] {
		genErr = g.imageThumb(abs, cachePath, maxDim)
	} else {
		genErr = g.videoThumb(abs, cachePath, maxDim)
	}
	if genErr != nil {
		return "", modTime, genErr
	}
	return cachePath, modTime, nil
}

// Serve streams the cached thumbnail with conditional-request support.
func Serve(w http.ResponseWriter, r *http.Request, cachePath string, srcModTime time.Time) error {
	f, err := os.Open(cachePath)
	if err != nil {
		return err
	}
	defer f.Close()
	w.Header().Set("Cache-Control", "private, max-age=86400")
	http.ServeContent(w, r, "thumb.jpg", srcModTime, f)
	return nil
}

// writeAtomic renames gen's temp output into place only on success.
func (g *Generator) writeAtomic(cachePath string, gen func(tmp string) error) error {
	if err := os.MkdirAll(g.dir, 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(g.dir, ".tmp-*")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName) // no-op after a successful rename
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := gen(tmpName); err != nil {
		return err
	}
	return os.Rename(tmpName, cachePath)
}

func (g *Generator) imageThumb(abs, cachePath string, maxDim int) error {
	return g.writeAtomic(cachePath, func(tmp string) error {
		src, err := decodeImage(abs)
		if err != nil {
			return err
		}
		out, err := os.Create(tmp)
		if err != nil {
			return err
		}
		defer out.Close()
		return jpeg.Encode(out, downscale(src, maxDim), &jpeg.Options{Quality: 82})
	})
}

// videoThumb grabs a frame ~1s in; videos shorter than that fall back to the
// first frame.
func (g *Generator) videoThumb(abs, cachePath string, maxDim int) error {
	vf := fmt.Sprintf(`scale=min(%d\,iw):-2`, maxDim)
	base := []string{"-nostdin", "-y", "-loglevel", "error", "-i", abs,
		"-frames:v", "1", "-vf", vf, "-q:v", "5"}
	attempts := [][]string{
		append([]string{"-ss", "1"}, base...),
		base, // fallback: very short clips have no frame at t=1s
	}
	return g.writeAtomic(cachePath, func(tmp string) error {
		var lastErr error
		for _, args := range attempts {
			cmd := exec.Command(g.ffmpeg, append(args, tmp)...)
			if err := cmd.Run(); err == nil {
				if info, statErr := os.Stat(tmp); statErr == nil && info.Size() > 0 {
					return nil
				}
				lastErr = fmt.Errorf("ffmpeg produced no output")
				continue
			} else {
				lastErr = err
			}
		}
		return lastErr
	})
}

func decodeImage(path string) (image.Image, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	img, _, err := image.Decode(f)
	return img, err
}

func downscale(src image.Image, maxDim int) image.Image {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	if w <= maxDim && h <= maxDim {
		return src
	}
	scale := float64(maxDim) / float64(max(w, h))
	dw, dh := int(float64(w)*scale), int(float64(h)*scale)
	if dw < 1 {
		dw = 1
	}
	if dh < 1 {
		dh = 1
	}
	// Nearest-neighbor: good enough for grid cells, avoids the x/image dep.
	dst := image.NewRGBA(image.Rect(0, 0, dw, dh))
	for y := 0; y < dh; y++ {
		sy := (y*dh + dh/2) / dh
		sy = b.Min.Y + (sy * h / dh)
		for x := 0; x < dw; x++ {
			sx := (x*dw + dw/2) / dw
			sx = b.Min.X + (sx * w / dw)
			dst.Set(x, y, src.At(sx, sy))
		}
	}
	return dst
}

// cachePath keys the cache file on path|modtime|size|maxDim, hashed filename-safe.
func (g *Generator) cachePath(abs string, info os.FileInfo, maxDim int) string {
	h := sha256.New()
	io.WriteString(h, abs)
	io.WriteString(h, "|"+strconv.FormatInt(info.ModTime().UnixNano(), 10))
	io.WriteString(h, "|"+strconv.FormatInt(info.Size(), 10))
	io.WriteString(h, "|"+strconv.Itoa(maxDim))
	h.Write([]byte(g.dir)) // separate generators must not collide on shared dirs
	return filepath.Join(g.dir, hex.EncodeToString(h.Sum(nil))+".jpg")
}
