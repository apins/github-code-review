var pull_files_url_matches = window.location.pathname.match(/^\/(.*\/.*)\/pull\/(\d+)\/files/i);
var pulls_url_matches = window.location.pathname.match(/^\/(.*)\/(.*)\/pulls/i);

// chrome.tabs.executeScript(null, {file: "lib/sha256.js"});

if (chrome && chrome.runtime) {
	var repository_author_and_name;
	var pull_request_id;
	var config = {};
	var is_config_protected = false;

	/**
	 * TAB: Pull requests
	 */
	if (pulls_url_matches) {
		var repository_author = pulls_url_matches[1];
		var repository_name = pulls_url_matches[2];
		repository_author_and_name = repository_author+'/'+repository_name;

		function refreshPullRequestsView(response) {
			if ( ! is_config_protected) {
				config = response.data;

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

					var approved_files_count = !! config[block_pull_request_id]
						? Object.keys(config[block_pull_request_id]).length
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
			counter.innerHTML = ', ...';
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
			chrome.runtime.sendMessage({command: 'getChangedFilesCount', repository: repository_author_and_name, pull_request_id: pull_request_id}, function (response) {
				if (response && !! response.data) {
					callback(response.data.changed_files_count);
				}
			});
		}

		function decoratePullRequests() {
			chrome.runtime.sendMessage({command: 'getApiToken'}, function (response) {
				if ( !! response.data && !! response.data.access_token) {
					getConfig(refreshPullRequestsView);
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
		pull_request_id = pull_files_url_matches[2];

		function refreshPullFilesView(response) {
			if ( ! is_config_protected) {
				config = response.data;

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

			return fileHeader.dataset.path && !! config[fileHeader.dataset.path] && (config[fileHeader.dataset.path] == version_hash);
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
			config[fileHeader.dataset.path] = version_hash;
			pushConfigChanges();

			// Switch buttons
			fileHeader.querySelector('.file-actions').replaceChild(disapproveButton, approveButton);
			hideFileContents(fileBlock);
		}

		function disapproveFileRevision(fileBlock) {
			var fileHeader = fileBlock.querySelector('.file-header');
			var approveButton = createFileApproveButton(fileBlock);
			var disapproveButton = fileHeader.querySelector('.js-disapprove-file');

			protectConfig();
			delete config[fileHeader.dataset.path];
			pushConfigChanges();

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

		window.setInterval(function () { getConfig(refreshPullFilesView); }, 500);
		getConfig(refreshPullFilesView);
	}


	/**
	 * COMMON FUNCTIONS
	 */
	function getConfig(callback) {
		if ( ! is_config_protected) {
			chrome.runtime.sendMessage(
				{command: 'getConfig', repository: repository_author_and_name, pull_request_id: pull_request_id},
				function (response) {
					callback(response);
				}
			);
		}
	}

	function protectConfig() {
		is_config_protected = true;
	}

	function pushConfigChanges() {
		chrome.runtime.sendMessage({command: 'setConfig', repository: repository_author_and_name, pull_request_id: pull_request_id, config: config}, function (response) {
			is_config_protected = false;
		});
	}
}
