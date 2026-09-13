#!/bin/sh
set -eu
case "${1-}" in ????????-????-????-????-????????????) ;; *) exit 64;; esac
case "$1" in *[!a-f0-9-]*) exit 64;; esac
mkdir -p /var/lib/wcb-runner/revoked
touch "/var/lib/wcb-runner/revoked/$1"
unit="wcb-preview-$1.service"
# Startup/stop race: stop the unit if present; absent cannot hold processes.
systemctl stop "$unit" 2>/dev/null || true
state=$(systemctl show "$unit" --property=ActiveState --value)
case "$state" in inactive|failed) exit 0;; *) exit 1;; esac
