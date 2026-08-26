package dto

import "time"

// MediaItem is one image or video found in the media library.
type MediaItem struct {
	Path    string    `json:"path"` // root-relative, forward-slashed
	Name    string    `json:"name"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"modTime"`
	Kind    string    `json:"kind"` // "image" | "video"
}

// MediaFolder is a subdirectory of the library ("album") returned by
// browse-mode listings. Cover is the newest media file inside (nil when the
// folder holds none); Count is recursive across nested subfolders.
type MediaFolder struct {
	Name  string     `json:"name"`
	Path  string     `json:"path"` // root-relative, forward-slashed
	Count int        `json:"count"`
	Cover *MediaItem `json:"cover,omitempty"`
}

// MediaDeleteRequest is the body for deleting one or more library entries.
type MediaDeleteRequest struct {
	Paths []string `json:"paths"`
}
