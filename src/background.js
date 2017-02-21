chrome.storage.local.get(null, function (data) {
	// @todo: rename `data` to `settings` and `config` to `approvedFiles`

	var config = data ? ( !! data.config ? data.config : data) : {};
	var access_token = data ? ( !! data.access_token ? data.access_token : '') : '';

	function saveStorage() {
		chrome.storage.local.set({config: config, access_token: access_token});
	}

	chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
		switch (message.command) {
			case 'getConfig':
				var requested_config;

				if ( !! message.pull_request_id) {
					requested_config = config[message.repository] && config[message.repository][message.pull_request_id]
						? config[message.repository][message.pull_request_id]
						: {};
				}
				else {
					requested_config = config[message.repository] ? config[message.repository] : {};
				}

				sendResponse({data: requested_config});
				break;

			// @todo: merge into 'getConfig' with ` !! message.repository` condition
			case 'getFullConfig':
				sendResponse({data: config});
				break;

			case 'setFullConfig':
				// @todo: sub-property of `data` should be used instead: `message.data.config`
				config = message.data;
				saveStorage();
				break;

			case 'setConfig':
				if ( ! config[message.repository]) {
					config[message.repository] = {};
				}
				if ( ! config[message.repository][message.pull_request_id]) {
					config[message.repository][message.pull_request_id] = {};
				}
				config[message.repository][message.pull_request_id] = message.config;
				saveStorage();
				break;

			case 'getGitHubAccessToken':
				sendResponse({data: access_token});
				break;

			case 'setGitHubAccessToken':
				access_token = message.data;
				saveStorage();
				break;

			case 'wipeClosedPullRequests':
				var requests = [];

				Object.keys(config).forEach(function (repo_full_name) {
					Object.keys(config[repo_full_name]).forEach(function (pull_request_id) {
						requests.push({repo_full_name: repo_full_name, pull_request_id: pull_request_id});
					});
				});

				function processPullRequest(request) {
					if ( ! request) {
						finalizeWipe();
						return;
					}

					// @todo: switch to sync!
					$.get(
						'https://api.github.com/repos/'+request.repo_full_name+'/pulls/'+request.pull_request_id,
						{access_token: message.data.access_token},
						function (data) {
							if ( !! data.state && data.state != 'open') {
								delete config[request.repo_full_name][request.pull_request_id];
							}

							processPullRequest(requests.pop());
						}
					);
				}
				processPullRequest(requests.pop());

				function finalizeWipe() {
					Object.keys(config).forEach(function (repo_full_name) {
						if (Object.keys(config[repo_full_name]).length == 0) {
							delete config[repo_full_name];
						}
					});

					saveStorage();
				}
				break;

			case 'getChangedFilesCount':
				$.ajax({
					url: 'https://api.github.com/repos/'+message.repository+'/pulls/'+message.pull_request_id,
					data: {access_token: access_token},
					dataType: 'json',
					async: false,
					success: function (data) {
						sendResponse({data: {changed_files_count: data.changed_files}});
					}
				});
				break;

			case 'getApiToken':
				sendResponse({data: {access_token: access_token}});
				break;

			default:
		}
	});

	chrome.webNavigation.onHistoryStateUpdated.addListener(function(details) {
		chrome.tabs.executeScript(null, {file: "content.js"});
	});
});
