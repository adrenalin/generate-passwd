#!/bin/sh
# SPDX-License-Identifier: LGPL-3.0-or-later
# Publish the salasanasi.fi site to the web host.
#
#   ./tools/deploy-site.sh [host]
#
# Copies web/ plus the wordlists to the document root, installs the news builder
# and its cron entry, and checks that the nginx configuration on the host still
# matches the one in deploy/.
#
# THIS SCRIPT NEEDS NO ROOT. The document root belongs to the login user, so a
# routine deploy is an rsync and nothing more — no sudo, passwordless or
# otherwise. Anything that does need root — the nginx configuration, the
# certificate, creating the document root in the first place — lives in
# tools/deploy-nginx.sh, which is run by hand on the rare occasions it changes
# and may prompt for a sudo password.
#
# Copyright (C) 2026 Arttu Manninen.  Licensed under the GNU LGPL v3 or later;
# see COPYING.LESSER.
set -eu

HOST="${1:-${SALASANASI_HOST:-salasanasi.fi}}"
SITE=salasanasi.fi
WEBROOT="/var/www/$SITE"

# Marker on the cron line so it can be recognised and replaced without touching
# whatever else the user keeps in their crontab.
CRON_MARKER="# salasanasi.fi news"

cd "$(dirname "$0")/.."

# The news page is rendered at build time from the NCSC-FI feed, so /uutiset is
# plain HTML with no third-party request in the visitor's browser. A stale list
# beats an empty one: if the feed is unreachable, the committed page is published
# as it stands and the deploy carries on. Between deploys the cron job installed
# below keeps the published page current.
echo "==> rebuilding /uutiset from the NCSC-FI feed"
if ! ./tools/build-news.py; then
	echo "  feed unavailable, publishing the committed web/uutiset.html unchanged" >&2
fi

# Every page must be listed in the sitemap. The canonical URL comes from the page
# itself, so this catches both a page missing from the sitemap and a page with no
# canonical link at all.
#
# The one exemption is a page that declares <meta name="robots" content="noindex">.
# Listing a noindex page in the sitemap tells crawlers to index it and not to index
# it in the same breath, so the rule is really "every indexable page belongs in the
# sitemap". A shadow page opts out by being noindex, and the moment that meta tag
# goes, this check demands the sitemap entry again.
echo "==> checking sitemap covers every page"
missing=0
for page in web/*.html; do
	if grep -qi '<meta name="robots"[^>]*noindex' "$page"; then
		echo "  $page is noindex, not expected in the sitemap"
		continue
	fi
	url=$(sed -n 's|.*<link rel="canonical" href="\([^"]*\)".*|\1|p' "$page" | head -1)
	if [ -z "$url" ]; then
		echo "  $page has no <link rel=\"canonical\">" >&2
		missing=1
		continue
	fi
	if ! grep -qF "<loc>$url</loc>" web/sitemap.xml; then
		echo "  $url ($page) is not in web/sitemap.xml" >&2
		missing=1
	fi
done
if [ "$missing" -ne 0 ]; then
	echo "Every page belongs in web/sitemap.xml. Add it, then deploy again." >&2
	exit 1
fi

echo "==> staging $SITE"
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
cp -R web/. "$STAGE/"
cp wordlist-fi.txt wordlist-en.txt "$STAGE/"

# Version the assets by content so they can be cached for a year without a deploy
# ever serving a stale one. The filenames stay put — only the reference gains a
# ?v=, which is enough to make it a different cache entry. tools/build-news.py
# --assets does the same for the page cron rewrites on the host.
for asset in style.css app.js analytics.js breach-terms.js vuodot.js tietovuodot.js \
		vahvuus.js vendor/zxcvbn-core.js vendor/zxcvbn-common.js; do
	version=$(sha256sum "$STAGE/$asset" | cut -c1-10)
	sed -i "s|\"/$asset\"|\"/$asset?v=$version\"|g" "$STAGE"/*.html
	echo "    $asset -> ?v=$version"
done

# The document root must exist and belong to the login user. It is created that
# way by tools/deploy-nginx.sh; failing here with an instruction beats failing
# inside rsync with a permission error.
if ! ssh "$HOST" "test -w '$WEBROOT'"; then
	echo "$HOST:$WEBROOT is missing or not writable by $(ssh "$HOST" id -un)." >&2
	echo "Run ./tools/deploy-nginx.sh $HOST once — it creates it and hands it over." >&2
	exit 1
fi

# RFC 9116 requires an Expires field and treats a past one as invalid, so the date
# is stamped at publish time rather than left to rot in the repo: a year from now,
# refreshed by every deploy.
expires=$(date -u -d '+1 year' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v+1y +%Y-%m-%dT%H:%M:%SZ)
sed -i "s|^Expires: .*|Expires: $expires|" "$STAGE/.well-known/security.txt"
echo "    security.txt expires $expires"

echo "==> copying to $HOST:$WEBROOT"
rsync -rlt --delete --chmod=D755,F644 --exclude '.well-known/acme-challenge' \
	-e ssh "$STAGE/" "$HOST:$WEBROOT/"

# The headlines would otherwise be as old as the last deploy. The builder runs on
# the host from cron and writes straight into the document root — which the login
# user owns, so this needs no root either. The crontab line is rewritten every
# deploy so a change of schedule or path here reaches the host.
echo "==> installing the news builder and its cron entry"
scp -q tools/build-news.py "$HOST:/tmp/salasanasi-build-news.py"
ssh "$HOST" "set -eu
	mkdir -p \"\$HOME/bin\" \"\$HOME/.local/state\"
	install -m 755 /tmp/salasanasi-build-news.py \"\$HOME/bin/salasanasi-build-news.py\"
	rm -f /tmp/salasanasi-build-news.py

	# 06:20 and 16:20 UTC. The Friday review lands about 05:40 UTC, so the morning
	# run catches it the same day, and the afternoon run picks up anything since.
	line=\"20 6,16 * * * \$HOME/bin/salasanasi-build-news.py --output $WEBROOT/uutiset.html --assets $WEBROOT >> \$HOME/.local/state/salasanasi-news.log 2>&1 $CRON_MARKER\"

	tab=\$(mktemp)
	crontab -l 2>/dev/null | grep -vF '$CRON_MARKER' > \"\$tab\" || true
	echo \"\$line\" >> \"\$tab\"
	crontab \"\$tab\"
	rm -f \"\$tab\"
	crontab -l | grep -F '$CRON_MARKER' | sed 's|^|    |'"

# The nginx configuration is deployed separately and rarely, so it can drift
# behind the repo without anyone noticing. Compare it here — reading /etc/nginx
# needs no privileges — and say so rather than silently serving an old config.
echo "==> checking the nginx configuration on $HOST"
remote_sums=$(ssh "$HOST" "sha256sum \
	/etc/nginx/conf.d/salasanasi-shared.conf \
	/etc/nginx/snippets/salasanasi-headers.conf \
	/etc/nginx/snippets/salasanasi-headers-vuodot.conf \
	/etc/nginx/snippets/salasanasi-matomo-proxy.conf \
	/etc/nginx/snippets/salasanasi-data-proxy.conf \
	/etc/nginx/sites-available/$SITE 2>/dev/null" || true)

stale=0
for pair in \
	"deploy/salasanasi-shared.conf:/etc/nginx/conf.d/salasanasi-shared.conf" \
	"deploy/salasanasi-headers.conf:/etc/nginx/snippets/salasanasi-headers.conf" \
	"deploy/salasanasi-headers-vuodot.conf:/etc/nginx/snippets/salasanasi-headers-vuodot.conf" \
	"deploy/salasanasi-matomo-proxy.conf:/etc/nginx/snippets/salasanasi-matomo-proxy.conf" \
	"deploy/salasanasi-data-proxy.conf:/etc/nginx/snippets/salasanasi-data-proxy.conf" \
	"deploy/$SITE.nginx:/etc/nginx/sites-available/$SITE"; do
	local_file=${pair%%:*}
	remote_file=${pair#*:}
	want=$(sha256sum "$local_file" | cut -d' ' -f1)
	have=$(printf '%s\n' "$remote_sums" | sed -n "s|^\([0-9a-f]*\)  $remote_file\$|\1|p")
	if [ "$want" != "$have" ]; then
		echo "  $local_file differs from $remote_file" >&2
		stale=1
	fi
done
if [ "$stale" -ne 0 ]; then
	echo "  nginx config on the host is behind the repo — run ./tools/deploy-nginx.sh $HOST" >&2
fi

echo "==> done: https://www.$SITE/"
