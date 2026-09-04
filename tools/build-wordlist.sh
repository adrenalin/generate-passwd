#!/bin/sh
# Regenerate wordlist.txt from a system dictionary.
#
#   ./tools/build-wordlist.sh [dictionary] > wordlist.txt
#
# Keeps plain lowercase ASCII words of 4-8 letters, drops anything matching
# the blocklist below (slurs, profanity, and words that read badly in a
# password you may have to say out loud).
set -eu

DICT="${1:-/usr/share/dict/american-english}"

BLOCK='^(anal|anus|arse|arses|ass|assed|asses|bastard|bitch|bitched|bitches|boob|boobs|bugger|buggers|bukkake|bum|bums|butt|butts|clit|clits|cock|cocks|coon|coons|crap|crapped|craps|cum|cums|cunt|cunts|dago|dagos|damn|damned|damns|darkie|darkies|dick|dicks|dildo|dildos|douche|douches|dyke|dykes|fag|faggot|fags|fart|farted|farts|fuck|fucked|fucker|fuckers|fucks|gook|gooks|hell|hells|hitler|homo|homos|honky|horny|hump|humped|humps|jism|jizz|kike|kikes|knob|knobs|kraut|krauts|lesbo|lesbos|milf|milfs|nazi|nazis|negro|negroes|nigga|niggas|nigger|niggers|nipple|nipples|nude|nudes|orgasm|orgasms|orgy|paki|pakis|pecker|peckers|pedo|pee|peed|pees|penis|penises|piss|pissed|pisses|poop|poops|porn|porno|porns|prick|pricks|pube|pubes|pussies|pussy|queer|queers|racist|racists|rape|raped|rapes|rapist|rectal|rectum|retard|retards|scrotum|semen|sex|sexes|sexual|sexy|shag|shags|shat|shit|shits|slut|sluts|smegma|sodomy|sperm|spic|spics|spunk|suicide|testes|testis|tit|tits|titties|titty|turd|turds|twat|twats|urine|vagina|vaginas|vulva|wank|wanks|whore|whores|willy|wog|wogs|wop|wops)$'

LC_ALL=C grep -xE '[a-z]{4,8}' "$DICT" \
  | LC_ALL=C grep -vxE "$BLOCK" \
  | LC_ALL=C sort -u
