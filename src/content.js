var extension_name = chrome.runtime.getManifest().name;
var extension_version = chrome.runtime.getManifest().version;

var pull_files_url_matches = window.location.pathname.match(/^\/(.*\/.*)\/pull\/(\d+)\/files/i);
var pulls_url_matches = window.location.pathname.match(/^\/(.*)\/(.*)\/pulls/i);

var repository_author_and_name;
var config = {};
var is_config_protected = false;

/**
 * TAB: Pull requests
 */
if (pulls_url_matches) {
	var repository_author = pulls_url_matches[1];
	var repository_name = pulls_url_matches[2];
	repository_author_and_name = repository_author+'/'+repository_name;

	function refreshPullRequestsView(repository, repository_config) {
		if ( ! is_config_protected) {
			config[repository] = repository_config;

			Array.prototype.forEach.call(document.querySelectorAll('.issues-listing .js-issue-row'), function (eachPullRequestBlock) {
				var pullRequestBlock = eachPullRequestBlock;
				var pullRequestHeader = pullRequestBlock.querySelector('.opened-by');
				var changed_files_count = pullRequestHeader.dataset.changed_files_count;
				var block_pull_request_id;

				var pull_request_matches = pullRequestBlock.id.match(/issue_(\d+)/i);
				if (pull_request_matches) {
					block_pull_request_id = pull_request_matches[1];
				}
				else {
					return;// Must be impossible situation
				}

				var approved_files_count = !! config[repository][block_pull_request_id]
					? Object.keys(config[repository][block_pull_request_id]).length
					: 0;

				if (changed_files_count == null && ! pullRequestHeader.dataset.changed_files_count_requested) {
					pullRequestHeader.dataset.changed_files_count_requested = true;

					window.setTimeout(function () {
						getPullRequestChangedFilesCount(block_pull_request_id, function (count) {
							pullRequestHeader.dataset.changed_files_count = count;
							updatePullRequestCounter(pullRequestBlock, approved_files_count, count);
						});
					}, 0);

					createChangedFilesCounter(pullRequestHeader);
				}
				else if (changed_files_count != null) {
					updatePullRequestCounter(pullRequestBlock, approved_files_count, changed_files_count);
				}
			});
		}
	}

	function updatePullRequestCounter(pullRequestBlock, approved_files_count, changed_files_count) {
		var pullRequestHeader = pullRequestBlock.querySelector('.opened-by');
		var counterElement = pullRequestHeader.querySelector('.js-changed-files-counter');

		if (approved_files_count == changed_files_count) {
			markPullRequestReady(pullRequestBlock);
			counterElement.innerHTML = ', all <strong>'+changed_files_count+'</strong> files passed review';
		}
		else {
			unmarkPullRequestReady(pullRequestBlock);
			if (counterElement.innerHTML != ', <strong>'+approved_files_count+'</strong> of '+changed_files_count+' files passed review') {
				counterElement.innerHTML = ', <strong>'+approved_files_count+'</strong> of '+changed_files_count+' files passed review';
			}
		}
	}

	function markPullRequestReady(pullRequestBlock) {
		pullRequestBlock.style.backgroundColor = '#dbffc2';
		pullRequestBlock.style.borderColor = '#bee2a6';
	}

	function unmarkPullRequestReady(pullRequestBlock) {
		pullRequestBlock.style.backgroundColor = '';
		pullRequestBlock.style.borderColor = '';
	}

	function createChangedFilesCounter(pullRequestHeader) {
		var counter = document.createElement('span');
		counter.innerHTML = '';
		counter.className = 'js-changed-files-counter';
		counter.style.fontWeight = 'normal';
		counter.style.fontSize = '10pt';
		counter.style.position = 'relative';
		counter.style.left = '-5px';
		counter.style.color = '#767676';
		counter.style.whiteSpace = 'nowrap';
		pullRequestHeader.appendChild(counter);
	}

	function getPullRequestChangedFilesCount(pull_request_id, callback) {
		sendMessage('getChangedFilesCount', {repository: repository_author_and_name, pull_request_id: pull_request_id}, function (response) {
			if (response && !! response.data) {
				callback(response.data.changed_files_count);
			}
		});
	}

	function decoratePullRequests() {
		sendMessage('getApiToken', {}, function (response) {
			if ( !! response.data && !! response.data.access_token) {
				getRepositoryConfig(repository_author_and_name, function (response) {
					refreshPullRequestsView(repository_author_and_name, response.data.config);
				});
			}
		});
	}

	window.setInterval(function () { decoratePullRequests(); }, 500);
	decoratePullRequests();
}

/**
 * TAB: Files
 */
if (pull_files_url_matches) {
	repository_author_and_name = pull_files_url_matches[1];
	var pull_request_id = pull_files_url_matches[2];

	function refreshPullFilesView() {
		if ( ! is_config_protected) {
			Array.prototype.forEach.call(document.querySelectorAll('.js-file'), function (eachFileBlock) {
				var fileBlock = eachFileBlock;
				var fileHeader = fileBlock.querySelector('.file-header');
				var is_approved = isFileApproved(fileBlock);

				if (fileHeader.dataset.codeReviewToolApplied) {
					var approveButton = fileHeader.querySelector('.js-approve-file');

					if (
						(approveButton == null && ! is_approved)
						|| (approveButton != null && is_approved)
					) {
						var button = fileHeader.querySelector('.js-approve-file, .js-disapprove-file');
						if ( !! button) {
							button.remove();
						}
					}
					else {
						// All in sync, nothing to do
						return;
					}
				}

				var actionButton = is_approved
					? createFileDisapproveButton(fileBlock)
					: createFileApproveButton(fileBlock);

				fileHeader.querySelector('.file-actions').appendChild(actionButton);
				fileHeader.dataset.codeReviewToolApplied = true;

				if (is_approved) {
					hideFileContents(fileBlock);
				}
				else {
					showFileContents(fileBlock);
				}
			});
		}
	}

	function isFileApproved(fileBlock) {
		var fileHeader = fileBlock.querySelector('.file-header');
		var version_hash;

		if ( ! fileHeader.dataset.versionHash) {
			var fileContents = fileBlock.querySelector('.js-file-content');
			version_hash = Sha256.hash(fileContents.innerText);
			fileHeader.dataset.versionHash = version_hash;
		}
		else {
			version_hash = fileHeader.dataset.versionHash;
		}

		return fileHeader.dataset.path
			&& !! config[repository_author_and_name]
			&& !! config[repository_author_and_name][pull_request_id]
			&& !! config[repository_author_and_name][pull_request_id][fileHeader.dataset.path]
			&& config[repository_author_and_name][pull_request_id][fileHeader.dataset.path] == version_hash;
	}

	function hideFileContents(fileBlock) {
		var fileContents = fileBlock.querySelector('.js-file-content');
		fileContents.style.display = 'none';
	}

	function showFileContents(fileBlock) {
		var fileContents = fileBlock.querySelector('.js-file-content');
		fileContents.style.display = '';
	}

	function approveFileRevision(fileBlock) {
		var fileHeader = fileBlock.querySelector('.file-header');
		var disapproveButton = createFileDisapproveButton(fileBlock);
		var approveButton = fileHeader.querySelector('.js-approve-file');
		var version_hash;

		if ( ! fileHeader.dataset.versionHash) {
			var fileContents = fileBlock.querySelector('.js-file-content');
			version_hash = Sha256.hash(fileContents.innerText);
			fileHeader.dataset.versionHash = version_hash;
		}
		else {
			version_hash = fileHeader.dataset.versionHash;
		}

		protectConfig();
		if ( ! config[repository_author_and_name]) {
			config[repository_author_and_name] = {};
		}
		if ( ! config[repository_author_and_name][pull_request_id]) {
			config[repository_author_and_name][pull_request_id] = {};
		}
		config[repository_author_and_name][pull_request_id][fileHeader.dataset.path] = version_hash;
		setPullRequestConfig(repository_author_and_name, pull_request_id, config[repository_author_and_name][pull_request_id]);

		// Switch buttons
		fileHeader.querySelector('.file-actions').replaceChild(disapproveButton, approveButton);
		hideFileContents(fileBlock);
	}

	function disapproveFileRevision(fileBlock) {
		var fileHeader = fileBlock.querySelector('.file-header');
		var approveButton = createFileApproveButton(fileBlock);
		var disapproveButton = fileHeader.querySelector('.js-disapprove-file');

		protectConfig();
		delete config[repository_author_and_name][pull_request_id][fileHeader.dataset.path];
		setPullRequestConfig(repository_author_and_name, pull_request_id, config[repository_author_and_name][pull_request_id]);

		// Switch buttons
		fileHeader.querySelector('.file-actions').replaceChild(approveButton, disapproveButton);
		showFileContents(fileBlock);
	}

	function createFileApproveButton(fileBlock) {
		var fileHeader = fileBlock.querySelector('.file-header');
		var approveButton = document.createElement('a');
		var version_hash;

		if ( ! fileHeader.dataset.versionHash) {
			var fileContents = fileBlock.querySelector('.js-file-content');
			version_hash = Sha256.hash(fileContents.innerText);
			fileHeader.dataset.versionHash = version_hash;
		}
		else {
			version_hash = fileHeader.dataset.versionHash;
		}

		approveButton.className = 'btn btn-sm btn-outline js-approve-file';
		approveButton.rel = 'nofollow';
		approveButton.href = '#';
		approveButton.innerHTML = 'Approve changes';

		approveButton.addEventListener('click', function (evt) {
			evt.preventDefault();
			approveFileRevision(fileBlock, fileHeader.dataset.path, version_hash);
		}, false);

		return approveButton;
	}

	function createFileDisapproveButton(fileBlock) {
		var disapproveButton = document.createElement('a');

		disapproveButton.className = 'btn btn-sm btn-danger js-disapprove-file';
		disapproveButton.rel = 'nofollow';
		disapproveButton.href = '#';
		disapproveButton.innerHTML = 'Disapprove changes';

		disapproveButton.addEventListener('click', function (evt) {
			evt.preventDefault();
			disapproveFileRevision(fileBlock);
		}, false);

		return disapproveButton;
	}

	window.setInterval(function () { getPullRequestConfig(repository_author_and_name, pull_request_id, refreshPullFilesView); }, 500);
	getPullRequestConfig(repository_author_and_name, pull_request_id, refreshPullFilesView);
}



/**
 * COMMON FUNCTIONS
 */
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

	try {
		chrome.runtime.sendMessage(data, closure);
	}
	catch ($e) {
		if (reload_confirmation_asked) {
			return;
		}
		reload_confirmation_asked = true;
		cleanUpExtensionDOMElements();
		if (confirm('Extension "'+extension_name+' v'+extension_version+'" was unloaded.\nTo proceed using it you need to refresh the page.\n\nRefresh now?')) {
			document.location.href = document.location.href;
		}
	}
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
