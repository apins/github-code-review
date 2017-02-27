var extension_name = chrome.runtime.getManifest().name;
var extension_version = chrome.runtime.getManifest().version;

var pull_files_url_matches = window.location.pathname.match(/^\/(.*\/.*)\/pull\/(\d+)\/files/i);
var pulls_url_matches = window.location.pathname.match(/^\/(.*)\/(.*)\/pulls/i);

var repository_author_and_name;
var config = {};
var is_config_protected = false;

function getPullRequestConfig(repository, pull_request_id, callback) {
	if ( ! is_config_protected) {
		sendMessage(
			'getPullRequestConfig',
			{repository: repository, pull_request_id: pull_request_id},
			function (response) {
				if ( ! config[repository]) {
					config[repository] = {};
				}
				if ( ! config[repository][pull_request_id]) {
					config[repository][pull_request_id] = {};
				}
				config[repository][pull_request_id] = response.data.config;

				callback(response);
			}
		);
	}
}

function getRepositoryConfig(repository, callback) {
	if ( ! is_config_protected) {
		sendMessage(
			'getRepositoryConfig',
			{repository: repository},
			function (response) {
				callback(response);
			}
		);
	}
}

function protectConfig() {
	is_config_protected = true;
}

function setPullRequestConfig(repository, pull_request_id, config) {
	sendMessage('setPullRequestConfig',
		{repository: repository, pull_request_id: pull_request_id, config: config},
		function (response) {
			is_config_protected = false;
		}
	);
}

// Fallback for situation when extension was reloaded (updated, deleted, etc)
var reload_confirmation_asked = false;
function sendMessage(command, data, closure) {
	data.command = command;

	window.setTimeout(function () {
		try {
			chrome.runtime.sendMessage(data, closure);
		}
		catch ($e) {
			if ( ! reload_confirmation_asked) {
				reload_confirmation_asked = true;
				cleanUpExtensionDOMElements();
				if (confirm('Extension "'+extension_name+' v'+extension_version+'" was unloaded.\nTo proceed using it you need to refresh the page.\n\nRefresh now?')) {
					document.location.href = document.location.href;
				}
			}
		}
	}, 0);
}

function cleanUpExtensionDOMElements() {
	if (pulls_url_matches) {
		/**
		 * TAB: Pull requests
		 */
		Array.prototype.forEach.call(document.querySelectorAll('.js-changed-files-counter'), function (changedFilesCounter) {
			changedFilesCounter.remove();
		});
		Array.prototype.forEach.call(document.querySelectorAll('.issues-listing .js-issue-row'), function (pullRequestBlock) {
			unmarkPullRequestReady(pullRequestBlock);
		});
	}

	if (pull_files_url_matches) {
		/**
		 * TAB: Files
		 */
		Array.prototype.forEach.call(document.querySelectorAll('.js-approve-file, .js-disapprove-file'), function (item) {
			item.remove();
		});
		Array.prototype.forEach.call(document.querySelectorAll('.js-file'), function (fileBlock) {
			showFileContents(fileBlock);
		});
	}
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
	switch (message.command) {
		case 'ping':
			sendResponse({data: {message: 'pong'}});
			break;

		default:
	}
});
