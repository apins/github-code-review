'use strict';

chrome.storage.local.get(null, function (settings) {
	var config = settings ? ( !! settings.config ? settings.config : settings) : {};
	var access_token = settings ? ( !! settings.access_token ? settings.access_token : '') : '';

	function saveStorage() {
		chrome.storage.local.set({config: config, access_token: access_token});
	}

	chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
		switch (message.command) {
			case 'getPullRequestConfig':
				if ( ! message.repository || ! message.pull_request_id) {
					sendResponse({data: {config: null}});
					break;
				}

				sendResponse({data: {
					config: config[message.repository] && config[message.repository][message.pull_request_id]
						? config[message.repository][message.pull_request_id]
						: {}
				}});
				break;

			case 'getRepositoryConfig':
				if ( ! message.repository) {
					sendResponse({data: {config: null}});
					break;
				}

				sendResponse({data: {
					config: config[message.repository] ? config[message.repository] : {}
				}});
				break;

			case 'getFullConfig':
				sendResponse({data: {config: config}});
				break;

			case 'setFullConfig':
				config = message.config;
				saveStorage();
				break;

			case 'setPullRequestConfig':
				if ( ! config[message.repository]) {
					config[message.repository] = {};
				}
				if ( ! config[message.repository][message.pull_request_id]) {
					config[message.repository][message.pull_request_id] = {};
				}

				config[message.repository][message.pull_request_id] = message.config;

				if (Object.keys(config[message.repository][message.pull_request_id]).length == 0) {
					delete config[message.repository][message.pull_request_id];
				}
				if (Object.keys(config[message.repository]).length == 0) {
					delete config[message.repository];
				}

				saveStorage();
				
				break;

			case 'getGitHubAccessToken':
				sendResponse({data: {access_token: access_token}});
				break;

			case 'setGitHubAccessToken':
				access_token = message.data;
				saveStorage();
				break;

			case 'getChangedFilesCount':
				(function () {
					var random_request_id = Math.round(Math.random()*8999) + 1000;
					var access_token_for_request = !! message.access_token ? message.access_token : access_token;
					var request_url = 'https://api.github.com/repos/'+message.repository+'/pulls/'+message.pull_request_id;

					console.debug('API Request ['+random_request_id+'] ', request_url);
					$.ajax({
						url: request_url,
						data: {access_token: access_token_for_request},
						dataType: 'json',
						async: false,
						success: function (xhr_response_data) {
							console.debug('API Response ['+random_request_id+']', xhr_response_data);
							sendResponse({data: {changed_files_count: xhr_response_data.changed_files}});
						},
						error: function (xhr, text_status, text_error) {
							console.debug('API Response FAILED ['+random_request_id+'] (status: '+text_status+') '+text_error, xhr);
							sendResponse({data: {changed_files_count: undefined}});
						}
					});
				})();
				break;

			case 'getPullRequestState':
				(function () {
					var random_request_id = Math.round(Math.random()*8999) + 1000;
					var access_token_for_request = !! message.access_token ? message.access_token : access_token;
					var request_url = 'https://api.github.com/repos/'+message.repository+'/pulls/'+message.pull_request_id;

					console.debug('API Request ['+random_request_id+'] ', request_url);
					$.ajax({
						url: request_url,
						data: {access_token: access_token_for_request},
						dataType: 'json',
						async: false,
						success: function (xhr_response_data) {
							console.debug('API Response ['+random_request_id+']', xhr_response_data);
							sendResponse({data: {state: xhr_response_data.state}});
						},
						error: function (xhr, text_status, text_error) {
							console.debug('API Response FAILED ['+random_request_id+'] (status: '+text_status+') '+text_error, xhr);
							sendResponse({data: {state: undefined}});
						}
					});
				})();
				break;

			case 'getPullRequestFiles':
				// @todo: implement ttl
				
				(function () {
					var random_request_id = Math.round(Math.random()*8999) + 1000;
					var access_token_for_request = !! message.access_token ? message.access_token : access_token;
					var request_url = 'https://api.github.com/repos/'+message.repository+'/pulls/'+message.pull_request_id+'/files';

					console.debug('API Request ['+random_request_id+'] ', request_url);
					$.ajax({
						url: request_url,
						data: {access_token: access_token_for_request},
						dataType: 'json',
						async: false,
						success: function (xhr_response_data) {
							console.debug('API Response ['+random_request_id+']', xhr_response_data);
							sendResponse({data: {files: xhr_response_data}});
						},
						error: function (xhr, text_status, text_error) {
							console.debug('API Response FAILED ['+random_request_id+'] (status: '+text_status+') '+text_error, xhr);
							sendResponse({data: {files: undefined}});
						}
					});
				})();
				break;

			case 'getPullRequestComments':
				// @todo: implement ttl

				(function () {
					var random_request_id = Math.round(Math.random()*8999) + 1000;
					var access_token_for_request = !! message.access_token ? message.access_token : access_token;
					var request_url = 'https://api.github.com/repos/'+message.repository+'/pulls/'+message.pull_request_id+'/comments';

					console.debug('API Request ['+random_request_id+'] ', request_url);
					$.ajax({
						url: request_url,
						data: {access_token: access_token_for_request},
						dataType: 'json',
						async: false,
						success: function (xhr_response_data) {
							console.debug('API Response ['+random_request_id+']', xhr_response_data);
							sendResponse({data: {comments: xhr_response_data}});
						},
						error: function (xhr, text_status, text_error) {
							console.debug('API Response FAILED ['+random_request_id+'] (status: '+text_status+') '+text_error, xhr);
							sendResponse({data: {comments: undefined}});
						}
					});
				})();
				break;

			case 'getApiToken':
				sendResponse({data: {access_token: access_token}});
				break;

			default:
		}
	});

	chrome.webNavigation.onHistoryStateUpdated.addListener(function (details) {
		chrome.tabs.get(details.tabId, function (tab) {
			if (tab.status == 'complete') {
				chrome.tabs.executeScript(tab.id, {file: "lib/jquery-3.1.1.min.js"});
				chrome.tabs.executeScript(tab.id, {file: "content/common.js"});
				chrome.tabs.executeScript(tab.id, {file: "content/pull_requests.js"});
				chrome.tabs.executeScript(tab.id, {file: "content/pull_request_files.js"});
			}
		});
	});
});
