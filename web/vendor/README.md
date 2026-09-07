# Vendored kolmannen osapuolen koodi

Nämä tiedostot eivät ole osa `generate-passwd`-projektia. Ne ovat mukana
sellaisenaan, jotta `/vahvuus` toimii ilman ulkopuolisia CDN-hakuja: sivuston
CSP on `script-src 'self'`, eikä yhtään skriptiä haeta muualta.

| Tiedosto | Paketti | Versio | Lisenssi |
| --- | --- | --- | --- |
| `zxcvbn-core.js` | [@zxcvbn-ts/core](https://github.com/zxcvbn-ts/zxcvbn) | 3.0.4 | MIT |
| `zxcvbn-common.js` | [@zxcvbn-ts/language-common](https://github.com/zxcvbn-ts/zxcvbn) | 3.0.4 | MIT |

Lisenssiteksti on `LICENSE.zxcvbn-ts.txt`.

Molemmat ovat pakettien julkaistuja UMD-käännöksiä (`dist/zxcvbn-ts.js`)
muuttamattomina. Päivitys:

```sh
curl -Lo web/vendor/zxcvbn-core.js \
	https://cdn.jsdelivr.net/npm/@zxcvbn-ts/core@3.0.4/dist/zxcvbn-ts.js
curl -Lo web/vendor/zxcvbn-common.js \
	https://cdn.jsdelivr.net/npm/@zxcvbn-ts/language-common@3.0.4/dist/zxcvbn-ts.js
```

`@zxcvbn-ts/language-en` on tarkoituksella jätetty pois: se on pakkaamattomana
1,2 Mt (gzipattuna ~570 kt) englanninkielistä sanastoa, kun koko muu sivu on
alle 300 kt. Sen tilalla sanakirjoina ovat sivuston omat `wordlist-fi.txt` ja
`wordlist-en.txt`, jotka selain lataa joka tapauksessa generaattoria varten.
`language-common` (yleisimmät salasanat ja näppäimistökuviot) on se osa, jota
ilman arvio olisi oikeasti huonompi, joten se on mukana.
