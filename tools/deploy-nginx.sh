#!/bin/sh
# SPDX-License-Identifier: LGPL-3.0-or-later
# Install the salasanasi.fi nginx configuration on the web host.
#
#   ./tools/deploy-nginx.sh [host]
#
# This is the half of the deploy that needs root: the document root, the nginx
# configuration, and on a fresh host the Let's Encrypt certificate. It is
# separate from tools/deploy-site.sh on purpose. Site content changes many times
# a day and must not require privileges; this changes a few times a year, is run
# by hand, and may prompt for a sudo password (hence ssh -t) — the host does not
# need passwordless sudo for anything.
#
# What it does, all of it idempotent:
#
#   * creates /var/www/salasanasi.fi owned by the login user, so that every later
#     content deploy is an unprivileged rsync;
#   * installs the http-level config, the snippets and the vhost;
#   * on a host with no certificate yet, installs the HTTP-only bootstrap vhost
#     just long enough for certbot's ACME challenge, then swaps in the real one;
#   * runs nginx -t and reloads.
#
# The certificate is issued with `certbot certonly --webroot`. The vhost is
# hand-written and lives in this repo, so certbot must never be let near it with
# --nginx: it would rewrite the file the repo owns.
#
# Copyright (C) 2026 Arttu Manninen.  Licensed under the GNU LGPL v3 or later;
# see COPYING.LESSER.
set -eu

HOST="${1:-${SALASANASI_HOST:-salasanasi.fi}}"
SITE=salasanasi.fi
WEBROOT="/var/www/$SITE"

cd "$(dirname "$0")/.."

echo "==> copying the configuration to $HOST"
scp -q "deploy/$SITE.nginx" "deploy/$SITE.bootstrap.nginx" \
	deploy/salasanasi-shared.conf deploy/salasanasi-matomo-proxy.conf \
	deploy/salasanasi-headers.conf deploy/salasanasi-headers-vuodot.conf \
	deploy/salasanasi-data-proxy.conf "$HOST:/tmp/"

echo "==> installing (sudo on $HOST, may ask for a password)"
ssh -t "$HOST" "set -eu
	site=$SITE
	webroot=$WEBROOT
	owner=\$(id -un)

	# Document root belongs to the deploying user; nginx only ever reads it, and
	# world-readable 644 files are enough for that. This is what keeps
	# tools/deploy-site.sh free of sudo.
	sudo install -d -o \"\$owner\" -g \"\$owner\" -m 755 \"\$webroot\"
	sudo chown -R \"\$owner\":\"\$owner\" \"\$webroot\"
	sudo install -d -m 755 /var/log/nginx/accesslogs

	# http-tason vyöhykkeet ja snippetit ensin: vhost viittaa niihin, joten
	# väärässä järjestyksessä nginx -t kaatuisi.
	sudo install -o root -g root -m 644 /tmp/salasanasi-shared.conf /etc/nginx/conf.d/salasanasi-shared.conf
	sudo install -o root -g root -m 644 /tmp/salasanasi-matomo-proxy.conf /etc/nginx/snippets/salasanasi-matomo-proxy.conf
	sudo install -o root -g root -m 644 /tmp/salasanasi-data-proxy.conf /etc/nginx/snippets/salasanasi-data-proxy.conf
	sudo install -o root -g root -m 644 /tmp/salasanasi-headers.conf /etc/nginx/snippets/salasanasi-headers.conf
	sudo install -o root -g root -m 644 /tmp/salasanasi-headers-vuodot.conf /etc/nginx/snippets/salasanasi-headers-vuodot.conf

	install_conf() {
		sudo install -o root -g root -m 644 \"/tmp/\$1\" \"/etc/nginx/sites-available/\$site\"
		sudo ln -sfn \"/etc/nginx/sites-available/\$site\" \"/etc/nginx/sites-enabled/\$site\"
		sudo nginx -t
		sudo systemctl reload nginx
	}

	# sudo test: /etc/letsencrypt/live on 0700 rootille, joten tavallinen käyttäjä ei
	# näe hakemistoa ja tarkistus luulisi varmennetta puuttuvaksi joka ajolla — mikä
	# pudottaisi HTTPS:n bootstrap-konfiguraation ajaksi jokaisella ajolla.
	if ! sudo test -d \"/etc/letsencrypt/live/\$site\"; then
		echo '--> no certificate yet, bootstrapping over HTTP'
		install_conf \"\$site.bootstrap.nginx\"
		sudo certbot certonly --webroot -w \"\$webroot\" \\
			-d \"\$site\" -d \"www.\$site\" \\
			--non-interactive --agree-tos --keep-until-expiring
	fi

	install_conf \"\$site.nginx\"
	rm -f \"/tmp/\$site.nginx\" \"/tmp/\$site.bootstrap.nginx\" \
		/tmp/salasanasi-shared.conf /tmp/salasanasi-matomo-proxy.conf \
		/tmp/salasanasi-data-proxy.conf \
		/tmp/salasanasi-headers.conf /tmp/salasanasi-headers-vuodot.conf
	echo \"--> \$webroot is owned by \$owner; content deploys need no sudo\""

echo "==> done — now publish the content with ./tools/deploy-site.sh $HOST"
