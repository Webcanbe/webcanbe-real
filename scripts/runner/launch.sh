#!/bin/sh
# Trusted guest entrypoint. The host passes only a generated UUID, never a command.
set -eu
case "${1-}" in ????????-????-????-????-????????????) ;; *) exit 64;; esac
case "$1" in *[!a-f0-9-]*) exit 64;; esac
case "${2-browser}" in browser) entry=worker.cjs;; proof) entry=probe.cjs;; *) exit 64;; esac
test ! -e "/var/lib/wcb-runner/revoked/$1"
exec systemd-run --quiet --wait --pipe --collect --service-type=exec \
  --unit="wcb-preview-$1" --property=User=wcb-runner \
  --property="ExecStartPre=/usr/bin/test ! -e /var/lib/wcb-runner/revoked/$1" \
  --property=LimitCORE=0 --property=MemoryMax=1536M --property=MemorySwapMax=0 --property=CPUQuota=150% \
  --property=TasksMax=192 --property=RuntimeMaxSec=65 --property=TimeoutStopSec=2 \
  --property=KillMode=control-group --property=SendSIGKILL=yes --property=OOMPolicy=kill \
  --property=NoNewPrivileges=yes \
  --property='RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6 AF_NETLINK' \
  /usr/bin/bwrap --unshare-all --die-with-parent --new-session --cap-drop ALL \
  --clearenv --setenv HOME /home/runner --setenv TMPDIR /tmp --setenv LANG C.UTF-8 \
  --setenv PATH /usr/bin --ro-bind /usr/lib /usr/lib --symlink usr/lib /lib \
  --dir /usr/bin --ro-bind /usr/bin/node /usr/bin/node \
  --ro-bind /usr/share/nodejs /usr/share/nodejs \
  --ro-bind /usr/share/fonts /usr/share/fonts --ro-bind /usr/share/fontconfig /usr/share/fontconfig \
  --ro-bind /etc/fonts /etc/fonts --ro-bind /opt/wcb-runtime /opt/wcb-runtime \
  --proc /proc --dev /dev --tmpfs /tmp --tmpfs /home --dir /home/runner --chdir /tmp \
  /usr/bin/node "/opt/wcb-runtime/$entry"
