/* salasanasi.fi — selaimessa toimiva salasanageneraattori.
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * Copyright (C) 2026 Arttu Manninen
 */
'use strict';

(function () {
	var STRING_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
	var UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

	var el = {
		modes: document.querySelectorAll('.mode'),
		fields: document.querySelectorAll('.field[data-for]'),
		language: document.getElementById('language'),
		wordCount: document.getElementById('word-count'),
		separator: document.getElementById('word-separator'),
		length: document.getElementById('length'),
		quantity: document.getElementById('quantity'),
		mixedCase: document.getElementById('mixed-case'),
		regenerate: document.getElementById('regenerate'),
		strength: document.getElementById('strength'),
		list: document.getElementById('passwords'),
		status: document.getElementById('status'),
		fiCount: document.getElementById('fi-count'),
		enCount: document.getElementById('en-count')
	};

	var mode = 'words';
	var lists = {};          // kieli -> sanataulukko
	var pending = {};        // kieli -> Promise

	/* ---- satunnaisuus ---- */

	// Tasajakautunut kokonaisluku väliltä [0, n): hylkäysotanta, ei modulo-vinoumaa.
	function randomIndex(n) {
		var limit = Math.floor(4294967296 / n) * n;
		var buf = new Uint32Array(1);
		var x;
		do {
			crypto.getRandomValues(buf);
			x = buf[0];
		} while (x >= limit);
		return x % n;
	}

	function pick(array) {
		return array[randomIndex(array.length)];
	}

	function coinFlip() {
		return randomIndex(2) === 1;
	}

	/* ---- salasanat ---- */

	function randomString(length, mixedCase) {
		var alphabet = mixedCase ? STRING_ALPHABET + UPPERCASE : STRING_ALPHABET;
		var out = '';
		for (var i = 0; i < length; i++) {
			out += alphabet.charAt(randomIndex(alphabet.length));
		}
		return out;
	}

	function randomWords(words, count, separator, mixedCase) {
		var picked = [];
		for (var i = 0; i < count; i++) {
			var word = pick(words);
			// Iso alkukirjain arvotaan sanakohtaisesti, jotta kuvio ei ole ennustettava.
			if (mixedCase && coinFlip()) {
				word = word.charAt(0).toUpperCase() + word.slice(1);
			}
			picked.push(word);
		}
		return picked.join(separator);
	}

	/* ---- sanalistat ---- */

	function loadWords(language) {
		if (lists[language]) {
			return Promise.resolve(lists[language]);
		}
		if (!pending[language]) {
			pending[language] = fetch('/wordlist-' + language + '.txt')
				.then(function (response) {
					if (!response.ok) {
						throw new Error('HTTP ' + response.status);
					}
					return response.text();
				})
				.then(function (text) {
					var words = text.split('\n')
						.map(function (line) { return line.trim(); })
						.filter(function (line) { return line.length > 0; });
					if (words.length < 100) {
						throw new Error('sanalista on liian lyhyt');
					}
					lists[language] = words;
					return words;
				})
				.catch(function (error) {
					delete pending[language];
					throw error;
				});
		}
		return pending[language];
	}

	/* ---- entropia ---- */

	function entropyBits(wordCount) {
		if (mode === 'string') {
			var size = el.mixedCase.checked ? STRING_ALPHABET.length + 26 : STRING_ALPHABET.length;
			return Number(el.length.value) * Math.log2(size);
		}
		if (!wordCount) {
			return 0;
		}
		var perWord = Math.log2(wordCount) + (el.mixedCase.checked ? 1 : 0);
		return Number(el.wordCount.value) * perWord;
	}

	function describeStrength(bits) {
		if (bits >= 128) return 'käytännössä murtamaton';
		if (bits >= 100) return 'erittäin vahva';
		if (bits >= 80) return 'vahva';
		if (bits >= 60) return 'kohtalainen';
		return 'heikko';
	}

	function showStrength(wordCount) {
		var bits = Math.round(entropyBits(wordCount));
		if (!bits) {
			el.strength.textContent = '';
			return;
		}
		el.strength.innerHTML = 'Entropia <b>~' + bits + '</b> bittiä – ' + describeStrength(bits) + '.';
	}

	/* ---- näkymä ---- */

	function formatCount(n) {
		return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
	}

	function setStatus(message, isError) {
		el.status.textContent = message || '';
		el.status.classList.toggle('is-error', Boolean(isError));
	}

	function copyToClipboard(text) {
		if (navigator.clipboard && window.isSecureContext) {
			return navigator.clipboard.writeText(text);
		}
		// Varajärjestely selaimille ja yhteyksille, joissa clipboard-rajapintaa ei ole.
		return new Promise(function (resolve, reject) {
			var area = document.createElement('textarea');
			area.value = text;
			area.setAttribute('readonly', '');
			area.style.position = 'fixed';
			area.style.opacity = '0';
			document.body.appendChild(area);
			area.select();
			var ok = false;
			try {
				ok = document.execCommand('copy');
			} catch (error) {
				ok = false;
			}
			document.body.removeChild(area);
			ok ? resolve() : reject(new Error('kopiointi epäonnistui'));
		});
	}

	function renderPassword(password) {
		var item = document.createElement('li');

		var value = document.createElement('span');
		value.className = 'value';
		value.textContent = password;

		var button = document.createElement('button');
		button.type = 'button';
		button.className = 'copy';
		button.textContent = 'Kopioi';
		button.addEventListener('click', function () {
			copyToClipboard(password).then(function () {
				button.textContent = 'Kopioitu';
				button.classList.add('is-done');
				setStatus('Salasana kopioitu leikepöydälle.');
				window.setTimeout(function () {
					button.textContent = 'Kopioi';
					button.classList.remove('is-done');
				}, 1600);
			}).catch(function () {
				setStatus('Kopiointi ei onnistunut – valitse salasana ja kopioi se itse.', true);
			});
		});

		item.appendChild(value);
		item.appendChild(button);
		return item;
	}

	function render(passwords) {
		el.list.replaceChildren.apply(el.list, passwords.map(renderPassword));
	}

	/* ---- generointi ---- */

	function generate() {
		var quantity = Number(el.quantity.value);
		var mixedCase = el.mixedCase.checked;

		if (mode === 'string') {
			var length = Number(el.length.value);
			var out = [];
			for (var i = 0; i < quantity; i++) {
				out.push(randomString(length, mixedCase));
			}
			render(out);
			showStrength(0);
			setStatus('');
			return;
		}

		var language = el.language.value;
		setStatus(lists[language] ? '' : 'Ladataan sanalistaa…');

		loadWords(language).then(function (words) {
			var count = Number(el.wordCount.value);
			var separator = el.separator.value;
			var out = [];
			for (var i = 0; i < quantity; i++) {
				out.push(randomWords(words, count, separator, mixedCase));
			}
			render(out);
			showStrength(words.length);
			setStatus('');
			updateCounts(language, words.length);
		}).catch(function (error) {
			el.list.replaceChildren();
			el.strength.textContent = '';
			setStatus('Sanalistan lataus epäonnistui (' + error.message + '). Kokeile päivittää sivu tai valitse merkkijono.', true);
		});
	}

	function updateCounts(language, size) {
		var target = language === 'fi' ? el.fiCount : el.enCount;
		if (target) {
			target.textContent = formatCount(size);
		}
	}

	/* ---- tapahtumat ---- */

	function setMode(next) {
		mode = next;
		el.modes.forEach(function (button) {
			var active = button.dataset.mode === next;
			button.classList.toggle('is-active', active);
			button.setAttribute('aria-checked', active ? 'true' : 'false');
		});
		el.fields.forEach(function (field) {
			field.hidden = field.dataset.for !== next;
		});
		generate();
	}

	el.modes.forEach(function (button) {
		button.addEventListener('click', function () {
			setMode(button.dataset.mode);
		});
	});

	// Liukusäätimien lukemat näkyviin.
	[['word-count', 'word-count-out'], ['length', 'length-out'], ['quantity', 'quantity-out']]
		.forEach(function (pair) {
			var input = document.getElementById(pair[0]);
			var output = document.getElementById(pair[1]);
			input.addEventListener('input', function () {
				output.textContent = input.value;
			});
		});

	['input', 'change'].forEach(function (event) {
		document.querySelector('.controls').addEventListener(event, generate);
	});
	el.regenerate.addEventListener('click', generate);

	setMode('words');
	loadWords('en').then(function (words) { updateCounts('en', words.length); }, function () {});
})();
