/* salasanasi.fi — vuototietojen suomennokset ja yhteiset apurit.
 * SPDX-License-Identifier: LGPL-3.0-or-later
 * Copyright (C) 2026 Arttu Manninen
 *
 * Kahden sivun yhteinen sanasto. /vuodot näyttää XposedOrNotin aineistoa ja
 * /tietovuodot Have I Been Pwnedin; molemmat nimeävät vuotaneet tietoluokat
 * englanniksi eivätkä aivan samalla joukolla, joten taulukko kattaa molemmat.
 * Tuntematon luokka näytetään sellaisenaan englanniksi — parempi kuin jättää
 * kertomatta, että jotain muutakin vuoti.
 *
 * Palvelut kirjoittavat heittomerkin eri tavoin (Driver’s vs Driver's), joten
 * avaimet ovat suoralla heittomerkillä ja haku normalisoi kumpaankin suuntaan.
 */
'use strict';

var BREACH_TERMS = (function () {
	var DATA_CLASSES = {
		'Academic records': 'opintorekisteritiedot',
		'Account balances': 'tilisaldot',
		'Address book contacts': 'osoitekirjan yhteystiedot',
		'Age groups': 'ikäryhmät',
		'Ages': 'iät',
		'AI prompts': 'tekoälylle annetut kehotteet',
		'Appointments': 'ajanvaraukset',
		'Apps installed on devices': 'asennetut sovellukset',
		'Astrological signs': 'horoskooppimerkit',
		'Audio recordings': 'äänitallenteet',
		'Auth tokens': 'kirjautumispolettit',
		'Avatars': 'profiilikuvat',
		'Bank account numbers': 'pankkitilinumerot',
		'Beauty ratings': 'ulkonäköarviot',
		'Biometric data': 'biometriset tiedot',
		'Bios': 'esittelytekstit',
		'Browser user agent details': 'selaintiedot',
		'Browser user agents': 'selaintiedot',
		'Browsing histories': 'selaushistoria',
		'Buying preferences': 'ostomieltymykset',
		'Car ownership statuses': 'auton omistus',
		'Career levels': 'urataso',
		'Cellular network names': 'matkapuhelinverkot',
		'Charitable donations': 'hyväntekeväisyyslahjoitukset',
		'Chat logs': 'keskusteluhistoria',
		'Citizenship statuses': 'kansalaisuustiedot',
		'Clothing sizes': 'vaatekoot',
		'Comments': 'kommentit',
		'Company names': 'yritysten nimet',
		'Credit card CVV': 'maksukorttien turvakoodit',
		'Credit card details': 'maksukorttitiedot',
		'Credit cards': 'maksukorttitiedot',
		'Credit scores': 'luottoluokitukset',
		'Credit status information': 'luottotiedot',
		'Cryptocurrency wallet addresses': 'kryptolompakoiden osoitteet',
		'Customer feedback': 'asiakaspalaute',
		'Customer interactions': 'asiakaskontaktit',
		'Customer service records': 'asiakaspalvelun tapahtumat',
		'Dates of birth': 'syntymäajat',
		'Deceased date': 'kuolinpäivä',
		'Deceased statuses': 'tieto kuolemasta',
		'Delivery instructions': 'toimitusohjeet',
		'Device information': 'laitetiedot',
		'Device serial numbers': 'laitteiden sarjanumerot',
		'Device usage tracking data': 'laitteen käyttöseuranta',
		'Disabilities': 'vammaisuustiedot',
		'Display names': 'näyttönimet',
		'Drinking habits': 'alkoholinkäyttö',
		'Driver\'s licenses': 'ajokorttitiedot',
		'Drug habits': 'huumeidenkäyttö',
		'Earnings': 'ansiotiedot',
		'Eating habits': 'ruokailutottumukset',
		'Education levels': 'koulutustaso',
		'Email addresses': 'sähköpostiosoitteet',
		'Email messages': 'sähköpostiviestit',
		'Employers': 'työnantajat',
		'Employment statuses': 'työtilanne',
		'Encrypted keys': 'salatut avaimet',
		'Ethnicities': 'etninen tausta',
		'Family members\' names': 'perheenjäsenten nimet',
		'Family structure': 'perherakenne',
		'Financial investments': 'sijoitukset',
		'Financial transactions': 'maksutapahtumat',
		'Fitness levels': 'kuntotiedot',
		'Flights taken': 'lennetyt matkat',
		'Forum posts': 'keskustelupalstan viestit',
		'Genders': 'sukupuoli',
		'Geographic locations': 'sijaintitiedot',
		'Government IDs': 'viranomaistunnisteet',
		'Government issued IDs': 'viranomaistunnisteet',
		'Health insurance information': 'sairausvakuutustiedot',
		'Historical passwords': 'vanhat salasanat',
		'HIV statuses': 'HIV-tiedot',
		'Home ownership statuses': 'asunnon omistus',
		'Homepage URLs': 'kotisivujen osoitteet',
		'IMEI numbers': 'IMEI-numerot',
		'IMSI numbers': 'IMSI-numerot',
		'Income levels': 'tulotaso',
		'Instant messenger identities': 'pikaviestitunnukset',
		'IP addresses': 'IP-osoitteet',
		'IQ levels': 'älykkyysosamäärät',
		'Job applications': 'työhakemukset',
		'Job titles': 'ammattinimikkeet',
		'Language preferences': 'kielivalinnat',
		'Latitude and longitude pairs': 'sijaintikoordinaatit',
		'Licence plates': 'rekisteritunnukset',
		'Living costs': 'elinkustannukset',
		'Loan information': 'lainatiedot',
		'Login histories': 'kirjautumishistoria',
		'Loyalty program details': 'kanta-asiakastiedot',
		'MAC addresses': 'MAC-osoitteet',
		'Marital statuses': 'siviilisääty',
		'Medical conditions': 'terveystiedot',
		'Mnemonic phrases': 'kryptolompakoiden palautuslauseet',
		'Mothers maiden names': 'äitien tyttönimet',
		'Names': 'nimet',
		'Nationalities': 'kansalaisuudet',
		'Net worths': 'nettovarallisuus',
		'Nicknames': 'lempinimet',
		'Occupations': 'ammatit',
		'Parenting plans': 'lasten huoltosuunnitelmat',
		'Partial credit card data': 'osittaiset maksukorttitiedot',
		'Partial dates of birth': 'osittaiset syntymäajat',
		'Partial government issued IDs': 'osittaiset viranomaistunnisteet',
		'Partial phone numbers': 'osittaiset puhelinnumerot',
		'Passport numbers': 'passinumerot',
		'Password hints': 'salasanavihjeet',
		'Password strengths': 'salasanojen vahvuudet',
		'Passwords': 'salasanat',
		'Payment histories': 'maksuhistoria',
		'Payment methods': 'maksutavat',
		'Personal descriptions': 'henkilökuvaukset',
		'Personal health data': 'terveystiedot',
		'Personal interests': 'kiinnostuksen kohteet',
		'Phone numbers': 'puhelinnumerot',
		'Photos': 'valokuvat',
		'Physical addresses': 'postiosoitteet',
		'Physical attributes': 'ulkoiset tuntomerkit',
		'PINs': 'PIN-koodit',
		'Places of birth': 'syntymäpaikat',
		'Political donations': 'poliittiset lahjoitukset',
		'Political views': 'poliittiset näkemykset',
		'Private messages': 'yksityisviestit',
		'Professional skills': 'ammatilliset taidot',
		'Profile photos': 'profiilikuvat',
		'Profile statistics': 'profiilitilastot',
		'Purchases': 'ostokset',
		'Purchasing habits': 'ostotottumukset',
		'Races': 'rotutiedot',
		'Recovery email addresses': 'palautussähköpostiosoitteet',
		'Relationship statuses': 'parisuhdetilanne',
		'Religions': 'uskonnollinen vakaumus',
		'Reward program balances': 'bonussaldot',
		'Salutations': 'puhuttelumuodot',
		'School grades (class levels)': 'luokka-asteet',
		'Security questions and answers': 'turvakysymykset ja vastaukset',
		'Sexual fetishes': 'seksuaaliset mieltymykset',
		'Sexual orientations': 'seksuaalinen suuntautuminen',
		'Shipment tracking numbers': 'lähetysten seurantanumerot',
		'Smoking habits': 'tupakointi',
		'SMS messages': 'tekstiviestit',
		'Social connections': 'sosiaaliset suhteet',
		'Social media profiles': 'sosiaalisen median profiilit',
		'Social security numbers': 'henkilötunnukset',
		'Socioeconomic levels': 'sosioekonominen asema',
		'Spoken languages': 'puhutut kielet',
		'Spouses names': 'puolisoiden nimet',
		'Support tickets': 'tukipyynnöt',
		'Survey results': 'kyselyvastaukset',
		'Tattoo status': 'tatuoinnit',
		'Taxation records': 'verotustiedot',
		'Telecommunications carrier': 'teleoperaattori',
		'Time zones': 'aikavyöhykkeet',
		'Titles': 'tittelit',
		'Travel habits': 'matkustustottumukset',
		'Travel plans': 'matkasuunnitelmat',
		'User statuses': 'käyttäjätilat',
		'User website URLs': 'käyttäjien verkko-osoitteet',
		'Usernames': 'käyttäjätunnukset',
		'Utility bills': 'sähkö- ja vesilaskut',
		'Vehicle details': 'ajoneuvotiedot',
		'Vehicle identification numbers (VINs)': 'ajoneuvojen valmistenumerot',
		'Vehicle registration numbers': 'ajoneuvojen rekisteritunnukset',
		'Vehicle registration plates': 'ajoneuvojen rekisterikilvet',
		'VIP statuses': 'VIP-asema',
		'Warranty claims': 'takuuvaatimukset',
		'Website activity': 'sivuston käyttöhistoria',
		'Work habits': 'työtavat',
		'Years of professional experience': 'työkokemusvuodet'
	};

	var INDUSTRIES = {
		'Adult': 'aikuisviihde',
		'Aerospace': 'ilmailu',
		'Agriculture': 'maatalous',
		'Automotive': 'autoala',
		'Construction': 'rakentaminen',
		'Consulting': 'konsultointi',
		'Cryptocurrency': 'kryptovaluutat',
		'Dating': 'deittipalvelut',
		'Education': 'koulutus',
		'Electronics': 'elektroniikka',
		'Energy': 'energia',
		'Entertainment': 'viihde',
		'Environment': 'ympäristöala',
		'Finance': 'rahoitus',
		'Food': 'ruoka',
		'Gaming': 'pelit',
		'Government': 'julkishallinto',
		'Health Care': 'terveydenhuolto',
		'Hospitality': 'matkailu ja ravintola',
		'Information Technology': 'tietotekniikka',
		'Insurance': 'vakuutus',
		'Legal': 'oikeudelliset palvelut',
		'Logistics': 'logistiikka',
		'Manufacturing': 'teollisuus',
		'Marketing': 'markkinointi',
		'Miscellaneous': 'sekalaiset',
		'Music': 'musiikki',
		'News Media': 'uutismedia',
		'Non-Profit/Charities': 'järjestöt',
		'Pharmaceutical': 'lääketeollisuus',
		'Real Estate': 'kiinteistöala',
		'Retail': 'vähittäiskauppa',
		'Social Media': 'sosiaalinen media',
		'Sports': 'urheilu',
		'Telecommunication': 'tietoliikenne',
		'Transport': 'liikenne',
		'Travel': 'matkailu'
	};

	function normalise(value) {
		return String(value === undefined || value === null ? '' : value).trim().replace(/[\u2018\u2019]/g, "'");
	}

	function lookup(map, value) {
		var key = normalise(value);
		return map[key] || key;
	}

	return {
		// Tietoluokka suomeksi, esimerkiksi "Passwords" -> "salasanat".
		dataClass: function (value) {
			return lookup(DATA_CLASSES, value);
		},

		// Toimiala suomeksi, esimerkiksi "Health Care" -> "terveydenhuolto".
		industry: function (value) {
			return lookup(INDUSTRIES, value);
		},

		// XposedOrNot antaa luokat puolipisteillä eroteltuna merkkijonona,
		// Have I Been Pwned taulukkona. Molemmista tulee sama suomennettu lista.
		dataClassList: function (raw) {
			var items = Array.isArray(raw) ? raw : String(raw || '').split(';');
			return items
				.map(normalise)
				.filter(function (item) { return item.length > 0; })
				.map(function (item) { return lookup(DATA_CLASSES, item); });
		},

		// Tuhaterotin on suomessa välilyönti: 14936670 -> "14 936 670".
		formatCount: function (n) {
			return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
		},

		// "ManchesterAirportsGroup" -> "Manchester Airports Group". Nimet ovat
		// tunnisteita eivätkä otsikoita, joten jako tehdään vain selvässä kohdassa:
		// pieni kirjain, jota seuraa iso. Näin "000webhost", "BTC-E" ja
		// "OGusers-2020" jäävät ennalleen.
		humanise: function (name) {
			return String(name || '').replace(/([a-zä-ö0-9])([A-ZÄ-Ö])/g, '$1 $2');
		}
	};
})();
