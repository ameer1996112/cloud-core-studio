#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="com.cloudandcore.openwa-worker"
PLIST_DIR="${OPENWA_LAUNCHD_PLIST_DIR:-$HOME/Library/LaunchAgents}"
PLIST_PATH="$PLIST_DIR/com.cloudandcore.openwa-worker.plist"
LOG_DIR="${OPENWA_LAUNCHD_LOG_DIR:-$HOME/Library/Logs/CloudCoreOpenWA}"

xml_escape() {
  local value="$1"
  value="${value//&/&amp;}"
  value="${value//</&lt;}"
  value="${value//>/&gt;}"
  value="${value//\"/&quot;}"
  value="${value//\'/&apos;}"
  printf '%s' "$value"
}

mkdir -p "$PLIST_DIR" "$LOG_DIR"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>$(xml_escape "$LABEL")</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>$(xml_escape "$ROOT_DIR/scripts/openwa-launchd-worker.sh")</string>
    </array>
    <key>StartInterval</key>
    <integer>15</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$(xml_escape "$LOG_DIR/launchd-stdout.log")</string>
    <key>StandardErrorPath</key>
    <string>$(xml_escape "$LOG_DIR/launchd-stderr.log")</string>
    <key>WorkingDirectory</key>
    <string>$(xml_escape "$ROOT_DIR")</string>
  </dict>
</plist>
PLIST

if [[ "${OPENWA_LAUNCHD_SKIP_LOAD:-0}" == "1" ]]; then
  echo "Installed $PLIST_PATH"
  exit 0
fi

launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl load "$PLIST_PATH"
launchctl kickstart -k "gui/$(id -u)/$LABEL"

echo "Installed $PLIST_PATH"
