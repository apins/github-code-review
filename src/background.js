'use strict';

chrome.storage.sync.get(null, function (settings) {
	var config = settings ? ( !! settings.config ? settings.config : settings) : {};
	var access_token = settings ? ( !! settings.access_token ? settings.access_token : '') : '';

	// Min seconds between the same API requests
	var ttl_pull_request_files = 5;
	var ttl_pull_request_comments = 5;
	var ttl_pull_request = 5;
	var ttl_repository_pull_requests = 5;

	var cached_api_responses = {files: {}, comments: {}, pull_requests: {}, repository_pull_requests: {}};

	function saveStorage() {
		chrome.storage.sync.set({config: config, access_token: access_token});
	}

	chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
		switch (message.command) {
			// Clipboard functionality
			case 'copyToClipboard':
				var input = document.createElement('textarea');
				
				document.body.appendChild(input);
				input.value = message.text;
				input.focus();
				input.select();

				var copy_result = document.execCommand('Copy');
				input.remove();

				sendResponse({data: {result: copy_result}});

				break;

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
					var headers = {};
					var request_key = message.repository+'_'+message.pull_request_id;

					// Response with cached data when available
					if ( !! cached_api_responses.pull_requests[request_key]) {
						if (moment(cached_api_responses.pull_requests[request_key].timestamp) >= moment().subtract(ttl_pull_request, 'seconds')) {
							console.log('Cached response used for pull request info (repository: '+message.repository+', pull request: '+message.pull_request_id+')');
							sendResponse({data: {changed_files_count: cached_api_responses.pull_requests[request_key].response.changed_files}});
							return;
						}

						if (cached_api_responses.pull_requests[request_key].lastModified) {
							headers['If-Modified-Since'] = cached_api_responses.pull_requests[request_key].lastModified;
						}
					}

					var random_request_id = Math.round(Math.random()*8999) + 1000;
					var access_token_for_request = !! message.access_token ? message.access_token : access_token;
					var request_url = 'https://api.github.com/repos/'+message.repository+'/pulls/'+message.pull_request_id;

					console.debug('API Request ['+random_request_id+'] ', request_url);
					$.ajax({
						url: request_url,
						data: {access_token: access_token_for_request},
						dataType: 'json',
						async: false,
						headers: headers,
						success: function (xhr_response_data, text_status, xhr) {
							if (xhr.status == 304) {
								console.debug('API Response ['+random_request_id+'] not modified');
								sendResponse({data: {changed_files_count: cached_api_responses.pull_requests[request_key].response.changed_files}});
								return;
							}

							console.debug('API Response ['+random_request_id+']', xhr_response_data, text_status, xhr.status);

							// Cache response
							cached_api_responses.pull_requests[request_key] = {
								response: xhr_response_data,
								timestamp: moment().format(),
								lastModified: xhr.getResponseHeader('Last-Modified')
							};

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
					var headers = {};
					var request_key = message.repository+'_'+message.pull_request_id;

					// Response with cached data when available
					if ( !! cached_api_responses.pull_requests[request_key]) {
						if (moment(cached_api_responses.pull_requests[request_key].timestamp) >= moment().subtract(ttl_pull_request, 'seconds')) {
							console.log('Cached response used for pull request info (repository: '+message.repository+', pull request: '+message.pull_request_id+')');
							sendResponse({data: {state: cached_api_responses.pull_requests[request_key].response.state}});
							return;
						}

						if (cached_api_responses.pull_requests[request_key].lastModified) {
							headers['If-Modified-Since'] = cached_api_responses.pull_requests[request_key].lastModified;
						}
					}

					var random_request_id = Math.round(Math.random()*8999) + 1000;
					var access_token_for_request = !! message.access_token ? message.access_token : access_token;
					var request_url = 'https://api.github.com/repos/'+message.repository+'/pulls/'+message.pull_request_id;

					console.debug('API Request ['+random_request_id+'] ', request_url);
					$.ajax({
						url: request_url,
						data: {access_token: access_token_for_request},
						dataType: 'json',
						async: false,
						headers: headers,
						success: function (xhr_response_data, text_status, xhr) {
							if (xhr.status == 304) {
								console.debug('API Response ['+random_request_id+'] not modified');
								sendResponse({data: {state: cached_api_responses.pull_requests[request_key].response.state}});
								return;
							}

							console.debug('API Response ['+random_request_id+']', xhr_response_data);

							// Cache response
							cached_api_responses.pull_requests[request_key] = {
								response: xhr_response_data,
								timestamp: moment().format(),
								lastModified: xhr.getResponseHeader('Last-Modified')
							};

							sendResponse({data: {state: xhr_response_data.state}});
						},
						error: function (xhr, text_status, text_error) {
							console.debug('API Response FAILED ['+random_request_id+'] (status: '+text_status+') '+text_error, xhr);
							sendResponse({data: {state: undefined}});
						}
					});
				})();
				break;

			case 'getRepositoryPullRequests':
				(function () {
					var headers = {};

					var requestParams = {
						page: 1,
						state: message.state ? message.state : 'all',
						per_page: message.per_page ? message.per_page : 500,
						sort: message.sort ? message.sort : 'created',
						direction: message.direction ? message.direction : 'desc'
					};

					var request_key = message.repository+'_'+requestParams.state+'_'+requestParams.sort+'_'+requestParams.direction+'_'+requestParams.per_page;

					// Response with cached data when available
					if ( !! cached_api_responses.repository_pull_requests[request_key]) {
						if (moment(cached_api_responses.repository_pull_requests[request_key].timestamp) >= moment().subtract(ttl_repository_pull_requests, 'seconds')) {
							console.log('Cached response used for pull requests list (repository: '+message.repository+')');
							sendResponse({data: {pull_requests: cached_api_responses.repository_pull_requests[request_key].response}});
							return;
						}

						if (cached_api_responses.repository_pull_requests[request_key].lastModified) {
							headers['If-Modified-Since'] = cached_api_responses.repository_pull_requests[request_key].lastModified;
						}
					}

					var random_request_id = Math.round(Math.random()*8999) + 1000;
					var access_token_for_request = !! message.access_token ? message.access_token : access_token;
					var request_url = 'https://api.github.com/repos/'+message.repository+'/pulls';

					console.debug('API Request ['+random_request_id+'] ', request_url);
					$.ajax({
						url: request_url,
						data: {access_token: access_token_for_request},
						dataType: 'json',
						async: false,
						headers: headers,
						success: function (xhr_response_data, text_status, xhr) {
							if (xhr.status == 304) {
								console.debug('API Response ['+random_request_id+'] not modified');
								sendResponse({data: {pull_requests: cached_api_responses.repository_pull_requests[request_key].response}});
								return;
							}

							console.debug('API Response ['+random_request_id+']', xhr_response_data);

							// Cache response
							cached_api_responses.repository_pull_requests[request_key] = {
								response: xhr_response_data,
								timestamp: moment().format(),
								lastModified: xhr.getResponseHeader('Last-Modified')
							};

							sendResponse({data: {state: xhr_response_data.state}});
						},
						error: function (xhr, text_status, text_error) {
							console.debug('API Response FAILED ['+random_request_id+'] (status: '+text_status+') '+text_error, xhr);
							sendResponse({data: {pull_requests: undefined}});
						}
					});
				})();
				break;

			case 'getPullRequestTitle':
				(function () {
					var headers = {};
					var request_key = message.repository+'_'+message.pull_request_id;

					// Response with cached data when available
					if ( !! cached_api_responses.pull_requests[request_key]) {
						if (moment(cached_api_responses.pull_requests[request_key].timestamp) >= moment().subtract(ttl_pull_request, 'seconds')) {
							console.log('Cached response used for pull request info (repository: '+message.repository+', pull request: '+message.pull_request_id+')');
							sendResponse({data: {title: cached_api_responses.pull_requests[request_key].response.title}});
							return;
						}

						if (cached_api_responses.pull_requests[request_key].lastModified) {
							headers['If-Modified-Since'] = cached_api_responses.pull_requests[request_key].lastModified;
						}
					}
					
					var random_request_id = Math.round(Math.random()*8999) + 1000;
					var access_token_for_request = !! message.access_token ? message.access_token : access_token;
					var request_url = 'https://api.github.com/repos/'+message.repository+'/pulls/'+message.pull_request_id;

					console.debug('API Request ['+random_request_id+'] ', request_url);
					$.ajax({
						url: request_url,
						data: {access_token: access_token_for_request},
						dataType: 'json',
						async: false,
						headers: headers,
						success: function (xhr_response_data, text_status, xhr) {
							if (xhr.status == 304) {
								console.debug('API Response ['+random_request_id+'] not modified');
								sendResponse({data: {title: cached_api_responses.pull_requests[request_key].response.title}});
								return;
							}

							console.debug('API Response ['+random_request_id+']', xhr_response_data);

							// Cache response
							cached_api_responses.pull_requests[request_key] = {
								response: xhr_response_data,
								timestamp: moment().format(),
								lastModified: xhr.getResponseHeader('Last-Modified')
							};

							sendResponse({data: {title: xhr_response_data.title}});
						},
						error: function (xhr, text_status, text_error) {
							console.debug('API Response FAILED ['+random_request_id+'] (status: '+text_status+') '+text_error, xhr);
							sendResponse({data: {title: undefined}});
						}
					});
				})();
				break;

			case 'getPullRequestFiles':
				(function () {
					var headers = {};
					var request_key = message.repository+'_'+message.pull_request_id+'_'+message.page;

					// Response with cached data when available
					if ( !! cached_api_responses.files[request_key]) {
						if (moment(cached_api_responses.files[request_key].timestamp) >= moment().subtract(ttl_pull_request_files, 'seconds')) {
							console.log('Cached response used for files (repository: '+message.repository+', pull request: '+message.pull_request_id+', page: '+message.page+')');
							sendResponse({data: {files: cached_api_responses.files[request_key].response}});
							return;
						}

						if (cached_api_responses.files[request_key].lastModified) {
							headers['If-Modified-Since'] = cached_api_responses.files[request_key].lastModified;
						}
					}

					var random_request_id = Math.round(Math.random()*8999) + 1000;
					var access_token_for_request = !! message.access_token ? message.access_token : access_token;
					var request_url = 'https://api.github.com/repos/'+message.repository+'/pulls/'+message.pull_request_id+'/files';

					console.debug('API Request ['+random_request_id+'] ', request_url);
					$.ajax({
						url: request_url,
						data: {access_token: access_token_for_request, page: message.page, per_page: 300},
						dataType: 'json',
						async: false,
						headers: headers,
						success: function (xhr_response_data, text_status, xhr) {
							if (xhr.status == 304) {
								console.debug('API Response ['+random_request_id+'] not modified');
								sendResponse({data: {files: cached_api_responses.files[request_key].response}});
								return;
							}

							console.debug('API Response ['+random_request_id+']', xhr_response_data);

							// Cache response
							cached_api_responses.files[request_key] = {
								response: xhr_response_data,
								timestamp: moment().format(),
								lastModified: xhr.getResponseHeader('Last-Modified')
							};

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
				(function () {
					var headers = {};
					var request_key = message.repository+'_'+message.pull_request_id+'_'+message.page;

					// Response with cached data when available
					if ( !! cached_api_responses.comments[request_key]) {
						if (moment(cached_api_responses.comments[request_key].timestamp) >= moment().subtract(ttl_pull_request_comments, 'seconds')) {
							console.log('Cached response used for comments (repository: '+message.repository+', pull request: '+message.pull_request_id+')');
							sendResponse({data: {comments: cached_api_responses.comments[request_key].response}});
							return;
						}

						if (cached_api_responses.comments[request_key].lastModified) {
							headers['If-Modified-Since'] = cached_api_responses.comments[request_key].lastModified;
						}
					}

					var random_request_id = Math.round(Math.random()*8999) + 1000;
					var access_token_for_request = !! message.access_token ? message.access_token : access_token;
					var request_url = 'https://api.github.com/repos/'+message.repository+'/pulls/'+message.pull_request_id+'/comments';

					console.debug('API Request ['+random_request_id+'] ', request_url);
					$.ajax({
						url: request_url,
						data: {access_token: access_token_for_request, page: message.page, per_page: 300},
						dataType: 'json',
						async: false,
						headers: headers,
						success: function (xhr_response_data, text_status, xhr) {
							if (xhr.status == 304) {
								console.debug('API Response ['+random_request_id+'] not modified');
								sendResponse({data: {comments: cached_api_responses.comments[request_key].response}});
								return;
							}

							console.debug('API Response ['+random_request_id+']', xhr_response_data);

							// Cache response
							cached_api_responses.comments[request_key] = {
								response: xhr_response_data,
								timestamp: moment().format(),
								lastModified: xhr.getResponseHeader('Last-Modified')
							};

							sendResponse({data: {comments: xhr_response_data, page: message.page}});
						},
						error: function (xhr, text_status, text_error) {
							console.debug('API Response FAILED ['+random_request_id+'] (status: '+text_status+') '+text_error, xhr);
							sendResponse({data: {comments: undefined, page: message.page}});
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
