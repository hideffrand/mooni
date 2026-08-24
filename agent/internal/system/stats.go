package system

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"mooni-backend/internal/dto"
)

// Collect gathers a machine-health snapshot from /proc and sysfs;
// rootDir scopes the reported disk usage.
func Collect(rootDir string) (dto.SystemStats, error) {
	hostname, err := os.Hostname()
	if err != nil {
		return dto.SystemStats{}, err
	}

	return dto.SystemStats{
		Hostname:      hostname,
		OS:            osName(),
		UptimeSeconds: readUptime(),
		CPUPercent:    cpuPercent(),
		LoadAvg:       readLoadAvg(),
		Memory:        readMem(),
		Disk:          readDisk(rootDir),
		Processes:     countProcesses(),
		TempsCelsius:  readTemps(),
	}, nil
}

func osName() string {
	f, err := os.Open("/etc/os-release")
	if err != nil {
		return "Linux"
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if strings.HasPrefix(line, "PRETTY_NAME=") {
			return strings.Trim(strings.TrimPrefix(line, "PRETTY_NAME="), `"`)
		}
	}
	return "Linux"
}

func readUptime() int64 {
	data, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0
	}
	fields := strings.Fields(string(data))
	if len(fields) == 0 {
		return 0
	}
	secs, err := strconv.ParseFloat(fields[0], 64)
	if err != nil {
		return 0
	}
	return int64(secs)
}

// cpuPercent samples /proc/stat twice ~200ms apart and reports the CPU
// utilization in that window, so the value is fresh on every request.
func cpuPercent() float64 {
	a, err := readCPUTimes()
	if err != nil {
		return 0
	}
	time.Sleep(200 * time.Millisecond)
	b, err := readCPUTimes()
	if err != nil {
		return 0
	}

	totalA, idleA := cpuTotals(a)
	totalB, idleB := cpuTotals(b)

	dTotal := totalB - totalA
	dIdle := idleB - idleA
	if dTotal <= 0 {
		return 0
	}
	return (1 - float64(dIdle)/float64(dTotal)) * 100
}

type cpuTimes struct {
	user, nice, system, idle, iowait, irq, softirq, steal uint64
}

func readCPUTimes() (cpuTimes, error) {
	f, err := os.Open("/proc/stat")
	if err != nil {
		return cpuTimes{}, err
	}
	defer f.Close()

	var t cpuTimes
	sc := bufio.NewScanner(f)
	if sc.Scan() {
		fields := strings.Fields(sc.Text())
		if len(fields) < 5 || fields[0] != "cpu" {
			return t, fmt.Errorf("unexpected /proc/stat first line: %q", sc.Text())
		}
		vals := make([]uint64, 8)
		for i, s := range fields[1:] {
			if i >= len(vals) {
				break
			}
			vals[i], _ = strconv.ParseUint(s, 10, 64)
		}
		t = cpuTimes{
			user:    vals[0],
			nice:    vals[1],
			system:  vals[2],
			idle:    vals[3],
			iowait:  vals[4],
			irq:     vals[5],
			softirq: vals[6],
			steal:   vals[7],
		}
	}
	return t, sc.Err()
}

func cpuTotals(t cpuTimes) (total, idle uint64) {
	total = t.user + t.nice + t.system + t.idle + t.iowait + t.irq + t.softirq + t.steal
	idle = t.idle + t.iowait
	return
}

func readLoadAvg() [3]float64 {
	var out [3]float64
	data, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return out
	}
	fields := strings.Fields(string(data))
	for i := 0; i < 3 && i < len(fields); i++ {
		out[i], _ = strconv.ParseFloat(fields[i], 64)
	}
	return out
}

func readMem() dto.MemStats {
	var out dto.MemStats
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return out
	}
	defer f.Close()

	vals := make(map[string]int64)
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		fields := strings.Fields(sc.Text())
		if len(fields) < 2 {
			continue
		}
		name := strings.TrimSuffix(fields[0], ":")
		v, err := strconv.ParseInt(fields[1], 10, 64)
		if err != nil {
			continue
		}
		vals[name] = v * 1024 // meminfo reports KiB
	}

	total := vals["MemTotal"]
	avail := vals["MemAvailable"]
	if avail == 0 {
		avail = vals["MemFree"] + vals["Buffers"] + vals["Cached"]
	}
	out = dto.MemStats{TotalBytes: total, AvailableBytes: avail}
	if total > 0 {
		out.UsedPercent = (1 - float64(avail)/float64(total)) * 100
	}
	return out
}

func readDisk(rootDir string) dto.DiskStats {
	var out dto.DiskStats
	if rootDir == "" {
		return out
	}
	var fs syscall.Statfs_t
	if err := syscall.Statfs(rootDir, &fs); err != nil {
		return out
	}
	out.TotalBytes = int64(fs.Blocks) * int64(fs.Bsize)
	out.AvailableBytes = int64(fs.Bavail) * int64(fs.Bsize)
	out.UsedBytes = out.TotalBytes - out.AvailableBytes
	if out.TotalBytes > 0 {
		out.UsedPercent = float64(out.UsedBytes) / float64(out.TotalBytes) * 100
	}
	return out
}

func countProcesses() int {
	entries, err := os.ReadDir("/proc")
	if err != nil {
		return 0
	}
	n := 0
	for _, e := range entries {
		if e.IsDir() && isNumeric(e.Name()) {
			n++
		}
	}
	return n
}

func isNumeric(s string) bool {
	if s == "" {
		return false
	}
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

// readTemps reports CPU/board temperatures in Celsius from sysfs thermal
// zones. Best-effort: most laptops expose these; VMs usually don't.
func readTemps() []float64 {
	zones, err := filepath.Glob("/sys/class/thermal/thermal_zone*/temp")
	if err != nil {
		return nil
	}
	out := make([]float64, 0, len(zones))
	for _, z := range zones {
		data, err := os.ReadFile(z)
		if err != nil {
			continue
		}
		milli, err := strconv.ParseInt(strings.TrimSpace(string(data)), 10, 64)
		if err != nil || milli == 0 {
			continue
		}
		out = append(out, float64(milli)/1000.0)
	}
	return out
}
