#!/bin/sh
# Black-box tests for generate-passwd. Run with `make test`.
set -eu

cd "$(dirname "$0")/.."
CMD="./generate-passwd"
fails=0

check() {
	name="$1"
	shift
	if "$@"; then
		printf 'ok   - %s\n' "$name"
	else
		printf 'FAIL - %s\n' "$name"
		fails=$((fails + 1))
	fi
}

lines() { [ "$($CMD $1 | wc -l)" -eq "$2" ]; }

check "default quantity is 5"            lines "" 5
check "default is word mode"             sh -c '$0 | head -1 | grep -qE "^[A-Za-z]+(-[A-Za-z]+){7}$"' "$CMD"
check "--quantity"                       lines "-q 3" 3
check "--word-count"                     sh -c '$0 -c 4 -q 1 | grep -qE "^[A-Za-z]+(-[A-Za-z]+){3}$"' "$CMD"
check "--word-separator"                 sh -c '$0 -c 3 -q 1 --word-separator . | grep -qE "^[A-Za-z]+(\.[A-Za-z]+){2}$"' "$CMD"
check "--no-mixed-case words"            sh -c '$0 --no-mixed-case -q 20 | grep -qv "[A-Z]"' "$CMD"
check "--string default length is 32"    sh -c '[ "$($0 -s -q 1 | wc -c)" -eq 33 ]' "$CMD"
check "--string --length"                sh -c '[ "$($0 -s -l 12 -q 1 | wc -c)" -eq 13 ]' "$CMD"
check "--string --no-mixed-case"         sh -c '$0 -s --no-mixed-case -l 200 -q 5 | grep -qv "[A-Z]"' "$CMD"
check "--string overrides --words"       sh -c '$0 -s -w -q 1 | grep -qv -- "-"' "$CMD"
check "--words is accepted"              lines "-w -q 2" 2
check "passwords differ"                 sh -c '[ "$($0 -q 20 | sort -u | wc -l)" -eq 20 ]' "$CMD"
check "bad --quantity exits nonzero"     sh -c '! $0 -q 0 2>/dev/null' "$CMD"
check "bad --length exits nonzero"       sh -c '! $0 -s -l 0 2>/dev/null' "$CMD"
check "bad --word-count exits nonzero"   sh -c '! $0 -c 0 2>/dev/null' "$CMD"
check "missing wordlist exits nonzero"   sh -c '! GENERATE_PASSWD_WORDLIST=/nonexistent $0 -q 1 2>/dev/null' "$CMD"
check "--version"                        sh -c '$0 --version | grep -q generate-passwd' "$CMD"

if [ "$fails" -ne 0 ]; then
	printf '\n%d test(s) failed\n' "$fails"
	exit 1
fi
printf '\nall tests passed\n'
