# generate-passwd

A small CLI that prints random passwords. Two modes: word phrases (the default)
and random character strings. Words come from a Finnish list by default, with
English available via `--language en`.

```
$ generate-passwd
lapio-takertua-seniori-muija-Joteskin-kudin-keinu-Diakuva
kuroa-Sektori-Viljelys-nauttia-aromikas-kidukset-Bluffi-Jäätie
...

$ generate-passwd --language en --word-count 4 --quantity 2
withdraw-Surly-devalues-Gabbiest
bugging-Fiches-Treaties-Biggie

$ generate-passwd --string --length 16 --quantity 2
jPB8WEeVg4JN6Buk
ba8LM0pKEW5hwEi1
```

Python 3 standard library only, no dependencies. Randomness comes from
`secrets.SystemRandom`, i.e. the OS CSPRNG (`getrandom(2)`).

## Install

```sh
sudo make install          # /usr/local/bin/generate-passwd
make install PREFIX=~/.local
sudo make uninstall
```

`make install` puts the script in `$PREFIX/bin` and the wordlists in
`$PREFIX/share/generate-passwd/`. The script finds them relative to its own
location, so any prefix works.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `-l`, `--length N` | `32` | Password length in characters (string mode only) |
| `-m`, `--mixed-case` / `--no-mixed-case` | on | Mix lowercase and uppercase |
| `-s`, `--string` | off | Generate a random character string |
| `-S`, `--symbols` / `--no-symbols` | off | Add punctuation `!#$%&()*+,-./:;<=>?@[]^_{\|}~` (string mode only) |
| `-w`, `--words` | default mode | Generate words; ignored when `--string` is given |
| `--language CODE` | `fi` | Which wordlist to draw from: `fi` or `en` (word mode only) |
| `--word-separator CHAR` | `-` | What to put between the words |
| `-c`, `--word-count N` | `8` | How many words the password contains |
| `-q`, `--quantity N` | `5` | How many passwords to generate |
| `-V`, `--version` | | Print the version |

`--string` always wins over `--words`.

In word mode `--mixed-case` capitalises each word independently at random, so
the capitalisation pattern itself carries a bit of entropy rather than being a
fixed Title-Case shape. In string mode the alphabet is `a-z0-9`, plus `A-Z` when `--mixed-case` is on and
the punctuation above when `--symbols` is on. A string is redrawn if it happens to
contain no character from one of the enabled classes — uniform draws leave a class
out often enough at short lengths to trip a "must contain a number" form, and
rejecting those keeps the result uniform over the strings that do satisfy the rule.
Below one character per class the rule is unsatisfiable and is skipped.

Finnish passwords contain `ä` and `ö`. That is deliberate — it is what makes
them Finnish — but a few systems still reject non-ASCII in a password field.
Use `--language en` or `--string` for those.

## Strength

| Command | Entropy |
| --- | --- |
| `generate-passwd` (8 Finnish words, mixed case) | ~124 bits |
| `generate-passwd --no-mixed-case` | ~116 bits |
| `generate-passwd --language en` (8 English words, mixed case) | ~129 bits |
| `generate-passwd --language en --no-mixed-case` | ~121 bits |
| `generate-passwd -s` (32 chars, mixed case) | ~191 bits |
| `generate-passwd -s --symbols` | ~208 bits |
| `generate-passwd -s --no-mixed-case` | ~165 bits |

Per word: 14.5 bits from `wordlist-fi.txt` (22,852 words) or 15.1 bits from
`wordlist-en.txt` (34,790 words), plus 1 bit for its random capitalisation.

## Wordlists

Both lists hold lowercase words of 4-8 letters with a blocklist of slurs and
profanity removed. Rebuild them with:

```sh
make wordlist                                  # both
./tools/build-wordlist.sh en > wordlist-en.txt # from /usr/share/dict/american-english
./tools/build-wordlist.sh fi > wordlist-fi.txt # downloads the Kotus list
./tools/build-wordlist.sh fi /path/to/local/kaikkisanat.txt > wordlist-fi.txt
```

Adding a language is just dropping a `wordlist-<code>.txt` (one word per line)
next to the others; `--language <code>` picks it up. To use a list without
installing it, point `GENERATE_PASSWD_WORDLIST` at the file — it overrides
`--language` entirely:

```sh
GENERATE_PASSWD_WORDLIST=~/eff_large_wordlist.txt generate-passwd
```

Otherwise the script searches, in order: next to itself,
`../share/generate-passwd/` relative to itself, `/usr/local/share/generate-passwd/`,
and `/usr/share/generate-passwd/`, falling back to `/usr/share/dict/words` for
`--language en`.

### Sources

- `wordlist-en.txt` — derived from `/usr/share/dict/american-english`
  (Debian/Ubuntu `wamerican`, public domain / SCOWL permissive licence).
- `wordlist-fi.txt` — derived from *Nykysuomen sanalista*, © Kotimaisten
  kielten keskus (Institute for the Languages of Finland), released under the
  GNU LGPL: <https://kaino.kotus.fi/sanat/nykysuomi/>. Retrieved via
  <https://github.com/hugovk/everyfinnishword>.

## Website

<https://salasanasi.fi> is the same generator as a static page, in Finnish,
plus four more pages built around it. The generator draws from the same two
wordlists and does everything in the browser with `crypto.getRandomValues()` —
nothing is sent to the server, and the page loads no third-party resources at
all (enforced by a `default-src 'none'` CSP).

| Path | What it is | Where the data comes from |
| --- | --- | --- |
| `/` | The generator | Nothing leaves the browser |
| `/vuodot` | Leak check for one address or one password | The browser asks XposedOrNot and Pwned Passwords directly |
| `/tietovuodot` | Catalogue of known breaches, searchable in Finnish | Have I Been Pwned (CC BY 4.0) and XposedOrNot, fetched by the server |
| `/vahvuus` | Strength estimate for a password you type | zxcvbn-ts, in the browser |
| `/uutiset` | NCSC-FI headlines | Their RSS feed, rendered at deploy time |
| `/tietosuoja` | Privacy policy | — |

Who fetches what is a deliberate split. **A query about the visitor goes
straight from their browser**: on `/vuodot` the address and the hash prefix must
not pass through our server, or the promise not to log them would rest on log
settings. **A public catalogue goes through the server**: `/tietovuodot` asks
nothing about the visitor, so `/data/tietovuodot.json` and `/data/vuotoluvut.json`
are cached reverse proxies (six hours, stale-on-error). The visitor's IP never
reaches Have I Been Pwned or XposedOrNot, the page keeps `connect-src 'self'`,
and the two sources see one request per six hours instead of one per visitor.
`/vahvuus` fetches nothing at all: `web/vendor/` carries zxcvbn-ts (MIT) so the
estimate is computed locally with the site's own wordlists as dictionaries — see
`web/vendor/README.md` for what is vendored and why `language-en` is not.
`/uutiset` is rendered by `tools/build-news.py` at deploy time, so it is ordinary
HTML with no script and no third-party request.

The source is in `web/`, the nginx site in `deploy/`. There is a Finnish privacy
policy at `/tietosuoja`, and anonymous visitor measurement through a self-hosted
Matomo: `/stats/matomo.js` and `/stats/matomo.php` are reverse-proxied to
openmat.fi so the browser only ever talks to this origin. Tracking is cookieless,
IP addresses are masked to their first two bytes (in Matomo *and* in the nginx
access log), and DNT/GPC suppress it entirely.

DNS is not deployed by these scripts — the zone lives at Hetzner and the domain's
registrar is Vapaaradikaali itself. What should be in the zone (CAA, the DNSSEC
DS handover, and the SPF/DMARC/IPv6 gaps found while auditing) is written down in
[deploy/dns.md](deploy/dns.md), along with the commands to verify each one.

Every page must appear in `web/sitemap.xml` — `tools/deploy-site.sh` reads each
page's own `<link rel="canonical">` and refuses to deploy if one is missing from
the sitemap, so a new page cannot ship unlisted.

To publish:

```sh
./tools/deploy-site.sh              # host defaults to salasanasi.fi
./tools/deploy-site.sh other.host
```

**This needs no root.** The document root belongs to the login user, so a content
deploy is an rsync: no sudo, passwordless or otherwise. The script rebuilds
`/uutiset` from the NCSC-FI feed (a failure there is not fatal — the committed
page ships unchanged), checks the sitemap, stages `web/` plus the wordlists with
versioned asset references, rsyncs them to `/var/www/salasanasi.fi`, refreshes
the news cron job, and finally compares the nginx configuration on the host with
the one in `deploy/` so it cannot drift behind unnoticed.

The half that does need root is separate and rarely run:

```sh
./tools/deploy-nginx.sh             # may prompt for a sudo password
```

It creates the document root owned by the login user, installs the http-level
config, the snippets and the vhost, runs `nginx -t` and reloads. On a host with
no certificate yet it first installs `deploy/salasanasi.fi.bootstrap.nginx`
(HTTP only) so certbot can answer the ACME challenge, then swaps in the HTTPS
config. Run it after changing anything in `deploy/` — and note that it uses
`ssh -t`, so an ordinary password-prompting sudo works fine.

`/uutiset` would otherwise be as old as the last deploy, so `deploy-site.sh`
also installs `tools/build-news.py` as `~/bin/salasanasi-build-news.py` on the
host and a crontab line that runs it at 06:20 and 16:20 UTC, writing straight
into the document root (`--assets` there stamps the same `?v=` hashes the deploy
uses, so a cron-built page cannot pin a stale stylesheet). The line is marked
`# salasanasi.fi news` and is rewritten on every deploy, so the schedule lives
in this repo and nowhere else.

## Tests

```sh
make test
```

## Licence

Copyright © 2026 Arttu Manninen. GNU Lesser General Public License, version 3
or later (`SPDX-License-Identifier: LGPL-3.0-or-later`). The full text is in
[COPYING.LESSER](COPYING.LESSER), which supplements
[COPYING](COPYING) (GPL-3.0).

This matches the licence of the bundled Kotus Finnish wordlist, so the
repository as a whole can be redistributed under the LGPL. Keep the copyright
notice and the licence files with any copy you pass on.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE.
