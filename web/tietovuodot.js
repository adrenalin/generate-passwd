/* salasanasi.fi — tietovuotojen luettelo.
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * Copyright (C) 2026 Arttu Manninen
 *
 * Kaksi julkista aineistoa, molemmat maksuttomia ja ilman avainta:
 *
 *   Luettelo — Have I Been Pwned, /api/v3/breaches. Yli tuhat julkiseksi tullutta
 *              tietomurtoa nimineen, päivineen, kokoineen ja vuotaneine
 *              tietoluokkineen. Aineisto on CC BY 4.0, joten lähdemerkintä on
 *              pakollinen — se on sivun alatunnisteessa ja "Mistä tiedot tulevat"
 *              -osiossa, älä poista.
 *
 *   Luvut    — XposedOrNot, /v1/analytics/metrics. Vuosi- ja toimialajakaumat,
 *              joita HIBP ei tarjoa valmiiksi laskettuna.
 *
 * TÄMÄ SIVU EI OLE /vuodot. Siellä käyttäjä kysyy omasta osoitteestaan ja kysely
 * lähtee selaimesta suoraan tietokantaan; täällä ei kysytä mitään käyttäjästä,
 * joten aineisto haetaan OMAN PALVELIMEN KAUTTA (/data/…): selain ei ota yhteyttä
 * yhteenkään ulkopuoliseen palvelimeen, eikä kävijän IP-osoite päädy HIBP:lle tai
 * XposedOrNotille. Palvelin hakee saman luettelon kerran kuudessa tunnissa koko
 * sivuston puolesta ja tarjoilee sen välimuistista. Sivun CSP pysyy siis
 * connect-src 'self' -tiukkuudessa.
 *
 * Kaikki ulkopuolinen data kirjoitetaan DOM:iin textContentilla, ei koskaan
 * innerHTML:llä. Suomennokset ovat breach-terms.js:ssä, joka on ladattava ensin.
 */
'use strict';

(function () {
	var BREACHES_URL = '/data/tietovuodot.json';
	var METRICS_URL = '/data/vuotoluvut.json';

	// Luettelossa on yli tuhat vuotoa. Kerralla piirretään sivullinen ja loput
	// pyynnöstä: selaimen ei tarvitse pitää tuhatta korttia pystyssä, jotta
	// hakukenttä pysyy nopeana.
	var PAGE_SIZE = 25;

	// Vuodon liput. Nimi kertoo, mitä HIBP:n tosiarvo tarkoittaa lukijalle.
	var FLAGS = [
		{ key: 'IsSensitive', label: 'arkaluonteinen', bad: false },
		{ key: 'IsStealerLog', label: 'tietovarkausohjelman loki', bad: false },
		{ key: 'IsMalware', label: 'haittaohjelman keräämä', bad: false },
		{ key: 'IsSpamList', label: 'roskapostilista', bad: false },
		{ key: 'IsFabricated', label: 'sepitetty', bad: true },
		{ key: 'IsRetired', label: 'poistettu haettavista', bad: true }
	];

	var MONTHS = [
		'tammikuuta', 'helmikuuta', 'maaliskuuta', 'huhtikuuta', 'toukokuuta', 'kesäkuuta',
		'heinäkuuta', 'elokuuta', 'syyskuuta', 'lokakuuta', 'marraskuuta', 'joulukuuta'
	];

	var el = {
		tabs: document.querySelectorAll('.mode'),
		panels: document.querySelectorAll('.panel[data-panel]'),
		search: document.getElementById('search'),
		sort: document.getElementById('sort'),
		summary: document.getElementById('summary'),
		list: document.getElementById('breach-list'),
		more: document.getElementById('more'),
		moreRow: document.getElementById('more-row'),
		status: document.getElementById('status'),
		highlights: document.getElementById('highlights'),
		numbers: document.getElementById('numbers'),
		numbersStatus: document.getElementById('numbers-status')
	};

	var breaches = [];     // normalisoitu luettelo, uusin ensin
	var matches = [];      // hakua ja järjestystä vastaava osajoukko
	var drawn = 0;         // montako niistä on jo piirretty
	var metricsLoaded = false;

	/* ---- apurit ---- */

	function node(tag, className, text) {
		var n = document.createElement(tag);
		if (className) { n.className = className; }
		if (text !== undefined && text !== null) { n.textContent = text; }
		return n;
	}

	function setStatus(target, message, isError) {
		target.textContent = message || '';
		target.classList.toggle('is-error', Boolean(isError));
	}

	// HIBP:n kuvauksissa on HTML:ää (linkkejä lähdeartikkeleihin). Teksti menee
	// DOM:iin textContentilla, joten merkkaus vain riisutaan pois — sitä ei tulkita
	// missään vaiheessa. Entiteetit puretaan käsin eikä selaimen jäsentimellä,
	// jottei kolmannen osapuolen merkkijono käy innerHTML:n läpi edes hetkeksi.
	var ENTITIES = {
		'&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
		'&#39;': "'", '&#x27;': "'", '&nbsp;': ' '
	};

	function plainText(html) {
		return String(html || '')
			.replace(/<[^>]*>/g, '')
			.replace(/&(?:amp|lt|gt|quot|nbsp|#39|#x27);/g, function (match) {
				return ENTITIES[match] || match;
			})
			.replace(/\s+/g, ' ')
			.trim();
	}

	// "2019-03-31" -> "31. maaliskuuta 2019". Päivämäärä tulee aineistosta, joten
	// muoto tarkistetaan ennen kuin siihen luotetaan.
	function formatDate(value) {
		var parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
		if (!parts) { return ''; }
		var month = MONTHS[Number(parts[2]) - 1];
		return month ? Number(parts[3]) + '. ' + month + ' ' + parts[1] : parts[1];
	}

	function year(value) {
		var parts = /^(\d{4})/.exec(String(value || ''));
		return parts ? parts[1] : '';
	}

	/* ---- aineiston normalisointi ---- */

	function normalise(raw) {
		var flags = FLAGS.filter(function (flag) { return raw[flag.key] === true; });
		if (raw.IsVerified === false) {
			flags = [{ key: 'IsVerified', label: 'vahvistamaton', bad: true }].concat(flags);
		}

		var classes = BREACH_TERMS.dataClassList(raw.DataClasses);
		var title = String(raw.Title || raw.Name || '').trim() || BREACH_TERMS.humanise(raw.Name);

		return {
			title: title,
			domain: String(raw.Domain || '').trim(),
			breachDate: String(raw.BreachDate || ''),
			addedDate: String(raw.AddedDate || ''),
			count: Number(raw.PwnCount) || 0,
			description: plainText(raw.Description),
			classes: classes,
			hasPasswords: classes.indexOf('salasanat') !== -1,
			flags: flags,
			// Haku osuu nimeen, verkkotunnukseen ja suomennettuihin tietoluokkiin,
			// jolloin "terveystiedot" tai "salasanat" toimii hakusanana.
			haystack: (title + ' ' + (raw.Name || '') + ' ' + (raw.Domain || '') + ' ' +
				classes.join(' ')).toLowerCase()
		};
	}

	/* ---- luettelon piirto ---- */

	function renderBreach(breach) {
		var item = document.createElement('li');

		var head = node('div', 'breach-head');
		head.appendChild(node('h3', null, breach.title));
		if (breach.breachDate) {
			head.appendChild(node('span', 'breach-year', formatDate(breach.breachDate)));
		}
		item.appendChild(head);

		var meta = [];
		if (breach.domain) { meta.push(breach.domain); }
		if (breach.count) {
			meta.push(BREACH_TERMS.formatCount(breach.count) + ' tiliä');
		}
		if (meta.length) {
			item.appendChild(node('p', 'breach-meta', meta.join(' · ')));
		}

		if (breach.flags.length) {
			var flagRow = node('p', 'breach-flags');
			breach.flags.forEach(function (flag) {
				var tag = node('span', 'flag' + (flag.bad ? ' is-bad' : ''), flag.label);
				flagRow.appendChild(tag);
			});
			item.appendChild(flagRow);
		}

		if (breach.classes.length) {
			var data = node('p', 'breach-data');
			data.appendChild(node('strong', null, 'Vuotaneet tiedot: '));
			data.appendChild(document.createTextNode(breach.classes.join(', ') + '.'));
			if (breach.hasPasswords) { data.classList.add('is-bad'); }
			item.appendChild(data);
		}

		// Kuvaukset ovat HIBP:n omaa englanninkielistä tekstiä. Ne ovat hyödyllisiä
		// mutta pitkiä, joten ne ovat auki napautettavina eivätkä vie luettelolta tilaa.
		if (breach.description) {
			var details = document.createElement('details');
			details.className = 'breach-story';
			details.appendChild(node('summary', null, 'Tapauksen kuvaus (englanniksi)'));
			details.appendChild(node('p', null, breach.description));
			item.appendChild(details);
		}

		return item;
	}

	function drawPage() {
		var slice = matches.slice(drawn, drawn + PAGE_SIZE);
		var fragment = document.createDocumentFragment();
		slice.forEach(function (breach) {
			fragment.appendChild(renderBreach(breach));
		});
		el.list.appendChild(fragment);
		drawn += slice.length;

		el.moreRow.hidden = drawn >= matches.length;
		el.more.textContent = 'Näytä lisää (' +
			BREACH_TERMS.formatCount(matches.length - drawn) + ' jäljellä)';
	}

	function describeMatches() {
		if (!matches.length) {
			return 'Haku ei osunut yhteenkään vuotoon.';
		}
		var accounts = matches.reduce(function (sum, breach) { return sum + breach.count; }, 0);
		return (matches.length === breaches.length
			? 'Luettelossa on ' + BREACH_TERMS.formatCount(matches.length) + ' vuotoa'
			: 'Hakuun osui ' + BREACH_TERMS.formatCount(matches.length) + ' vuotoa') +
			', yhteensä ' + BREACH_TERMS.formatCount(accounts) + ' vuotanutta tiliä.';
	}

	function applyFilters() {
		var query = el.search.value.trim().toLowerCase();
		matches = query
			? breaches.filter(function (breach) { return breach.haystack.indexOf(query) !== -1; })
			: breaches.slice();

		var order = el.sort.value;
		matches.sort(function (a, b) {
			if (order === 'largest') { return b.count - a.count; }
			if (order === 'oldest') { return a.breachDate.localeCompare(b.breachDate); }
			if (order === 'added') { return b.addedDate.localeCompare(a.addedDate); }
			return b.breachDate.localeCompare(a.breachDate);
		});

		el.list.replaceChildren();
		drawn = 0;
		el.summary.textContent = describeMatches();
		drawPage();
	}

	/* ---- nostot luettelon omasta aineistosta ---- */

	// Luvut näytetään isolla, nimet pienemmällä: pisin vuodon nimi on nelisen riviä
	// pitkä, ja se venyttäisi koko rivin korkeuden.
	function stat(label, value, note, isName) {
		var box = node('div', 'stat');
		box.appendChild(node('span', 'stat-label', label));
		box.appendChild(node('strong', 'stat-value' + (isName ? ' is-name' : ''), value));
		if (note) { box.appendChild(node('span', 'stat-note', note)); }
		return box;
	}

	function renderHighlights() {
		var accounts = breaches.reduce(function (sum, breach) { return sum + breach.count; }, 0);

		var largest = breaches.reduce(function (best, breach) {
			return breach.count > best.count ? breach : best;
		}, breaches[0]);

		var newest = breaches.reduce(function (best, breach) {
			return breach.addedDate.localeCompare(best.addedDate) > 0 ? breach : best;
		}, breaches[0]);

		el.highlights.replaceChildren(
			stat('Vuotoja luettelossa', BREACH_TERMS.formatCount(breaches.length)),
			stat('Vuotaneita tilejä', BREACH_TERMS.formatCount(accounts),
				'saman ihmisen tili voi olla mukana monessa'),
			stat('Suurin yksittäinen vuoto', largest.title,
				BREACH_TERMS.formatCount(largest.count) + ' tiliä', true),
			stat('Viimeksi lisätty', newest.title,
				formatDate(newest.addedDate) || year(newest.addedDate), true)
		);
	}

	/* ---- lukupalkit ---- */

	function bars(rows, unit) {
		var largest = rows.reduce(function (max, row) {
			return Math.max(max, row.value);
		}, 0);

		var list = node('ol', 'bars');
		rows.forEach(function (row) {
			var item = document.createElement('li');
			item.appendChild(node('span', 'bar-label', row.label));

			var track = node('span', 'bar-track');
			var fill = node('span', 'bar-fill');
			// Leveys asetetaan CSSOM:n kautta, ei style-määritteenä: sivun CSP on
			// style-src 'self' eikä salli sisäisiä tyylimäärittelyjä merkkauksessa.
			fill.style.width = (largest ? Math.max(1, Math.round(row.value / largest * 100)) : 0) + '%';
			track.appendChild(fill);
			item.appendChild(track);

			item.appendChild(node('span', 'bar-value',
				BREACH_TERMS.formatCount(row.value) + (unit ? ' ' + unit : '')));
			list.appendChild(item);
		});
		return list;
	}

	function section(title, lead, body) {
		var wrap = node('section', 'numbers-block');
		wrap.appendChild(node('h3', null, title));
		if (lead) { wrap.appendChild(node('p', 'numbers-lead', lead)); }
		wrap.appendChild(body);
		return wrap;
	}

	// Yleisimmät tietoluokat lasketaan luettelosta itsestään: mitä useammassa
	// vuodossa luokka esiintyy, sitä varmemmin se on myös sinun vuotanut tietosi.
	function commonClasses() {
		var counts = {};
		breaches.forEach(function (breach) {
			breach.classes.forEach(function (name) {
				counts[name] = (counts[name] || 0) + 1;
			});
		});
		return Object.keys(counts)
			.map(function (name) { return { label: name, value: counts[name] }; })
			.sort(function (a, b) { return b.value - a.value; })
			.slice(0, 10);
	}

	function renderNumbers(metrics) {
		var blocks = document.createDocumentFragment();

		// Ensimmäinen osio lasketaan luettelosta, loput tulevat XposedOrNotilta.
		// Kumpi tahansa voi puuttua, jos sen lataus epäonnistui.
		if (breaches.length) {
			blocks.appendChild(section(
				'Yleisimmin vuotaneet tiedot',
				'Kuinka monessa luettelon vuodossa kukin tietolaji paljastui.',
				bars(commonClasses(), 'vuotoa')));
		}

		var yearly = metrics && metrics.Yearly_Breaches_Count;
		if (yearly) {
			var years = Object.keys(yearly)
				.filter(function (key) { return /^\d{4}$/.test(key); })
				.sort()
				.map(function (key) { return { label: key, value: Number(yearly[key]) || 0 }; });
			blocks.appendChild(section(
				'Vuotoja vuosittain',
				'Havaittujen ja julkaistujen vuotojen määrä XposedOrNotin aineistossa. ' +
				'Kuluva vuosi on aina kesken.',
				bars(years, null)));
		}

		var industries = metrics && metrics.Industry_Breaches_Count;
		if (industries) {
			var rows = Object.keys(industries)
				.map(function (key) {
					return { label: BREACH_TERMS.industry(key), value: Number(industries[key]) || 0 };
				})
				.sort(function (a, b) { return b.value - a.value; })
				.slice(0, 12);
			blocks.appendChild(section(
				'Vuotoja toimialoittain',
				'Mistä palveluista tietoa on vuotanut eniten.',
				bars(rows, null)));
		}

		if (metrics && metrics.Breaches_Count) {
			var total = node('p', 'numbers-source',
				'XposedOrNotin tietokannassa on ' + BREACH_TERMS.formatCount(metrics.Breaches_Count) +
				' vuotoa ja ' + BREACH_TERMS.formatCount(metrics.Breaches_Records) +
				' tietuetta. Luvut poikkeavat luettelon omista, koska palvelut seuraavat ' +
				'osin eri vuotoja ja laskevat tietueet eri tavoin.');
			blocks.appendChild(total);
		}

		el.numbers.replaceChildren(blocks);
	}

	/* ---- lataus ---- */

	function loadJson(url) {
		return fetch(url, { headers: { Accept: 'application/json' } }).then(function (response) {
			if (!response.ok) {
				throw new Error('HTTP ' + response.status);
			}
			return response.json();
		});
	}

	function loadBreaches() {
		setStatus(el.status, 'Ladataan vuotoluetteloa…');
		return loadJson(BREACHES_URL).then(function (data) {
			if (!Array.isArray(data) || !data.length) {
				throw new Error('tyhjä luettelo');
			}
			breaches = data.map(normalise);
			renderHighlights();
			applyFilters();
			setStatus(el.status, '');
			el.search.disabled = false;
			el.sort.disabled = false;
		}).catch(function (error) {
			setStatus(el.status, 'Vuotoluettelon lataus ei onnistunut (' + error.message +
				'). Yritä myöhemmin uudelleen.', true);
		});
	}

	function loadMetrics() {
		if (metricsLoaded) { return; }
		metricsLoaded = true;
		setStatus(el.numbersStatus, 'Lasketaan lukuja…');
		loadJson(METRICS_URL).then(function (metrics) {
			renderNumbers(metrics);
			setStatus(el.numbersStatus, '');
		}).catch(function (error) {
			// Luettelosta lasketut osiot voi näyttää, vaikka XposedOrNotin luvut
			// jäisivät saamatta.
			renderNumbers(null);
			setStatus(el.numbersStatus, 'XposedOrNotin lukuja ei saatu haettua (' +
				error.message + '). Luettelon omat luvut näkyvät silti.', true);
		});
	}

	/* ---- tapahtumat ---- */

	function setTab(next) {
		el.tabs.forEach(function (button) {
			var active = button.dataset.mode === next;
			button.classList.toggle('is-active', active);
			button.setAttribute('aria-checked', active ? 'true' : 'false');
		});
		el.panels.forEach(function (panel) {
			panel.hidden = panel.dataset.panel !== next;
		});
		if (next === 'numbers') {
			loadMetrics();
		}
	}

	el.tabs.forEach(function (button) {
		button.addEventListener('click', function () {
			setTab(button.dataset.mode);
		});
	});

	// Hakukenttä suodattaa jokaisella näppäimenpainalluksella: aineisto on jo
	// muistissa, joten mitään ei haeta verkosta uudelleen.
	el.search.addEventListener('input', applyFilters);
	el.sort.addEventListener('change', applyFilters);
	el.more.addEventListener('click', drawPage);

	document.getElementById('search-form').addEventListener('submit', function (event) {
		event.preventDefault();
		applyFilters();
	});

	loadBreaches();
})();
