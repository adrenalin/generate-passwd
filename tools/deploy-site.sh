#!/bin/sh
# SPDX-License-Identifier: LGPL-3.0-or-later
# Deploy the salasanasi.fi site to the web host.
#
#   ./tools/deploy-site.sh [host]
#
# Copies web/ plus the wordlists to the web root, installs the nginx site and
# reloads nginx. On the first run it also obtains a Let's Encrypt certificate:
# the HTTP-only bootstrap config is installed just long enough for the ACME
# challenge, then the real HTTPS config replaces it. Idempotent afterwards.
#
# Copyright (C) 2026 Arttu Manninen.  Licensed under the GNU LGPL v3 or later;
# see COPYING.LESSER.
set -eu

HOST="${1:-${SALASANASI_HOST:-kaktus.cc}}"
SITE=salasanasi.fi
WEBROOT="/var/www/$SITE"

cd "$(dirname "$0")/.."

echo "==> staging $SITE"
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
cp -R web/. "$STAGE/"
cp wordlist-fi.txt wordlist-en.txt "$STAGE/"

echo "==> copying to $HOST:$WEBROOT"
ssh "$HOST" "sudo install -d -o www-data -g www-data -m 755 $WEBROOT"
rsync -rlt --delete --chmod=D755,F644 --exclude '.well-known' \
	-e ssh --rsync-path='sudo rsync' \
	"$STAGE/" "$HOST:$WEBROOT/"

echo "==> installing nginx site"
scp -q "deploy/$SITE.nginx" "deploy/$SITE.bootstrap.nginx" \
	deploy/salasanasi-shared.conf deploy/salasanasi-matomo-proxy.conf "$HOST:/tmp/"
ssh "$HOST" "set -eu
	site=$SITE
	webroot=$WEBROOT
	sudo install -d -m 755 /var/log/nginx/accesslogs
	sudo chown -R www-data:www-data \"\$webroot\"

	# http-tason vyöhykkeet ja mittausproxyn otsakkeet ensin: vhost viittaa niihin,
	# joten väärässä järjestyksessä nginx -t kaatuisi.
	sudo install -o root -g root -m 644 /tmp/salasanasi-shared.conf /etc/nginx/conf.d/salasanasi-shared.conf
	sudo install -o root -g root -m 644 /tmp/salasanasi-matomo-proxy.conf /etc/nginx/snippets/salasanasi-matomo-proxy.conf

	install_conf() {
		sudo install -o root -g root -m 644 \"/tmp/\$1\" \"/etc/nginx/sites-available/\$site\"
		sudo ln -sfn \"/etc/nginx/sites-available/\$site\" \"/etc/nginx/sites-enabled/\$site\"
		sudo nginx -t
		sudo systemctl reload nginx
	}

	# sudo test: /etc/letsencrypt/live on 0700 rootille, joten tavallinen käyttäjä ei
	# näe hakemistoa ja tarkistus luulisi varmennetta puuttuvaksi joka ajolla — mikä
	# pudottaisi HTTPS:n bootstrap-konfiguraation ajaksi jokaisessa julkaisussa.
	if ! sudo test -d \"/etc/letsencrypt/live/\$site\"; then
		echo '--> no certificate yet, bootstrapping over HTTP'
		install_conf \"\$site.bootstrap.nginx\"
		sudo certbot certonly --webroot -w \"\$webroot\" \\
			-d \"\$site\" -d \"www.\$site\" \\
			--non-interactive --agree-tos --keep-until-expiring
	fi

	install_conf \"\$site.nginx\"
	rm -f \"/tmp/\$site.nginx\" \"/tmp/\$site.bootstrap.nginx\" \
		/tmp/salasanasi-shared.conf /tmp/salasanasi-matomo-proxy.conf"

echo "==> done: https://www.$SITE/"
