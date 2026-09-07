#!/usr/bin/env python3
# SPDX-License-Identifier: LGPL-3.0-or-later
# Build web/uutiset.html from the NCSC-FI news feed.
#
#   ./tools/build-news.py [--items N] [--output PATH]
#
# Kyberturvallisuuskeskus (Traficom) publishes its news as a public RSS feed. The
# page is rendered here, at build time, rather than fetched by the visitor's
# browser. That keeps three promises the rest of the site makes: the browser never
# talks to a third party, the page needs no JavaScript, and the site's
# connect-src 'self' CSP stays untouched. The trade-off is that the page is only
# as fresh as the last deploy, so it says out loud when it was picked up.
#
# tools/deploy-site.sh runs this before staging and tolerates a failure: if the
# feed is unreachable, the committed page is published as-is rather than a broken
# or empty one.
#
# Copyright (C) 2026 Arttu Manninen.  Licensed under the GNU LGPL v3 or later;
# see COPYING.LESSER.

import argparse
import html
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

FEED_URL = "https://www.kyberturvallisuuskeskus.fi/feed/rss/fi"
SOURCE_URL = "https://www.kyberturvallisuuskeskus.fi/fi/ajankohtaista"
USER_AGENT = "salasanasi.fi news builder (+https://www.salasanasi.fi/uutiset)"
TIMEOUT = 30

MONTHS = [
    "tammikuuta", "helmikuuta", "maaliskuuta", "huhtikuuta", "toukokuuta", "kesäkuuta",
    "heinäkuuta", "elokuuta", "syyskuuta", "lokakuuta", "marraskuuta", "joulukuuta",
]


def finnish_date(moment):
    return f"{moment.day}. {MONTHS[moment.month - 1]} {moment.year}"


def clean_text(value, limit=None):
    """Strip markup and collapse whitespace; the feed carries HTML in CDATA."""
    text = re.sub(r"<[^>]*>", "", value or "")
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    if limit and len(text) > limit:
        cut = text[:limit].rsplit(" ", 1)[0]
        text = cut.rstrip(",.;:") + "…"
    return text


def clean_link(url):
    """Drop the feed's own campaign parameters (mtm_source=rss and friends).

    They are Matomo tracking parameters for the source site's statistics. Passing
    them on would mean every visitor who follows a link from here is tagged as
    feed traffic, which is both wrong and none of our business to hand over.
    """
    url = (url or "").strip()
    if "?" not in url:
        return url
    base, _, query = url.partition("?")
    kept = [
        part for part in query.split("&")
        if part and not part.split("=", 1)[0].startswith(("mtm_", "utm_"))
    ]
    return base + ("?" + "&".join(kept) if kept else "")


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return response.read()


def parse(raw, limit):
    channel = ET.fromstring(raw).find("channel")
    if channel is None:
        raise ValueError("feed has no <channel>")

    items = []
    for item in channel.findall("item"):
        title = clean_text(item.findtext("title"))
        link = clean_link(item.findtext("link"))
        if not title or not link.startswith("https://"):
            continue
        try:
            published = parsedate_to_datetime(item.findtext("pubDate") or "")
        except (TypeError, ValueError):
            continue
        if published.tzinfo is None:
            published = published.replace(tzinfo=timezone.utc)
        items.append({
            "title": title,
            "link": link,
            "published": published,
            "summary": clean_text(item.findtext("description"), 320),
        })

    items.sort(key=lambda entry: entry["published"], reverse=True)
    if not items:
        raise ValueError("feed had no usable items")
    return items[:limit]


def render_items(items):
    out = []
    for entry in items:
        out.append(
            '\t\t<li>\n'
            '\t\t\t<p class="news-date">{date}</p>\n'
            '\t\t\t<h3><a href="{link}" rel="noopener">{title}</a></h3>\n'
            '{summary}'
            '\t\t</li>'.format(
                date=html.escape(finnish_date(entry["published"])),
                link=html.escape(entry["link"], quote=True),
                title=html.escape(entry["title"]),
                summary=(
                    '\t\t\t<p class="news-summary">%s</p>\n' % html.escape(entry["summary"])
                    if entry["summary"] else ""
                ),
            )
        )
    return "\n".join(out)


PAGE = """<!doctype html>
<html lang="fi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tietoturvauutiset – salasanasi.fi</title>
<meta name="description" content="Kyberturvallisuuskeskuksen tuoreimmat tiedotteet ja varoitukset koottuna. Huijaukset, tietomurrot ja haavoittuvuudet, jotka koskevat Suomea.">
<meta name="color-scheme" content="light">
<meta name="theme-color" content="#2a6ebb">
<meta property="og:type" content="website">
<meta property="og:site_name" content="salasanasi.fi">
<meta property="og:locale" content="fi_FI">
<meta property="og:url" content="https://www.salasanasi.fi/uutiset">
<meta property="og:title" content="Tietoturvauutiset – salasanasi.fi">
<meta property="og:description" content="Kyberturvallisuuskeskuksen tuoreimmat tiedotteet ja varoitukset koottuna. Huijaukset, tietomurrot ja haavoittuvuudet, jotka koskevat Suomea.">
<meta property="og:image" content="https://www.salasanasi.fi/salasanasi.fi.jpg">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="salasanasi.fi – Vahvoja salasanoja suomen kielen sanoista">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Tietoturvauutiset – salasanasi.fi">
<meta name="twitter:description" content="Kyberturvallisuuskeskuksen tuoreimmat tiedotteet ja varoitukset koottuna. Huijaukset, tietomurrot ja haavoittuvuudet, jotka koskevat Suomea.">
<meta name="twitter:image" content="https://www.salasanasi.fi/salasanasi.fi.jpg">
<meta name="twitter:image:alt" content="salasanasi.fi – Vahvoja salasanoja suomen kielen sanoista">
<link rel="canonical" href="https://www.salasanasi.fi/uutiset">
<link rel="preload" href="/fonts/source-sans-3-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/source-sans-3-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/style.css">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<script src="/analytics.js" defer></script>
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "@id": "https://www.salasanasi.fi/uutiset#page",
  "url": "https://www.salasanasi.fi/uutiset",
  "name": "Tietoturvauutiset",
  "description": "Kyberturvallisuuskeskuksen tuoreimmat tiedotteet ja varoitukset koottuna.",
  "inLanguage": "fi-FI",
  "isPartOf": {{ "@id": "https://www.salasanasi.fi/#website" }},
  "dateModified": "{built_iso}",
  "publisher": {{
    "@type": "Organization",
    "@id": "https://www.vapaaradikaali.fi/#organization",
    "name": "Vapaaradikaali",
    "url": "https://www.vapaaradikaali.fi",
    "vatID": "FI23028524",
    "taxID": "2302852-4"
  }}
}}
</script>
</head>
<body>

<header class="site-header">
\t<div class="bar">
\t\t<a class="wordmark" href="/">
\t\t\t<svg class="mark" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" focusable="false">
\t\t\t\t<rect width="32" height="32" rx="2" fill="#00357a"/>
\t\t\t\t<path d="M11 14v-3a5 5 0 0 1 10 0v3" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
\t\t\t\t<rect x="8" y="14" width="16" height="12" rx="1.5" fill="#fff"/>
\t\t\t\t<circle cx="12.5" cy="20" r="1.5" fill="#00357a"/>
\t\t\t\t<circle cx="16" cy="20" r="1.5" fill="#00357a"/>
\t\t\t\t<circle cx="19.5" cy="20" r="1.5" fill="#00357a"/>
\t\t\t</svg>
\t\t\t<span class="name">salasanasi<span class="tld">.fi</span></span>
\t\t</a>

\t\t<nav class="site-nav" aria-label="Päävalikko">
\t\t\t<a href="/">Salasanageneraattori</a>
\t\t\t<a href="/vuodot">Vuototarkistus</a>
\t\t\t<a href="/tietovuodot">Vuotoluettelo</a>
\t\t\t<a href="/vahvuus">Vahvuustesti</a>
\t\t\t<a href="/uutiset" class="is-current" aria-current="page">Uutiset</a>
\t\t</nav>
\t</div>
</header>

<div class="hero">
\t<div class="hero-inner">
\t\t<h1 class="hero-title">Tietoturvauutiset</h1>
\t\t<p class="hero-lead">
\t\t\tKyberturvallisuuskeskuksen tuoreimmat tiedotteet: huijaukset, tietomurrot ja
\t\t\thaavoittuvuudet, jotka koskevat Suomea.
\t\t</p>
\t</div>
</div>

<main>

<section class="generator" aria-label="Tietoturvauutiset">
\t<p class="check-lead">
\t\tOtsikot ovat <a href="https://www.kyberturvallisuuskeskus.fi/">Liikenne- ja
\t\tviestintävirasto Traficomin Kyberturvallisuuskeskuksen</a> omia, ja jokainen linkki
\t\tvie heidän sivulleen. Poimittu {built_fi}.
\t</p>

\t<ol class="news">
{items}
\t</ol>

\t<p class="note">
\t\tKaikki tiedotteet ja niiden koko sisältö ovat
\t\t<a href="{source_url}">Kyberturvallisuuskeskuksen sivuilla</a>. Lista päivittyy,
\t\tkun sivusto julkaistaan uudelleen, joten tuoreimmat tiedotteet kannattaa lukea
\t\tsuoraan lähteestä.
\t</p>
</section>

<section class="prose">

\t<h2 id="miksi-tama-sivu">Miksi nämä uutiset ovat täällä</h2>
\t<p>
\t\tVahva salasana on vain puolet suojasta. Toinen puoli on tietää, mitä juuri nyt
\t\tliikkuu: mihin pankin nimissä tehty tekstiviesti tähtää, mikä palvelu on vuotanut
\t\ttällä viikolla, mikä ohjelmisto pitää päivittää tänään. Kyberturvallisuuskeskus
\t\ton se taho, joka Suomessa nämä kertoo, eikä sen tiedotteita lue tarpeeksi moni.
\t</p>
\t<p>
\t\tJos otsikko koskee palvelua, jota käytät, kannattaa tehdä kaksi asiaa:
\t\t<a href="/vuodot">tarkistaa oma osoite vuototarkistuksesta</a> ja
\t\t<a href="/">vaihtaa salasana arvottuun</a>. Molemmat vievät minuutin.
\t</p>

\t<h2 id="mista-tiedot">Mistä tiedot tulevat ja miten</h2>
\t<ul class="facts">
\t\t<li>
\t\t\t<strong>Lähde on Kyberturvallisuuskeskuksen julkinen RSS-syöte.</strong> Otsikot
\t\t\tja tiivistelmät ovat heidän tekstiään, lyhennettyinä. Emme kirjoita niitä uusiksi
\t\t\temmekä kommentoi niitä.
\t\t</li>
\t\t<li>
\t\t\t<strong>Selaimesi ei ota yhteyttä heidän palvelimeensa</strong> ennen kuin
\t\t\tnapautat linkkiä. Syöte haetaan julkaisun yhteydessä ja sivu tallennetaan valmiiksi,
\t\t\tjoten tämä sivu on tavallista HTML:ää: ei skriptejä, ei upotuksia, ei jäljityskuvia.
\t\t</li>
\t\t<li>
\t\t\t<strong>Linkeistä on poistettu seurantaparametrit</strong> (<code>mtm_source</code>
\t\t\tja vastaavat), jotka syöte niihin lisää. Napautuksesi kirjautuu heille tavallisena
\t\t\tkäyntinä eikä kampanjaliikenteenä.
\t\t</li>
\t\t<li>
\t\t\t<strong>Lista on niin tuore kuin viimeisin julkaisu.</strong> Päiväys kertoo, milloin
\t\t\tse on poimittu. Jos etsit varmasti tuoreinta tietoa, lue se
\t\t\t<a href="{source_url}">suoraan lähteestä</a>.
\t\t</li>
\t</ul>

</section>

</main>

<footer class="site-footer">
\t<div class="footer-inner">
\t\t<p>
\t\t\t<a href="/">Takaisin salasanageneraattoriin</a> ·
\t\t\t<a href="https://github.com/adrenalin/generate-passwd">Lähdekoodi GitHubissa</a> ·
\t\t\tGNU LGPL v3 tai uudempi
\t\t</p>
\t\t<p class="fine">
\t\t\tPalvelun tarjoaa <a href="https://www.vapaaradikaali.fi">Vapaaradikaali</a>, Y-tunnus 2302852-4.
\t\t\t<a href="/tietosuoja">Tietosuojaseloste</a>.
\t\t</p>
\t\t<p class="fine">
\t\t\tUutisotsikot © <a href="https://www.kyberturvallisuuskeskus.fi/">Liikenne- ja viestintävirasto
\t\t\tTraficom, Kyberturvallisuuskeskus</a> · poimittu {built_fi}
\t\t</p>
\t</div>
</footer>

</body>
</html>
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--items", type=int, default=12, help="how many headlines to show")
    parser.add_argument("--output", default="web/uutiset.html", help="where to write the page")
    parser.add_argument("--feed", default=FEED_URL, help="feed URL to read")
    args = parser.parse_args()

    try:
        items = parse(fetch(args.feed), args.items)
    except Exception as error:                      # noqa: BLE001 - any failure is the same failure
        print(f"build-news: could not build from {args.feed}: {error}", file=sys.stderr)
        return 1

    built = datetime.now(timezone.utc)
    page = PAGE.format(
        items=render_items(items),
        built_fi=html.escape(finnish_date(built)),
        built_iso=built.date().isoformat(),
        source_url=SOURCE_URL,
    )

    Path(args.output).write_text(page, encoding="utf-8")
    print(f"build-news: wrote {args.output} with {len(items)} headlines")
    return 0


if __name__ == "__main__":
    sys.exit(main())
