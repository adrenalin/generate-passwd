/* salasanasi.fi — kävijämittauksen käynnistys.
 * SPDX-License-Identifier: LGPL-3.0-or-later
 *
 * Matomo on itse ylläpidetty ja mittaus kulkee tämän saman osoitteen kautta
 * (/stats/…), jolloin selain ei ota yhteyttä yhteenkään ulkopuoliseen
 * palvelimeen. Evästeitä ei aseteta. Katso /tietosuoja.
 */
(function () {
	var nav = window.navigator || {};

	// Kunnioita seurannan kieltoa jo ennen kuin mitään ladataan.
	if (nav.globalPrivacyControl === true || nav.doNotTrack === '1' || window.doNotTrack === '1') {
		return;
	}

	var _paq = window._paq = window._paq || [];
	_paq.push(['disableCookies']);
	_paq.push(['setTrackerUrl', '/stats/matomo.php']);
	_paq.push(['setSiteId', '3']);
	_paq.push(['trackPageView']);
	_paq.push(['enableLinkTracking']);

	var d = document;
	var g = d.createElement('script');
	var s = d.getElementsByTagName('script')[0];
	g.async = true;
	g.src = '/stats/matomo.js';
	s.parentNode.insertBefore(g, s);
})();
