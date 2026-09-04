# generate-passwd

A small CLI that prints random passwords. Two modes: word phrases (the default)
and random character strings.

```
$ generate-passwd
Bossed-snorting-aorta-holistic-diners-Outlying-haired-Unwinds
sitting-Fishy-pimentos-greeting-waiter-gadgets-Minces-Striated
...

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

`make install` puts the script in `$PREFIX/bin` and the wordlist in
`$PREFIX/share/generate-passwd/wordlist.txt`. The script finds the wordlist
relative to its own location, so any prefix works.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `-l`, `--length N` | `32` | Password length in characters (string mode only) |
| `-m`, `--mixed-case` / `--no-mixed-case` | on | Mix lowercase and uppercase |
| `-s`, `--string` | off | Generate a random character string |
| `-w`, `--words` | default mode | Generate words; ignored when `--string` is given |
| `--word-separator CHAR` | `-` | What to put between the words |
| `-c`, `--word-count N` | `8` | How many words the password contains |
| `-q`, `--quantity N` | `5` | How many passwords to generate |
| `-V`, `--version` | | Print the version |

`--string` always wins over `--words`.

In word mode `--mixed-case` capitalises each word independently at random, so
the capitalisation pattern itself carries a bit of entropy rather than being a
fixed Title-Case shape. In string mode the alphabet is `a-z0-9`, plus `A-Z`
when `--mixed-case` is on.

## Strength

The bundled wordlist has 34,790 words, so each word is worth ~15.1 bits, plus 1
bit for its random capitalisation.

| Command | Entropy |
| --- | --- |
| `generate-passwd` (8 words, mixed case) | ~129 bits |
| `generate-passwd --no-mixed-case` | ~121 bits |
| `generate-passwd -s` (32 chars, mixed case) | ~191 bits |
| `generate-passwd -s --no-mixed-case` | ~165 bits |

## Wordlist

`wordlist.txt` is generated from the Debian/Ubuntu `wamerican` dictionary:
lowercase ASCII words of 4-8 letters, minus a blocklist of slurs and profanity.

```sh
make wordlist                              # from /usr/share/dict/american-english
./tools/build-wordlist.sh /path/to/dict > wordlist.txt
```

To use a different list without reinstalling, point `GENERATE_PASSWD_WORDLIST`
at it (one word per line):

```sh
GENERATE_PASSWD_WORDLIST=~/eff_large_wordlist.txt generate-passwd
```

Otherwise the script searches, in order: next to itself,
`../share/generate-passwd/wordlist.txt` relative to itself,
`/usr/local/share/generate-passwd/wordlist.txt`,
`/usr/share/generate-passwd/wordlist.txt`, and finally `/usr/share/dict/words`.

## Tests

```sh
make test
```
