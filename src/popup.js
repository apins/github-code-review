$(document).ready(function () {
	var allow_reload_textarea = true;

	// Set settings
	document.querySelector('.js-apply-config').addEventListener('click', function () {
		var value = document.querySelector('#config_container').value;
		var fullConfig = value.length > 0 ? JSON.parse(value) : {};

		allow_reload_textarea = false;

		if (confirm('This action can not be reversed. Confirm update')) {
			chrome.runtime.sendMessage(
				{command: 'setFullConfig', data: fullConfig},
				function () {
					allow_reload_textarea = true;
				}
			);
		}
		else {
			allow_reload_textarea = true;
		}
	}, false);

	document.querySelector('.js-integration-save').addEventListener('click', function () {
		var token = document.querySelector('#github_api_token').value;

		chrome.runtime.sendMessage(
			{command: 'setGitHubAccessToken', data: token}
		);
	}, false);

	document.querySelector('.js-cleanup-garbage').addEventListener('click', function () {
		var token = document.querySelector('#github_api_token').value;
		
		chrome.runtime.sendMessage(
			{command: 'wipeClosedPullRequests', data: {access_token: token}}
		);
	}, false);

	// @todo: can be removed when $.get will become synchronous and so will be able to send here response with data
	window.setInterval(function () { getFullConfig(); }, 100);
	getFullConfig();

	chrome.runtime.sendMessage(
		{command: 'getGitHubAccessToken'},
		function (response) {
			document.querySelector('#github_api_token').value = response.data;
		}
	);

	function getFullConfig() {
		chrome.runtime.sendMessage(
			{command: 'getFullConfig'},
			function(response) {
				if (
					allow_reload_textarea
					&& document.querySelector('#config_container').value != JSON.stringify(response.data)
					&& document.querySelector('#config_container') != document.activeElement
				) {
					document.querySelector('#config_container').value = JSON.stringify(response.data);
				}
			}
		);
	}

	document.querySelector('#config_container').addEventListener('focus', function () {
		allow_reload_textarea = false;
	}, false);
	document.querySelector('#config_container').addEventListener('blur', function () {
		allow_reload_textarea = false;
		window.setTimeout(function () {
			allow_reload_textarea = true;
		}, 500);
	}, false);
});
