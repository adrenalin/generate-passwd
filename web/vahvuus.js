/* salasanasi.fi — salasanan vahvuusarvio.
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * Copyright (C) 2026 Arttu Manninen
 *
 * Arvio tehdään zxcvbn-ts:llä (MIT, web/vendor/), joka ei laske merkkiluokkia
 * vaan sitä, montako arvausta salasana kestäisi: se etsii sanakirjaosumat,
 * näppäimistökuviot, vuosiluvut, toistot ja kirjainkorvaukset ja laskee halvimman
 * reitin niiden läpi. Siksi "Kissa2019!" on heikko vaikka siinä on iso kirjain,
 * numero ja erikoismerkki.
 *
 * SIVU EI OTA VERKKOYHTEYTTÄ SALASANAN VUOKSI. Kirjasto ja sanalistat tulevat
 * tästä samasta osoitteesta, ja kaikki laskenta tapahtuu selaimessa. Salasanaa ei
 * lähetetä minnekään, ei meille eikä kenellekään muulle — sivun voi ladata ja
 * katkaista verkkoyhteyden, jolloin se toimii yhä. Älä lisää tähän tiedostoon
 * mitään, joka lähettää kentän sisällön eteenpäin.
 *
 * Sanakirjoina ovat @zxcvbn-ts/language-common (yleisimmät salasanat ja
 * näppäimistökuviot) sekä sivuston omat wordlist-fi.txt ja wordlist-en.txt.
 * Englanninkielinen language-en-paketti on jätetty pois koon vuoksi, ks.
 * web/vendor/README.md.
 */
'use strict';

(function () {
	// Sivustoon liittyvät sanat: näistä koottu salasana ei ole vahva, vaikka
	// sanakirjoissa niitä ei olisikaan.
	var SITE_WORDS = ['salasanasi', 'salasanasi.fi', 'salasana', 'vapaaradikaali'];

	// zxcvbn-ts vaatii täydellisen käännösjoukon tai kaatuu setOptionsissa.
	var TRANSLATIONS = {
		warnings: {
			straightRow: 'Peräkkäiset näppäimet ovat helppo arvata.',
			keyPattern: 'Lyhyet näppäimistökuviot ovat helppo arvata.',
			simpleRepeat: 'Toistuvat merkit kuten ”aaa” ovat helppo arvata.',
			extendedRepeat: 'Toistuvat merkkijaksot kuten ”abcabcabc” ovat helppo arvata.',
			sequences: 'Tavalliset merkkijaksot kuten ”abc” ovat helppo arvata.',
			recentYears: 'Viime vuosien vuosiluvut ovat helppo arvata.',
			dates: 'Päivämäärät ovat helppo arvata.',
			topTen: 'Tämä on yksi maailman käytetyimmistä salasanoista.',
			topHundred: 'Tämä on hyvin yleinen salasana.',
			common: 'Tämä on yleisesti käytetty salasana.',
			similarToCommon: 'Tämä muistuttaa yleisesti käytettyä salasanaa.',
			wordByItself: 'Yksittäinen sana on helppo arvata.',
			namesByThemselves: 'Pelkkä etu- tai sukunimi on helppo arvata.',
			commonNames: 'Yleiset etu- ja sukunimet ovat helppo arvata.',
			userInputs: 'Salasanassa ei pitäisi olla tähän palveluun liittyviä sanoja.',
			pwned: 'Tämä salasana on vuotanut tietomurrossa.'
		},
		suggestions: {
			l33t: 'Vältä ennalta-arvattavia kirjainkorvauksia, kuten @ a:n tilalla.',
			reverseWords: 'Vältä tavallisia sanoja takaperin kirjoitettuna.',
			allUppercase: 'Käytä isoja kirjaimia muuallakin kuin joka kirjaimessa.',
			capitalization: 'Käytä isoa kirjainta muuallakin kuin alussa.',
			dates: 'Vältä päivämääriä ja vuosia, jotka liittyvät sinuun.',
			recentYears: 'Vältä viime vuosien vuosilukuja.',
			associatedYears: 'Vältä vuosilukuja, jotka liittyvät sinuun.',
			sequences: 'Vältä tavallisia merkkijaksoja.',
			repeated: 'Vältä toistuvia sanoja ja merkkejä.',
			longerKeyboardPattern: 'Käytä pidempiä näppäimistökuvioita ja vaihda suuntaa useammin.',
			anotherWord: 'Lisää sanoja, jotka eivät ole yleisiä.',
			useWords: 'Käytä useaa sanaa, mutta vältä tuttuja sanontoja.',
			noNeed: 'Vahva salasana ei vaadi erikoismerkkejä, numeroita eikä isoja kirjaimia.',
			pwned: 'Jos käytät tätä salasanaa muualla, vaihda se.'
		},
		timeEstimation: {
			ltSecond: 'alle sekunti',
			second: '{base} sekunti',
			seconds: '{base} sekuntia',
			minute: '{base} minuutti',
			minutes: '{base} minuuttia',
			hour: '{base} tunti',
			hours: '{base} tuntia',
			day: '{base} päivä',
			days: '{base} päivää',
			month: '{base} kuukausi',
			months: '{base} kuukautta',
			year: '{base} vuosi',
			years: '{base} vuotta',
			centuries: 'vuosisatoja'
		}
	};

	// Mistä osumasta kukin salasanan pala tunnistettiin. Tämä on arvion
	// kiinnostavin osa: se näyttää, millä perusteella kone sen arvaa.
	var DICTIONARIES = {
		passwords: 'vuotaneiden salasanojen listalla',
		diceware: 'diceware-sanalistalla',
		finnish: 'suomen kielen sana',
		english: 'englannin kielen sana',
		userInputs: 'tähän palveluun liittyvä sana'
	};

	var PATTERNS = {
		dictionary: 'sanakirjaosuma',
		spatial: 'näppäimistökuvio',
		repeat: 'toistoa',
		sequence: 'merkkijakso',
		regex: 'tunnistettu kuvio',
		date: 'päivämäärä',
		separator: 'erotin',
		bruteforce: 'ei tunnistettua kuviota'
	};

	var REGEXES = {
		recentYear: 'vuosiluku'
	};

	// Sama asteikko kuin generaattorisivulla, jotta luvut ovat vertailukelpoisia.
	var LEVELS = [
		{ bits: 128, label: 'käytännössä murtamaton', step: 4 },
		{ bits: 100, label: 'erittäin vahva', step: 4 },
		{ bits: 80, label: 'vahva', step: 3 },
		{ bits: 60, label: 'kohtalainen', step: 2 },
		{ bits: 36, label: 'heikko', step: 1 },
		{ bits: 0, label: 'erittäin heikko', step: 0 }
	];

	var el = {
		form: document.getElementById('strength-form'),
		password: document.getElementById('password'),
		reveal: document.getElementById('password-reveal'),
		clear: document.getElementById('password-clear'),
		result: document.getElementById('result'),
		status: document.getElementById('status'),
		sample: document.querySelectorAll('[data-sample]')
	};

	var zx = window.zxcvbnts;
	var timer = null;
	var extraDictionaries = {};

	function node(tag, className, text) {
		var n = document.createElement(tag);
		if (className) { n.className = className; }
		if (text !== undefined && text !== null) { n.textContent = text; }
		return n;
	}

	function setStatus(message, isError) {
		el.status.textContent = message || '';
		el.status.classList.toggle('is-error', Boolean(isError));
	}

	function levelFor(bits) {
		for (var i = 0; i < LEVELS.length; i++) {
			if (bits >= LEVELS[i].bits) { return LEVELS[i]; }
		}
		return LEVELS[LEVELS.length - 1];
	}

	/* ---- asetukset ---- */

	function configure() {
		var common = zx['language-common'];
		var dictionary = {};
		Object.keys(common.dictionary).forEach(function (key) {
			dictionary[key] = common.dictionary[key];
		});
		Object.keys(extraDictionaries).forEach(function (key) {
			dictionary[key] = extraDictionaries[key];
		});

		zx.core.zxcvbnOptions.setOptions({
			dictionary: dictionary,
			graphs: common.adjacencyGraphs,
			translations: TRANSLATIONS,
			// Tunnistaa myös lähes-osumat ("passw0rd1" -> "password").
			useLevenshteinDistance: true
		});
	}

	// Sivuston omat sanalistat sanakirjoiksi: generaattori arpoo niistä, joten
	// arvion on tunnettava ne. Ne ovat samat tiedostot, jotka etusivu joka
	// tapauksessa lataa, eli selaimen välimuistista.
	function loadWordlists() {
		var wanted = [
			{ key: 'finnish', url: '/wordlist-fi.txt' },
			{ key: 'english', url: '/wordlist-en.txt' }
		];

		return Promise.all(wanted.map(function (item) {
			return fetch(item.url).then(function (response) {
				if (!response.ok) { throw new Error('HTTP ' + response.status); }
				return response.text();
			}).then(function (text) {
				extraDictionaries[item.key] = text.split('\n')
					.map(function (line) { return line.trim(); })
					.filter(function (line) { return line.length > 0; });
			});
		}));
	}

	/* ---- tuloksen piirto ---- */

	function meter(level, bits) {
		var wrap = node('div', 'meter');
		var track = node('span', 'meter-track');
		var fill = node('span', 'meter-fill is-' + level.step);
		// Leveys CSSOM:n kautta: sivun CSP on style-src 'self' eikä salli
		// tyylimäärittelyä merkkauksessa.
		fill.style.width = Math.max(4, Math.min(100, Math.round(bits / 128 * 100))) + '%';
		track.appendChild(fill);
		wrap.appendChild(track);
		return wrap;
	}

	function matchLabel(match) {
		if (match.pattern === 'dictionary') {
			var label = DICTIONARIES[match.dictionaryName] || match.dictionaryName;
			if (match.l33t) { label += ', kirjainkorvauksin'; }
			if (match.reversed) { label += ', takaperin'; }
			return label;
		}
		if (match.pattern === 'regex') {
			return REGEXES[match.regexName] || PATTERNS.regex;
		}
		return PATTERNS[match.pattern] || match.pattern;
	}

	// Osumat näytetään sellaisenaan vain, kun salasana on itse valittu näkyviin.
	// Muuten kentän peittäminen olisi näennäistä: tunnistetut palaset paljastaisivat
	// salasanan olkapään yli katsovalle.
	function tokenText(match) {
		if (el.password.type === 'text') {
			return match.token;
		}
		var length = String(match.token).length;
		return length + (length === 1 ? ' merkki' : ' merkkiä');
	}

	function renderMatches(sequence) {
		var list = node('ol', 'matches');
		sequence.forEach(function (match) {
			var item = document.createElement('li');
			item.appendChild(node('span', 'match-token', tokenText(match)));
			item.appendChild(node('span', 'match-kind', matchLabel(match)));
			list.appendChild(item);
		});
		return list;
	}

	function render(result) {
		var bits = Math.log(result.guesses) / Math.log(2);
		var rounded = Math.round(bits);
		var level = levelFor(bits);

		var box = node('div', 'result verdict is-' + level.step);
		box.appendChild(node('h2', null, 'Arvio: ' + level.label));
		box.appendChild(meter(level, bits));

		var lead = node('p', 'result-lead');
		lead.appendChild(document.createTextNode('Arvausvastus on noin '));
		lead.appendChild(node('strong', null, rounded + ' bittiä'));
		lead.appendChild(document.createTextNode(': murtajan on käytävä läpi suunnilleen 10^' +
			Math.round(result.guessesLog10) + ' vaihtoehtoa ennen kuin tämä osuu.'));
		box.appendChild(lead);

		var times = node('ul', 'facts');
		var slow = document.createElement('li');
		slow.appendChild(node('strong', null, 'Varastettu tunnustietokanta, hyvin suojattu: '));
		slow.appendChild(document.createTextNode(
			result.crackTimesDisplay.offlineSlowHashing1e4PerSecond +
			' (10 000 arvausta sekunnissa).'));
		times.appendChild(slow);

		var fast = document.createElement('li');
		fast.appendChild(node('strong', null, 'Varastettu tunnustietokanta, heikosti suojattu: '));
		fast.appendChild(document.createTextNode(
			result.crackTimesDisplay.offlineFastHashing1e10PerSecond +
			' (10 miljardia arvausta sekunnissa).'));
		times.appendChild(fast);
		box.appendChild(times);

		if (result.feedback.warning) {
			box.appendChild(node('p', 'result-advice', result.feedback.warning));
		}

		if (result.feedback.suggestions && result.feedback.suggestions.length) {
			var tips = node('ul', 'facts');
			result.feedback.suggestions.forEach(function (text) {
				tips.appendChild(node('li', null, text));
			});
			box.appendChild(tips);
		}

		if (result.sequence && result.sequence.length) {
			box.appendChild(node('h3', 'matches-title', 'Näin kone lukee salasanan'));
			box.appendChild(node('p', 'note',
				'Salasana hajotetaan tunnistettuihin palasiin. Mitä useampi pala tunnistuu ' +
				'sanakirjasta tai kuviosta, sitä vähemmän arvauksia tarvitaan.'));
			box.appendChild(renderMatches(result.sequence));
		}

		if (level.step < 3) {
			var advice = node('p', 'result-advice');
			var link = node('a', null, 'Arvo vahva salasana tällä sivustolla');
			link.href = '/';
			advice.appendChild(link);
			advice.appendChild(document.createTextNode(
				' – kahdeksan arvottua sanaa on noin 124 bittiä.'));
			box.appendChild(advice);
		}

		box.appendChild(node('p', 'result-source',
			'Arvio on laskettu selaimessasi zxcvbn-kirjastolla. Salasana ei poistunut ' +
			'koneeltasi. Arvio ei kerro, onko salasana vuotanut – sen näet vuototarkistuksesta.'));

		el.result.replaceChildren(box);
	}

	/* ---- arviointi ---- */

	function evaluate() {
		var password = el.password.value;
		if (!password) {
			el.result.replaceChildren();
			setStatus('');
			return;
		}
		try {
			render(zx.core.zxcvbn(password, SITE_WORDS));
			setStatus('');
		} catch (error) {
			setStatus('Arvion laskenta ei onnistunut (' + error.message + ').', true);
		}
	}

	// Arvio lasketaan kirjoittamisen tauotessa: pitkällä salasanalla laskenta on
	// muutamia kymmeniä millisekunteja, eikä sitä kannata tehdä joka näppäimestä.
	function scheduleEvaluate() {
		window.clearTimeout(timer);
		timer = window.setTimeout(evaluate, 180);
	}

	/* ---- tapahtumat ---- */

	el.form.addEventListener('submit', function (event) {
		event.preventDefault();
		window.clearTimeout(timer);
		evaluate();
	});

	el.password.addEventListener('input', scheduleEvaluate);

	el.reveal.addEventListener('click', function () {
		var shown = el.password.type === 'text';
		el.password.type = shown ? 'password' : 'text';
		el.reveal.textContent = shown ? 'Näytä' : 'Piilota';
		el.reveal.setAttribute('aria-pressed', shown ? 'false' : 'true');
		el.password.focus();
		evaluate();
	});

	el.clear.addEventListener('click', function () {
		el.password.value = '';
		el.result.replaceChildren();
		el.password.focus();
	});

	// Esimerkit näyttävät eron ilman, että kukaan naputtelee omaa salasanaansa
	// vain kokeillakseen.
	el.sample.forEach(function (button) {
		button.addEventListener('click', function () {
			el.password.value = button.dataset.sample;
			el.password.type = 'text';
			el.reveal.textContent = 'Piilota';
			el.reveal.setAttribute('aria-pressed', 'true');
			evaluate();
		});
	});

	/* ---- käynnistys ---- */

	if (!zx || !zx.core || !zx['language-common']) {
		el.password.disabled = true;
		setStatus('Vahvuusarvion kirjasto ei latautunut. Päivitä sivu tai kokeile myöhemmin.', true);
		return;
	}

	configure();
	el.password.disabled = false;
	setStatus('Ladataan sanalistoja…');

	loadWordlists().then(function () {
		configure();
		setStatus('');
		evaluate();
	}).catch(function () {
		// Perussanakirjat ovat jo käytössä, joten arvio toimii – se vain ei tunnista
		// suomen ja englannin yleissanastoa yhtä tarkasti.
		setStatus('Sanalistoja ei saatu ladattua. Arvio toimii, mutta se ei tunnista ' +
			'kaikkia suomen ja englannin sanoja.', true);
	});
})();
