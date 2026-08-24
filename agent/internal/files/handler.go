package files

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"mime"
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
	thumbGen       *thumbs.Generator
}

func NewHandler(svc *Service, maxUploadBytes int64, thumbGen *thumbs.Generator) *Handler {
	return &Handler{svc: svc, maxUploadBytes: maxUploadBytes, thumbGen: thumbGen}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/files/list", h.list)
	mux.HandleFunc("GET /api/files/download", h.download)
	mux.HandleFunc("GET /api/files/preview", h.preview)
	mux.HandleFunc("GET /api/files/thumb", h.thumb)
	mux.HandleFunc("POST /api/files/upload", h.upload)
	mux.HandleFunc("POST /api/files/mkdir", h.mkdir)
	mux.HandleFunc("POST /api/files/rename", h.rename)
	mux.HandleFunc("POST /api/files/copy", h.copy)
	mux.HandleFunc("POST /api/files/move", h.move)
	mux.HandleFunc("DELETE /api/files/delete", h.delete)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, err error) {
	log.Println("error:", err)
	msg := "internal error"
	if errors.Is(err, fsutil.ErrOutsideRoot) {
		status = http.StatusForbidden
		msg = "path not allowed"
	} else if os.IsNotExist(err) {
		status = http.StatusNotFound
		msg = "not found"
	} else if os.IsPermission(err) {
		msg = "permission denied"
	} else {
		// Surface business errors; hide filesystem errors that embed paths.
		var pe *os.PathError
		var le *os.LinkError
		if errors.As(err, &pe) || errors.As(err, &le) {
			msg = "internal error"
		} else {
			msg = err.Error()
		}
	}
	writeJSON(w, status, map[string]string{"error": msg})
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	entries, err := h.svc.List(r.Context(), path)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"path": path, "entries": entries})
}

func (h *Handler) download(w http.ResponseWriter, r *http.Request) {
	h.serveFile(w, r, true)
}

func (h *Handler) preview(w http.ResponseWriter, r *http.Request) {
	// Like download but inline, with HTTP Range support for media scrubbing.
	h.serveFile(w, r, false)
}

// thumb serves a small cached JPEG so grids skip full-size originals;
// unsupported types return 415 and the app falls back to an icon.
func (h *Handler) thumb(w http.ResponseWriter, r *http.Request) {
	abs, err := h.svc.resolve(r.URL.Query().Get("path"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	info, statErr := os.Stat(abs)
	if statErr != nil {
		writeErr(w, http.StatusNotFound, statErr)
		return
	}
	if info.IsDir() {
		writeErr(w, http.StatusBadRequest, os.ErrInvalid)
		return
	}
	cachePath, modTime, err := h.thumbGen.Get(abs, info, thumbMaxDim)
	if err != nil {
		if errors.Is(err, thumbs.ErrUnsupported) {
			writeJSON(w, http.StatusUnsupportedMediaType, map[string]string{"error": thumbs.ErrUnsupported.Error()})
			return
		}
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if err := thumbs.Serve(w, r, cachePath, modTime); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
	}
}

func (h *Handler) serveFile(w http.ResponseWriter, r *http.Request, attachment bool) {
	path := r.URL.Query().Get("path")
	entry, abs, err := h.svc.Stat(path)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if entry.IsDir {
		writeErr(w, http.StatusBadRequest, errors.New("cannot download a directory"))
		return
	}
	f, err := os.Open(abs)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	defer f.Close()

	if attachment {
		cd := mime.FormatMediaType("attachment", map[string]string{"filename": entry.Name})
		w.Header().Set("Content-Disposition", cd)
	}
	// ServeContent gives Content-Type sniffing + Range support (video seeking).
	http.ServeContent(w, r, entry.Name, entry.ModTime, f)
}

func (h *Handler) upload(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, h.maxUploadBytes)
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	destDir := r.FormValue("path") // folder to upload into

	fileHeaders := r.MultipartForm.File["file"]
	if len(fileHeaders) == 0 {
		writeErr(w, http.StatusBadRequest, errors.New("missing 'file' field"))
		return
	}

	saved := make([]string, 0, len(fileHeaders))
	for _, fh := range fileHeaders {
		if err := h.saveUpload(destDir, fh); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		saved = append(saved, fh.Filename)
	}
	h.svc.Invalidate(r.Context())
	writeJSON(w, http.StatusOK, map[string]any{"uploaded": saved})
}

func (h *Handler) saveUpload(destDir string, fh *multipart.FileHeader) error {
	// Only allow the bare filename to prevent path-traversal via filename.
	safeName := filepath.Base(fh.Filename)
	dst, err := fsutil.Resolve(h.svc.Root, filepath.Join(destDir, safeName))
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
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

func decode(r *http.Request, v any) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}

func (h *Handler) mkdir(w http.ResponseWriter, r *http.Request) {
	var b dto.PathRequest
	if err := decode(r, &b); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if err := h.svc.Mkdir(r.Context(), b.Path); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) rename(w http.ResponseWriter, r *http.Request) {
	var b dto.RenameRequest
	if err := decode(r, &b); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if err := h.svc.Rename(r.Context(), b.OldPath, b.NewPath); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) copy(w http.ResponseWriter, r *http.Request) {
	var b dto.SrcDstRequest
	if err := decode(r, &b); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if err := h.svc.Copy(r.Context(), b.Src, b.Dst); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) move(w http.ResponseWriter, r *http.Request) {
	var b dto.SrcDstRequest
	if err := decode(r, &b); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if err := h.svc.Move(r.Context(), b.Src, b.Dst); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	var b dto.PathRequest
	if err := decode(r, &b); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if err := h.svc.Delete(r.Context(), b.Path); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
