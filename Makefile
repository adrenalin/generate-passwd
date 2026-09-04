PREFIX ?= /usr/local
BINDIR  = $(DESTDIR)$(PREFIX)/bin
DATADIR = $(DESTDIR)$(PREFIX)/share/generate-passwd
WORDLISTS = wordlist-en.txt wordlist-fi.txt

.PHONY: all install uninstall wordlist test

all:
	@echo "make install [PREFIX=$(PREFIX)]   install generate-passwd"
	@echo "make uninstall                    remove it again"
	@echo "make wordlist                     rebuild wordlist-en.txt and wordlist-fi.txt"
	@echo "make test                         run the test suite"

install: generate-passwd $(WORDLISTS)
	install -d $(BINDIR) $(DATADIR)
	install -m 0755 generate-passwd $(BINDIR)/generate-passwd
	install -m 0644 $(WORDLISTS) $(DATADIR)/

uninstall:
	rm -f $(BINDIR)/generate-passwd
	rm -rf $(DATADIR)

wordlist:
	./tools/build-wordlist.sh en > wordlist-en.txt
	./tools/build-wordlist.sh fi > wordlist-fi.txt
	@wc -l $(WORDLISTS)

test:
	./tests/run-tests.sh
