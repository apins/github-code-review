$(document).ready(function () {
	document.querySelector('.js-apply-config').addEventListener('click', function () {
		var value = document.querySelector('#config_container').value;
		var config = value.length > 0 ? JSON.parse(value) : {};

		if (confirm('This action can not be undone. Save?')) {
			chrome.runtime.sendMessage({command: 'setFullConfig', config: config});
			refreshTextarea(config);
		}
	}, false);

	document.querySelector('.js-integration-save').addEventListener('click', function () {
		chrome.runtime.sendMessage({command: 'setGitHubAccessToken', data: document.querySelector('#github_api_token').value});
	}, false);

	document.querySelector('.js-cleanup-garbage').addEventListener('click', function () {
		var token = document.querySelector('#github_api_token').value;
		lockTextarea();

		chrome.runtime.sendMessage({command: 'getFullConfig'}, function (response) {
			var config = response.data.config;
			var requests_counter = 0;

			Object.keys(config).forEach(function (each_repository) {
				Object.keys(config[each_repository]).forEach(function (each_pull_request_id) {
					var repository = each_repository;
					var pull_request_id = each_pull_request_id;

					requests_counter++;

					setTimeout(function () {
						chrome.runtime.sendMessage(
							{command: 'getPullRequestState', repository: repository, pull_request_id: pull_request_id, access_token: token},
							function (response) {
								requests_counter--;

								if (response.data.state && response.data.state != 'open') {
									delete config[repository][pull_request_id];

									if (Object.keys(config[repository]).length == 0) {
										delete config[repository];
									}
								}

								if (requests_counter == 0) {
									chrome.runtime.sendMessage({command: 'setFullConfig', config: config});
									refreshTextarea(config);
									unlockTextarea();
								}
							}
						);
					}, 0);
				});
			});

			if (requests_counter == 0) {
				unlockTextarea();
			}
		});
	}, false);

	chrome.runtime.sendMessage({command: 'getFullConfig'}, function(response) {
		refreshTextarea(response.data.config);
	});

	chrome.runtime.sendMessage(
		{command: 'getGitHubAccessToken'},
		function (response) {
			document.querySelector('#github_api_token').value = response.data.access_token;
		}
	);

	function refreshTextarea(config) {
		if (
			document.querySelector('#config_container').value != JSON.stringify(config)
			&& document.querySelector('#config_container') != document.activeElement
		) {
			document.querySelector('#config_container').value = JSON.stringify(config);
		}
	}

	function lockTextarea() {
		document.querySelector('#config_container').setAttribute('disabled', 'disabled');
		document.querySelector('#config_container').setAttribute('readonly', 'readonly');
	}

	function unlockTextarea() {
		document.querySelector('#config_container').removeAttribute('disabled');
		document.querySelector('#config_container').removeAttribute('readonly');
	}
});
