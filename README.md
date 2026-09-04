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
| `-w`, `--words` | default mode | Generate words; ignored when `--string` is given |
| `--language CODE` | `fi` | Which wordlist to draw from: `fi` or `en` (word mode only) |
| `--word-separator CHAR` | `-` | What to put between the words |
| `-c`, `--word-count N` | `8` | How many words the password contains |
| `-q`, `--quantity N` | `5` | How many passwords to generate |
| `-V`, `--version` | | Print the version |

`--string` always wins over `--words`.

In word mode `--mixed-case` capitalises each word independently at random, so
the capitalisation pattern itself carries a bit of entropy rather than being a
fixed Title-Case shape. In string mode the alphabet is `a-z0-9`, plus `A-Z`
when `--mixed-case` is on.

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

<https://salasanasi.fi> is the same generator as a static page, in Finnish.
It draws from the same two wordlists and does everything in the browser with
`crypto.getRandomValues()` — nothing is sent to the server, and the page loads
no third-party resources at all (enforced by a `default-src 'none'` CSP).

The source is in `web/`, the nginx site in `deploy/`. There is a Finnish privacy
policy at `/tietosuoja`, and anonymous visitor measurement through a self-hosted
Matomo: `/stats/matomo.js` and `/stats/matomo.php` are reverse-proxied to
openmat.fi so the browser only ever talks to this origin. Tracking is cookieless,
IP addresses are masked to their first two bytes (in Matomo *and* in the nginx
access log), and DNT/GPC suppress it entirely.

Every page must appear in `web/sitemap.xml` — `tools/deploy-site.sh` reads each
page's own `<link rel="canonical">` and refuses to deploy if one is missing from
the sitemap, so a new page cannot ship unlisted.

To publish:

```sh
./tools/deploy-site.sh              # host defaults to salasanasi.fi
./tools/deploy-site.sh other.host
```

The script stages `web/` plus the wordlists, rsyncs them to
`/var/www/salasanasi.fi`, installs the nginx site and reloads. On a host with
no certificate yet it first installs `deploy/salasanasi.fi.bootstrap.nginx`
(HTTP only) so certbot can answer the ACME challenge, then swaps in the HTTPS
config. Re-running it later just updates the files.

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
