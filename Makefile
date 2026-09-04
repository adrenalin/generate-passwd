PREFIX ?= /usr/local
BINDIR  = $(DESTDIR)$(PREFIX)/bin
DATADIR = $(DESTDIR)$(PREFIX)/share/generate-passwd

.PHONY: all install uninstall wordlist test

all:
	@echo "make install [PREFIX=$(PREFIX)]   install generate-passwd"
	@echo "make uninstall                    remove it again"
	@echo "make wordlist                     rebuild wordlist.txt from the system dictionary"
	@echo "make test                         run the test suite"

install: generate-passwd wordlist.txt
	install -d $(BINDIR) $(DATADIR)
	install -m 0755 generate-passwd $(BINDIR)/generate-passwd
	install -m 0644 wordlist.txt $(DATADIR)/wordlist.txt

uninstall:
	rm -f $(BINDIR)/generate-passwd
	rm -rf $(DATADIR)

wordlist:
	./tools/build-wordlist.sh > wordlist.txt
	@wc -l wordlist.txt

test:
	./tests/run-tests.sh
