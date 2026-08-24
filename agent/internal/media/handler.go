package media

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"

	"mooni-backend/internal/dto"
	"mooni-backend/internal/fsutil"
	"mooni-backend/internal/thumbs"
)

// thumbMaxDim is the longest edge of a generated thumbnail.
const thumbMaxDim = 256

type Handler struct {
	svc            *Service
	maxUploadBytes int64
}

func NewHandler(svc *Service, maxUploadBytes int64) *Handler {
	return &Handler{svc: svc, maxUploadBytes: maxUploadBytes}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/media/list", h.list)
	mux.HandleFunc("GET /api/media/thumb", h.thumb)
	mux.HandleFunc("GET /api/media/preview", h.preview)
	mux.HandleFunc("POST /api/media/upload", h.upload)
	mux.HandleFunc("POST /api/media/delete", h.delete)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, err error) {
	log.Println("media error:", err)
	msg := "internal error"
	if errors.Is(err, fsutil.ErrOutsideRoot) {
		status = http.StatusForbidden
		msg = "path not allowed"
	} else if errors.Is(err, os.ErrNotExist) {
		status = http.StatusNotFound
		msg = "not found"
	} else if errors.Is(err, thumbs.ErrUnsupported) {
		status = http.StatusUnsupportedMediaType
		msg = "no thumbnail for this file type"
	} else if errors.Is(err, os.ErrPermission) {
		msg = "permission denied"
	} else {
		var pe *os.PathError
		if errors.As(err, &pe) {
			msg = "internal error"
		} else {
			msg = err.Error()
		}
	}
	writeJSON(w, status, map[string]string{"error": msg})
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.List(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) thumb(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	cachePath, modTime, err := h.svc.ThumbFile(path, thumbMaxDim)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if err := thumbs.Serve(w, r, cachePath, modTime); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
	}
}

func (h *Handler) preview(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	entry, abs, err := h.svc.Stat(path)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	f, err := os.Open(abs)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	defer f.Close()

	w.Header().Set("Content-Disposition", "inline")
	// ServeContent gives Content-Type sniffing + Range support (video seeking).
	http.ServeContent(w, r, entry.Name, entry.ModTime, f)
}

func (h *Handler) upload(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, h.maxUploadBytes)
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	fileHeaders := r.MultipartForm.File["file"]
	if len(fileHeaders) == 0 {
		writeErr(w, http.StatusBadRequest, errors.New("missing 'file' field"))
		return
	}

	saved := make([]string, 0, len(fileHeaders))
	for _, fh := range fileHeaders {
		if err := h.saveUpload(fh); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		saved = append(saved, fh.Filename)
	}
	h.svc.Invalidate(r.Context())
	writeJSON(w, http.StatusOK, map[string]any{"uploaded": saved})
}

func (h *Handler) saveUpload(fh *multipart.FileHeader) error {
	safeName := filepath.Base(fh.Filename) // prevent path traversal via filename
	dst, err := fsutil.Resolve(h.svc.Root, safeName)
	if err != nil {
		return err
	}
	src, err := fh.Open()
	if err != nil {
		return err
	}
	defer src.Close()

	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, src)
	return err
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	var b dto.MediaDeleteRequest
	if err := decode(r, &b); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if len(b.Paths) == 0 {
		writeErr(w, http.StatusBadRequest, errors.New("missing 'paths'"))
		return
	}
	if err := h.svc.Delete(r.Context(), b.Paths); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func decode(r *http.Request, v any) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}
