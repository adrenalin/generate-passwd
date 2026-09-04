# SPDX-License-Identifier: LGPL-3.0-or-later
# Copyright (C) 2026 Arttu Manninen.  Licensed under the GNU LGPL v3 or later;
# see COPYING.LESSER.

PREFIX ?= /usr/local
BINDIR  = $(DESTDIR)$(PREFIX)/bin
DATADIR = $(DESTDIR)$(PREFIX)/share/generate-passwd
DOCDIR  = $(DESTDIR)$(PREFIX)/share/doc/generate-passwd
WORDLISTS = wordlist-en.txt wordlist-fi.txt
LICENSES  = COPYING COPYING.LESSER

.PHONY: all install uninstall wordlist test

all:
	@echo "make install [PREFIX=$(PREFIX)]   install generate-passwd"
	@echo "make uninstall                    remove it again"
	@echo "make wordlist                     rebuild wordlist-en.txt and wordlist-fi.txt"
	@echo "make test                         run the test suite"

install: generate-passwd $(WORDLISTS)
	install -d $(BINDIR) $(DATADIR) $(DOCDIR)
	install -m 0755 generate-passwd $(BINDIR)/generate-passwd
	install -m 0644 $(WORDLISTS) $(DATADIR)/
	install -m 0644 $(LICENSES) README.md $(DOCDIR)/

uninstall:
	rm -f $(BINDIR)/generate-passwd
	rm -rf $(DATADIR) $(DOCDIR)

wordlist:
	./tools/build-wordlist.sh en > wordlist-en.txt
	./tools/build-wordlist.sh fi > wordlist-fi.txt
	@wc -l $(WORDLISTS)

test:
	./tests/run-tests.sh
