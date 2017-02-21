var url_matches = window.location.pathname.match(/^\/(.*\/.*)\/.*\/(\d+)\/files/i);

if (chrome && chrome.runtime && url_matches) {
	var initialized = false;
	var is_config_protected = false;
	var config = {};

	var repository_name = url_matches[1];
	var pull_request_id = url_matches[2];

	var fileBlocks;

	function getConfig() {
		if ( ! is_config_protected) {
			chrome.runtime.sendMessage(
				{command: 'getConfig', repository: repository_name, pull_request_id: pull_request_id},
				function(response) {
					if ( ! is_config_protected) {
						config = response.data;
						initialized = true;

						refreshView();
					}
				}
			);
		}
	}

	function protectConfig() {
		is_config_protected = true;
	}

	function pushConfigChanges() {
		chrome.runtime.sendMessage({command: 'setConfig', repository: repository_name, pull_request_id: pull_request_id, config: config}, function (response) {
			is_config_protected = false;
		});
	}

	function isApproved(fileBlock) {
		var fileHeader = fileBlock.querySelector('.file-header');
		return fileHeader.dataset.path && !! config[fileHeader.dataset.path] && (config[fileHeader.dataset.path] == fileHeader.dataset.shortPath);
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
		var disapproveButton = createDisapproveButton(fileBlock);
		var approveButton = fileHeader.querySelector('.js-approve-file');

		protectConfig();
		config[fileHeader.dataset.path] = fileHeader.dataset.shortPath;
		pushConfigChanges();

		// Switch buttons
		fileHeader.querySelector('.file-actions').replaceChild(disapproveButton, approveButton);
		hideFileContents(fileBlock);
	}

	function disapproveFileRevision(fileBlock) {
		var fileHeader = fileBlock.querySelector('.file-header');
		var approveButton = createApproveButton(fileBlock);
		var disapproveButton = fileHeader.querySelector('.js-disapprove-file');

		protectConfig();
		delete config[fileHeader.dataset.path];
		pushConfigChanges();

		// Switch buttons
		fileHeader.querySelector('.file-actions').replaceChild(approveButton, disapproveButton);
		showFileContents(fileBlock);
	}

	function createApproveButton(fileBlock) {
		var fileHeader = fileBlock.querySelector('.file-header');
		var approveButton = document.createElement('a');

		approveButton.className = 'btn btn-sm btn-outline js-approve-file';
		approveButton.rel = 'nofollow';
		approveButton.href = '#';
		approveButton.innerHTML = 'Approve changes';

		approveButton.addEventListener('click', function (evt) {
			evt.preventDefault();
			approveFileRevision(fileBlock, fileHeader.dataset.path, fileHeader.dataset.shortPath);
		}, false);

		return approveButton;
	}

	function createDisapproveButton(fileBlock) {
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

	function refreshView() {
		if ( ! initialized) {
			return false;
		}

		fileBlocks = document.querySelectorAll('.js-file');
		Array.prototype.forEach.call(fileBlocks, function (eachFileBlock) {
			var fileBlock = eachFileBlock;
			var fileHeader = fileBlock.querySelector('.file-header');
			var is_approved = isApproved(fileBlock);

			if (fileHeader.dataset.codeReviewToolApplied && initialized) {
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

			var viewButton = fileHeader.querySelector('.file-actions').querySelector('.btn');
			var actionButton = is_approved
				? createDisapproveButton(fileBlock)
				: createApproveButton(fileBlock);

			fileHeader.querySelector('.file-actions').insertBefore(actionButton, viewButton);
			fileHeader.dataset.codeReviewToolApplied = true;

			if (is_approved) {
				hideFileContents(fileBlock);
			}
			else {
				showFileContents(fileBlock);
			}
		});
	}

	window.setInterval(function () {
		getConfig();
	}, 500);
}
