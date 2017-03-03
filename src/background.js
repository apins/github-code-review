'use strict';

chrome.storage.local.get(null, function (settings) {
	var config = settings ? ( !! settings.config ? settings.config : settings) : {};
	var access_token = settings ? ( !! settings.access_token ? settings.access_token : '') : '';

	// Min seconds between the same API requests
	var ttl_pull_request_files = 5;
	var ttl_pull_request_comments = 10;
	var ttl_pull_requests = 10;

	var cached_api_responses = {files: {}, comments: {}, pull_requests: {}};

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
				// Response with cached data when available
				if (
					!! cached_api_responses.pull_requests[message.repository+'_'+message.pull_request_id]
					&& moment(cached_api_responses.pull_requests[message.repository+'_'+message.pull_request_id].timestamp) >= moment().subtract(ttl_pull_requests, 'seconds')
				) {
					console.log('Cached response used for pull request info (repository: '+message.repository+', pull request: '+message.pull_request_id+')');
					sendResponse({data: {changed_files_count: cached_api_responses.pull_requests[message.repository+'_'+message.pull_request_id].response.changed_files}});
					break;
				}

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

							// Cache response
							cached_api_responses.pull_requests[message.repository+'_'+message.pull_request_id] = {response: xhr_response_data, timestamp: moment().format()};

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
				// Response with cached data when available
				if (
					!! cached_api_responses.pull_requests[message.repository+'_'+message.pull_request_id]
					&& moment(cached_api_responses.pull_requests[message.repository+'_'+message.pull_request_id].timestamp) >= moment().subtract(ttl_pull_requests, 'seconds')
				) {
					console.log('Cached response used for pull request info (repository: '+message.repository+', pull request: '+message.pull_request_id+')');
					sendResponse({data: {state: cached_api_responses.pull_requests[message.repository+'_'+message.pull_request_id].response.state}});
					break;
				}

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

							// Cache response
							cached_api_responses.pull_requests[message.repository+'_'+message.pull_request_id] = {response: xhr_response_data, timestamp: moment().format()};
							
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
				// Response with cached data when available
				if (
					!! cached_api_responses.files[message.repository+'_'+message.pull_request_id+'_'+message.page]
					&& moment(cached_api_responses.files[message.repository+'_'+message.pull_request_id+'_'+message.page].timestamp) >= moment().subtract(ttl_pull_request_files, 'seconds')
				) {
					console.log('Cached response used for files (repository: '+message.repository+', pull request: '+message.pull_request_id+', page: '+message.page+')');
					sendResponse({data: {files: cached_api_responses.files[message.repository+'_'+message.pull_request_id+'_'+message.page].response}});
					break;
				}

				(function () {
					var random_request_id = Math.round(Math.random()*8999) + 1000;
					var access_token_for_request = !! message.access_token ? message.access_token : access_token;
					var request_url = 'https://api.github.com/repos/'+message.repository+'/pulls/'+message.pull_request_id+'/files';

					console.debug('API Request ['+random_request_id+'] ', request_url);
					$.ajax({
						url: request_url,
						data: {access_token: access_token_for_request, page: message.page},
						dataType: 'json',
						async: false,
						success: function (xhr_response_data) {
							console.debug('API Response ['+random_request_id+']', xhr_response_data);

							// Cache response
							cached_api_responses.files[message.repository+'_'+message.pull_request_id+'_'+message.page] = {response: xhr_response_data, timestamp: moment().format()};

							sendResponse({data: {files: xhr_response_data, page: message.page}});
						},
						error: function (xhr, text_status, text_error) {
							console.debug('API Response FAILED ['+random_request_id+'] (status: '+text_status+') '+text_error, xhr);
							sendResponse({data: {files: undefined, page: message.page}});
						}
					});
				})();
				break;

			case 'getPullRequestComments':
				// Response with cached data when available
				if (
					!! cached_api_responses.comments[message.repository+'_'+message.pull_request_id]
					&& moment(cached_api_responses.comments[message.repository+'_'+message.pull_request_id].timestamp) >= moment().subtract(ttl_pull_request_comments, 'seconds')
				) {
					console.log('Cached response used for comments (repository: '+message.repository+', pull request: '+message.pull_request_id+')');
					sendResponse({data: {comments: cached_api_responses.comments[message.repository+'_'+message.pull_request_id].response}});
					break;
				}

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

							// Cache response
							cached_api_responses.comments[message.repository+'_'+message.pull_request_id] = {response: xhr_response_data, timestamp: moment().format()};

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
				chrome.tabs.executeScript(tab.id, {file: "lib/moment.min.js"});
				chrome.tabs.executeScript(tab.id, {file: "content/common.js"});
				chrome.tabs.executeScript(tab.id, {file: "content/pull_requests.js"});
				chrome.tabs.executeScript(tab.id, {file: "content/pull_request_files.js"});
			}
		});
	});
});
