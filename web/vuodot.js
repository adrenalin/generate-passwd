/* salasanasi.fi — vuototarkistus.
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * Copyright (C) 2026 Arttu Manninen
 *
 * Kaksi tarkistusta, kaksi eri tietolähdettä ja kaksi eri tietosuojatasoa:
 *
 *   Sähköposti — XposedOrNot (https://xposedornot.com/). Osoite lähtee sellaisenaan;
 *                sitä ei voi peittää, koska kysymykseen ei muuten voi vastata. Kysely
 *                tehdään SELAIMESTA SUORAAN, ei palvelimemme kautta. Tämä on tietoinen
 *                valinta kahdesta syystä: (1) osoite ei silloin voi päätyä meidän
 *                lokeihimme, eli lupaus "emme tallenna" ei nojaa lokiasetuksiin, ja
 *                (2) XposedOrNotin ilmaisrajat lasketaan IP-osoitetta kohti, joten
 *                proxy asettaisi koko sivuston yhteen 100 kyselyn vuorokausikiintiöön.
 *                Käyttöehdot vaativat lähdemerkinnän — se on sivun alatunnisteessa ja
 *                "Mistä tiedot tulevat" -osiossa, älä poista.
 *
 *   Salasana   — Have I Been Pwned, Pwned Passwords. k-anonymiteetti: selain laskee
 *                SHA-1:n ja lähettää siitä viisi merkkiä. Salasana itse ei poistu
 *                koneelta missään vaiheessa.
 *
 * Kaikki ulkopuolinen data kirjoitetaan DOM:iin textContentilla, ei koskaan
 * innerHTML:llä: vuotokuvaukset ja tietoluokat tulevat kolmannelta osapuolelta.
 *
 * Tietoluokkien ja toimialojen suomennokset ovat breach-terms.js:ssä, jaossa
 * /tietovuodot-sivun kanssa. Se on ladattava ennen tätä tiedostoa.
 */
'use strict';

(function () {
	var XON_URL = 'https://api.xposedornot.com/v1/breach-analytics?email=';
	var HIBP_URL = 'https://api.pwnedpasswords.com/range/';

	/* ---- sanastot ---- */

	var PASSWORD_RISK = {
		plaintext: 'Salasanat vuotivat selväkielisinä.',
		easytocrack: 'Salasanat oli suojattu heikosti ja ne on murrettavissa nopeasti.',
		hardtocrack: 'Salasanat oli suojattu vahvalla tiivistefunktiolla.',
		unknown: ''
	};

	var RISK_LABELS = {
		Critical: 'kriittinen',
		High: 'korkea',
		Medium: 'kohtalainen',
		Low: 'matala',
		Unknown: 'tuntematon'
	};

	/* ---- apurit ---- */

	var el = {
		modes: document.querySelectorAll('.mode'),
		checks: document.querySelectorAll('.check[data-check]'),
		emailForm: document.getElementById('email-form'),
		email: document.getElementById('email'),
		emailSubmit: document.getElementById('email-submit'),
		passwordForm: document.getElementById('password-form'),
		password: document.getElementById('password'),
		passwordSubmit: document.getElementById('password-submit'),
		reveal: document.getElementById('password-reveal'),
		status: document.getElementById('status'),
		result: document.getElementById('result')
	};

	var busy = false;

	function setStatus(message, isError) {
		el.status.textContent = message || '';
		el.status.classList.toggle('is-error', Boolean(isError));
	}

	function clearResult() {
		el.result.replaceChildren();
	}

	function node(tag, className, text) {
		var n = document.createElement(tag);
		if (className) { n.className = className; }
		if (text !== undefined && text !== null) { n.textContent = text; }
		return n;
	}

	// Vain http(s) kelpaa linkiksi: lähdeosoite tulee ulkopuoliselta palvelulta ja
	// esimerkiksi javascript:-osoite olisi skriptin ajamista sivun omassa kontekstissa.
	function safeUrl(value) {
		return typeof value === 'string' && /^https?:\/\/[^\s"'<>]+$/i.test(value) ? value : null;
	}

	function hostOf(url) {
		try {
			return new URL(url).hostname.replace(/^www\./, '');
		} catch (error) {
			return url;
		}
	}

	function translate(map, value) {
		var key = String(value || '').trim();
		return map[key] || key;
	}

	function setBusy(state, button, label) {
		busy = state;
		button.disabled = state;
		button.textContent = state ? label : 'Tarkista';
	}

	/* ---- sähköpostin tarkistus ---- */

	function renderBreach(breach) {
		var item = document.createElement('li');

		var head = node('div', 'breach-head');
		head.appendChild(node('h3', null, BREACH_TERMS.humanise(breach.breach)));
		if (breach.xposed_date) {
			head.appendChild(node('span', 'breach-year', breach.xposed_date));
		}
		item.appendChild(head);

		var meta = [];
		if (breach.domain) { meta.push(breach.domain); }
		if (breach.industry) { meta.push(BREACH_TERMS.industry(breach.industry)); }
		if (breach.xposed_records) {
			meta.push(BREACH_TERMS.formatCount(breach.xposed_records) + ' tietuetta');
		}
		if (String(breach.verified).toLowerCase() === 'no') {
			meta.push('vahvistamaton');
		}
		if (meta.length) {
			item.appendChild(node('p', 'breach-meta', meta.join(' · ')));
		}

		if (breach.details) {
			item.appendChild(node('p', 'breach-details', breach.details));
		}

		var classes = BREACH_TERMS.dataClassList(breach.xposed_data);
		if (classes.length) {
			var data = node('p', 'breach-data');
			data.appendChild(node('strong', null, 'Vuotaneet tiedot: '));
			data.appendChild(document.createTextNode(classes.join(', ') + '.'));
			item.appendChild(data);
		}

		var risk = PASSWORD_RISK[String(breach.password_risk || '').toLowerCase()];
		if (risk) {
			var riskLine = node('p', 'breach-risk', risk);
			if (breach.password_risk === 'plaintext' || breach.password_risk === 'easytocrack') {
				riskLine.classList.add('is-bad');
			}
			item.appendChild(riskLine);
		}

		var ref = safeUrl(breach.references);
		if (ref) {
			var link = node('a', null, 'Lähde: ' + hostOf(ref));
			link.href = ref;
			link.rel = 'noopener nofollow noreferrer';
			link.target = '_blank';
			var wrap = node('p', 'breach-ref');
			wrap.appendChild(link);
			item.appendChild(wrap);
		}

		return item;
	}

	function renderEmailResult(address, data) {
		var breaches = data && data.ExposedBreaches && data.ExposedBreaches.breaches_details;
		var box = node('div', 'result');

		if (!breaches || !breaches.length) {
			box.classList.add('is-clean');
			box.appendChild(node('h2', null, 'Osoitetta ei löytynyt tunnetuista vuodoista'));
			box.appendChild(node('p', null,
				'Osoitetta ' + address + ' ei ole XposedOrNotin tietokannassa. Se ei ole ' +
				'todistus siitä, ettei tietojasi olisi vuotanut – vain se, ettei tätä ' +
				'osoitetta ole tässä tietokannassa.'));
			el.result.replaceChildren(box);
			return;
		}

		var sorted = breaches.slice().sort(function (a, b) {
			return String(b.xposed_date || '').localeCompare(String(a.xposed_date || ''));
		});

		box.classList.add('is-hit');
		box.appendChild(node('h2', null,
			sorted.length === 1
				? 'Osoite löytyi yhdestä tietovuodosta'
				: 'Osoite löytyi ' + BREACH_TERMS.formatCount(sorted.length) + ' tietovuodosta'));

		var lead = node('p', 'result-lead');
		lead.appendChild(document.createTextNode('Haettu osoite: '));
		lead.appendChild(node('strong', null, address));
		var risk = data.BreachMetrics && data.BreachMetrics.risk && data.BreachMetrics.risk[0];
		if (risk && risk.risk_label) {
			lead.appendChild(document.createTextNode('. Riskiarvio: '));
			lead.appendChild(node('strong', null, translate(RISK_LABELS, risk.risk_label)));
			lead.appendChild(document.createTextNode('.'));
		}
		box.appendChild(lead);

		var leaked = sorted.filter(function (b) {
			return BREACH_TERMS.dataClassList(b.xposed_data).indexOf('salasanat') !== -1;
		}).length;
		if (leaked) {
			box.appendChild(node('p', 'result-advice',
				'Näistä ' + BREACH_TERMS.formatCount(leaked) + ' vuodossa paljastui myös salasanoja. ' +
				'Vaihda näiden palveluiden salasanat – ja ennen kaikkea kaikkialta muualta, ' +
				'missä sama salasana on käytössä.'));
		}

		var list = node('ol', 'breaches');
		sorted.forEach(function (breach) {
			list.appendChild(renderBreach(breach));
		});
		box.appendChild(list);

		box.appendChild(node('p', 'result-source',
			'Vuototiedot: XposedOrNot. Luettelo kattaa vain julkisiksi tulleet ja ' +
			'palveluun kirjatut vuodot.'));

		el.result.replaceChildren(box);
	}

	function checkEmail(address) {
		setBusy(true, el.emailSubmit, 'Haetaan…');
		setStatus('Kysytään XposedOrNotilta…');
		clearResult();

		fetch(XON_URL + encodeURIComponent(address), {
			headers: { Accept: 'application/json' },
			referrerPolicy: 'no-referrer'
		}).then(function (response) {
			if (response.status === 404) {
				return null;   // tuntematon osoite: ei osumia
			}
			if (response.status === 429) {
				throw new Error('rate-limit');
			}
			if (!response.ok) {
				throw new Error('HTTP ' + response.status);
			}
			return response.json();
		}).then(function (data) {
			renderEmailResult(address, data);
			setStatus('');
		}).catch(function (error) {
			if (error.message === 'rate-limit') {
				setStatus('XposedOrNotin ilmainen kyselyraja tuli täyteen (25 kyselyä tunnissa). ' +
					'Odota tunti ja yritä uudelleen.', true);
			} else {
				setStatus('Haku ei onnistunut (' + error.message + '). Palvelu voi olla ' +
					'hetkellisesti poissa käytöstä – yritä myöhemmin uudelleen.', true);
			}
		}).then(function () {
			setBusy(false, el.emailSubmit);
		});
	}

	/* ---- salasanan tarkistus ---- */

	function sha1Hex(text) {
		var bytes = new TextEncoder().encode(text);
		return crypto.subtle.digest('SHA-1', bytes).then(function (buffer) {
			var out = '';
			new Uint8Array(buffer).forEach(function (b) {
				out += b.toString(16).padStart(2, '0');
			});
			return out.toUpperCase();
		});
	}

	// Vastaus on rivejä "SUFFIX:COUNT". Add-Padding lisää joukkoon satunnaisia rivejä,
	// joiden lukumäärä on 0 — ne pudotetaan pois.
	function countInRange(body, suffix) {
		var lines = body.split('\n');
		for (var i = 0; i < lines.length; i++) {
			var parts = lines[i].trim().split(':');
			if (parts[0] === suffix) {
				var count = parseInt(parts[1], 10);
				return count > 0 ? count : 0;
			}
		}
		return 0;
	}

	function renderPasswordResult(count) {
		var box = node('div', 'result');

		if (!count) {
			box.classList.add('is-clean');
			box.appendChild(node('h2', null, 'Salasanaa ei löytynyt vuodoista'));
			box.appendChild(node('p', null,
				'Tätä salasanaa ei ole Have I Been Pwnedin vuotaneiden salasanojen ' +
				'listalla. Se ei tee siitä vahvaa: myös arvaamaton lyhyt salasana on ' +
				'heikko, jos se on arvattavissa. Vahvuus tulee siitä, että salasana on ' +
				'arvottu ja pitkä.'));
		} else {
			box.classList.add('is-hit');
			box.appendChild(node('h2', null, 'Tämä salasana on vuotanut'));
			box.appendChild(node('p', 'result-lead',
				'Salasana esiintyy vuototietokannassa ' + BREACH_TERMS.formatCount(count) +
				(count === 1 ? ' kerran.' : ' kertaa.')));
			box.appendChild(node('p', 'result-advice',
				'Älä käytä sitä enää missään. Se on murtokoneiden sanakirjoissa, eli se ' +
				'kokeillaan ensimmäisten joukossa riippumatta siitä, kuinka monimutkaiselta ' +
				'se näyttää. Vaihda se jokaisessa palvelussa, jossa se on käytössä.'));
			var link = node('a', null, 'Arvo tilalle uusi salasana');
			link.href = '/';
			var p = node('p', 'result-advice');
			p.appendChild(link);
			box.appendChild(p);
		}

		box.appendChild(node('p', 'result-source',
			'Lähde: Have I Been Pwned – Pwned Passwords. Salasanasta lähti vain ' +
			'SHA-1-tiivisteen viisi ensimmäistä merkkiä.'));

		el.result.replaceChildren(box);
	}

	function checkPassword(password) {
		setBusy(true, el.passwordSubmit, 'Tarkistetaan…');
		setStatus('Lasketaan tiiviste selaimessa…');
		clearResult();

		sha1Hex(password).then(function (hash) {
			var prefix = hash.slice(0, 5);
			var suffix = hash.slice(5);
			setStatus('Kysytään Have I Been Pwnediltä etuliitteellä ' + prefix + '…');
			return fetch(HIBP_URL + prefix, {
				headers: { 'Add-Padding': 'true' },
				referrerPolicy: 'no-referrer'
			}).then(function (response) {
				if (!response.ok) {
					throw new Error('HTTP ' + response.status);
				}
				return response.text();
			}).then(function (body) {
				return countInRange(body, suffix);
			});
		}).then(function (count) {
			renderPasswordResult(count);
			setStatus('');
		}).catch(function (error) {
			setStatus('Tarkistus ei onnistunut (' + error.message + '). Yritä myöhemmin ' +
				'uudelleen.', true);
		}).then(function () {
			setBusy(false, el.passwordSubmit);
		});
	}

	/* ---- tapahtumat ---- */

	function setMode(next) {
		el.modes.forEach(function (button) {
			var active = button.dataset.mode === next;
			button.classList.toggle('is-active', active);
			button.setAttribute('aria-checked', active ? 'true' : 'false');
		});
		el.checks.forEach(function (check) {
			check.hidden = check.dataset.check !== next;
		});
		clearResult();
		setStatus('');
	}

	el.modes.forEach(function (button) {
		button.addEventListener('click', function () {
			setMode(button.dataset.mode);
		});
	});

	el.emailForm.addEventListener('submit', function (event) {
		event.preventDefault();
		var address = el.email.value.trim();
		if (busy || !address) { return; }
		checkEmail(address);
	});

	el.passwordForm.addEventListener('submit', function (event) {
		event.preventDefault();
		var password = el.password.value;
		if (busy || !password) { return; }
		checkPassword(password);
	});

	el.reveal.addEventListener('click', function () {
		var shown = el.password.type === 'text';
		el.password.type = shown ? 'password' : 'text';
		el.reveal.textContent = shown ? 'Näytä' : 'Piilota';
		el.reveal.setAttribute('aria-pressed', shown ? 'false' : 'true');
		el.password.focus();
	});

	// crypto.subtle on saatavilla vain suojatussa kontekstissa. Kerrotaan se heti
	// eikä vasta siinä vaiheessa, kun käyttäjä on jo kirjoittanut salasanansa.
	if (!(window.crypto && crypto.subtle)) {
		el.passwordSubmit.disabled = true;
		el.password.disabled = true;
		setStatus('Salasanan tarkistus vaatii HTTPS-yhteyden.', true);
	}

	setMode('email');
})();
