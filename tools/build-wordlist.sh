#!/bin/sh
# SPDX-License-Identifier: LGPL-3.0-or-later
# Regenerate a wordlist for one language.
#
# Copyright (C) 2026 Arttu Manninen.  Licensed under the GNU LGPL v3 or later;
# see COPYING.LESSER.
#
#   ./tools/build-wordlist.sh en [dictionary] > wordlist-en.txt
#   ./tools/build-wordlist.sh fi [sanalista]  > wordlist-fi.txt
#
# Keeps plain lowercase words of 4-8 letters, drops anything matching the
# language's blocklist (slurs, profanity, and words that read badly in a
# password you may have to say out loud).
#
# Sources:
#   en  /usr/share/dict/american-english, from Debian/Ubuntu `wamerican`.
#   fi  Kotus "Nykysuomen sanalista" (Kotimaisten kielten keskus), CC BY 3.0 /
#       GNU LGPL / EUPL v1.1. Downloaded if no local copy is given.
set -eu

FI_URL='https://raw.githubusercontent.com/hugovk/everyfinnishword/HEAD/kaikkisanat.txt'

BLOCK_en='^(anal|anus|arse|arses|ass|assed|asses|bastard|bitch|bitched|bitches|boob|boobs|bugger|buggers|bukkake|bum|bums|butt|butts|clit|clits|cock|cocks|coon|coons|crap|crapped|craps|cum|cums|cunt|cunts|dago|dagos|damn|damned|damns|darkie|darkies|dick|dicks|dildo|dildos|douche|douches|dyke|dykes|fag|faggot|fags|fart|farted|farts|fuck|fucked|fucker|fuckers|fucks|gook|gooks|hell|hells|hitler|homo|homos|honky|horny|hump|humped|humps|jism|jizz|kike|kikes|knob|knobs|kraut|krauts|lesbo|lesbos|milf|milfs|nazi|nazis|negro|negroes|nigga|niggas|nigger|niggers|nipple|nipples|nude|nudes|orgasm|orgasms|orgy|paki|pakis|pecker|peckers|pedo|pee|peed|pees|penis|penises|piss|pissed|pisses|poop|poops|porn|porno|porns|prick|pricks|pube|pubes|pussies|pussy|queer|queers|racist|racists|rape|raped|rapes|rapist|rectal|rectum|retard|retards|scrotum|semen|sex|sexes|sexual|sexy|shag|shags|shat|shit|shits|slut|sluts|smegma|sodomy|sperm|spic|spics|spunk|suicide|testes|testis|tit|tits|titties|titty|turd|turds|twat|twats|urine|vagina|vaginas|vulva|wank|wanks|whore|whores|willy|wog|wogs|wop|wops)$'

BLOCK_fi='^(anaali|emätin|erektio|hintti|homo|homous|huora|huorata|itsari|itsemurha|jätkätär|kikkeli|kikkeliä|kikkelit|kulli|kullit|kusi|kusinen|kusipää|kusta|kustaa|kyrpä|kyrpiä|kyrvät|lesbo|lutka|manne|masturboida|molo|mulkku|mulkut|munaa|munat|mustalainen|neekeri|nekru|nussia|nussija|nussinta|orgasmi|orja|panettaa|paska|paskainen|paskat|paskoa|penis|perse|perseet|perseily|perseillä|persus|persaukinen|pervo|pervous|pillu|pillut|pornata|porno|pyllistää|pylly|pyllyt|raiskata|raiskaus|raiskaaja|runkata|runkkari|runkku|ryssä|ryssiä|seksi|seksikäs|seksuaali|siitin|sperma|spurgu|tissi|tissit|typerys|vagina|vittu|vittua|vitut|vitutus|vittuilla|vittuilu)$'

lang="${1:?usage: build-wordlist.sh <en|fi> [source]}"
src="${2:-}"

case "$lang" in
en)
	: "${src:=/usr/share/dict/american-english}"
	cat -- "$src"
	;;
fi)
	if [ -n "$src" ]; then
		cat -- "$src"
	else
		curl -fsSL "$FI_URL"
	fi
	;;
*)
	echo "build-wordlist.sh: unknown language '$lang' (expected en or fi)" >&2
	exit 2
	;;
esac \
	| sed '1s/^\xef\xbb\xbf//' \
	| tr -d '\r' \
	| LC_ALL=C.UTF-8 grep -xE '[a-zäö]{4,8}' \
	| LC_ALL=C.UTF-8 grep -vxE "$(eval echo "\$BLOCK_$lang")" \
	| LC_ALL=C sort -u
