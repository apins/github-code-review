if (pull_files_url_matches) {
	repository_author_and_name = pull_files_url_matches[1];
	var pull_request_id = pull_files_url_matches[2];
	var pull_request_file_state_stamps = {};

	function refreshPullFilesView() {
		if ( ! is_config_protected) {
			Array.prototype.forEach.call(document.querySelectorAll('.js-file'), function (eachFileBlock) {
				var fileBlock = eachFileBlock;
				var fileHeader = fileBlock.querySelector('.file-header');
				var file_path = fileHeader.querySelector('.file-info a').getAttribute('title');
				var is_approved = isFileApproved(file_path);
				var actionButton;

				// No info from GitHub about this file: probably it was unmodified back
				if ( ! pull_request_file_state_stamps[file_path]) {
					return;
				}

				if (fileHeader.dataset.codeReviewToolApplied) {
					var approveButton = fileHeader.querySelector('.js-approve-file');
					var disapproveButton = fileHeader.querySelector('.js-disapprove-file');

					// Check consistency
					if (
						(approveButton != null && is_approved)
						|| (disapproveButton != null && ! is_approved)
						|| (approveButton == null && disapproveButton == null)
					) {
						Array.prototype.forEach.call(
							fileHeader.querySelectorAll('.js-approve-file, .js-disapprove-file'),
							function (actionButton) { actionButton.remove(); }
						);
					}
					else {
						// All in sync, nothing to do
						return;
					}
				}

				if (is_approved) {
					hideFileContents(fileBlock);
					actionButton = createFileDisapproveButton(fileBlock);
				}
				else {
					showFileContents(fileBlock);
					actionButton = createFileApproveButton(fileBlock);
				}
				fileHeader.querySelector('.file-actions').appendChild(actionButton);
				fileHeader.dataset.codeReviewToolApplied = true;
			});
		}
	}

	function isFileApproved(file_path) {
		if ( ! pull_request_file_state_stamps[file_path]) {
			return false;
		}

		return !! config[repository_author_and_name]
			&& !! config[repository_author_and_name][pull_request_id]
			&& !! config[repository_author_and_name][pull_request_id][file_path]
			&& config[repository_author_and_name][pull_request_id][file_path].hash == pull_request_file_state_stamps[file_path].hash

			// Do not forget to suffer
			&& ! (moment(config[repository_author_and_name][pull_request_id][file_path].last_comment_date) > moment(pull_request_file_state_stamps[file_path].last_comment_date))
			&& ! (moment(config[repository_author_and_name][pull_request_id][file_path].last_comment_date) < moment(pull_request_file_state_stamps[file_path].last_comment_date));
	}

	function hideFileContents(fileBlock) {
		var fileContents = fileBlock.querySelector('.js-file-content');
		fileContents.style.display = 'none';
	}

	function showFileContents(fileBlock) {
		var fileContents = fileBlock.querySelector('.js-file-content');
		fileContents.style.display = '';
	}

	function approveFileRevision(fileBlock, file_path, revision) {
		var fileHeader = fileBlock.querySelector('.file-header');

		protectConfig();
		if ( ! config[repository_author_and_name]) {
			config[repository_author_and_name] = {};
		}
		if ( ! config[repository_author_and_name][pull_request_id]) {
			config[repository_author_and_name][pull_request_id] = {};
		}
		config[repository_author_and_name][pull_request_id][file_path] = revision;
		setPullRequestConfig(repository_author_and_name, pull_request_id, config[repository_author_and_name][pull_request_id]);

		// Switch buttons
		fileHeader.querySelector('.file-actions').replaceChild(
			createFileDisapproveButton(fileBlock),
			fileHeader.querySelector('.js-approve-file')
		);
		hideFileContents(fileBlock);
	}

	function disapproveFileRevision(fileBlock) {
		var fileHeader = fileBlock.querySelector('.file-header');
		var file_path = fileHeader.querySelector('.file-info a').getAttribute('title');

		protectConfig();
		delete config[repository_author_and_name][pull_request_id][file_path];
		setPullRequestConfig(repository_author_and_name, pull_request_id, config[repository_author_and_name][pull_request_id]);

		// Switch buttons
		fileHeader.querySelector('.file-actions').replaceChild(
			createFileApproveButton(fileBlock),
			fileHeader.querySelector('.js-disapprove-file')
		);
		showFileContents(fileBlock);
	}

	function createFileApproveButton(fileBlock) {
		var file_path = fileBlock.querySelector('.file-header .file-info a').getAttribute('title');
		var revision = pull_request_file_state_stamps[file_path];

		var approveButton = document.createElement('a');
		approveButton.className = 'btn btn-sm btn-outline js-approve-file';
		approveButton.rel = 'nofollow';
		approveButton.href = '#';
		approveButton.innerHTML = 'Approve changes';
		$(approveButton).on('click', function (evt) {
			evt.preventDefault();

			// Scroll to the button
			$('html, body').animate({scrollTop: $(fileBlock).offset().top - 53}, 100);

			approveFileRevision(fileBlock, file_path, revision);
		});

		return approveButton;
	}

	function createFileDisapproveButton(fileBlock) {
		var disapproveButton = document.createElement('a');
		disapproveButton.className = 'btn btn-sm btn-danger js-disapprove-file';
		disapproveButton.rel = 'nofollow';
		disapproveButton.href = '#';
		disapproveButton.innerHTML = 'Disapprove changes';
		$(disapproveButton).on('click', function (evt) {
			evt.preventDefault();
			disapproveFileRevision(fileBlock);
		});

		return disapproveButton;
	}

	function decoratePullRequestFiles() {
		getPullRequestConfig(repository_author_and_name, pull_request_id, function (config) {
			refreshPullFilesView();
		});
	}

	function refreshFilesAndComments(callback) {
		var files = undefined;
		var comments = undefined;

		function setPullRequestFileStateStamps() {
			pull_request_file_state_stamps = {};

			files.forEach(function (fileItem) {
				pull_request_file_state_stamps[fileItem.filename] = {
					hash: fileItem.sha,
					last_comment_date: null
				};
			});

			comments.forEach(function (commentItem) {
				if ( ! commentItem.path && ! commentItem.position) {
					// Skip comments that are not related to files
					return;
				}
				
				if ( ! pull_request_file_state_stamps[commentItem.path]) {
					return;
				}

				if (
					pull_request_file_state_stamps[commentItem.path].last_comment_date == null
					|| moment(commentItem.updated_at) > moment(pull_request_file_state_stamps[commentItem.path].last_comment_date)
				) {
					pull_request_file_state_stamps[commentItem.path].last_comment_date = moment(commentItem.updated_at).format();
				}
			});
		}

		getPullRequestFiles(repository_author_and_name, pull_request_id, function (files_list) {
			files = files_list;
			sendMessage(
				'getPullRequestComments',
				{repository: repository_author_and_name, pull_request_id: pull_request_id},
				function (response) {
					comments = response.data.comments;
					setPullRequestFileStateStamps();
					if (typeof callback == 'function') {
						callback();
					}
				}
			);
		});
	}

	function getPullRequestFiles(repository, pull_request_id, callback) {
		getPullRequestChangedFilesCount(repository, pull_request_id, function (pull_request_files_count) {
			var files_list = [];
			var request_failed = false;
			var current_page = 1;

			function getFilesForPage() {
				sendMessage(
					'getPullRequestFiles',
					{repository: repository, pull_request_id: pull_request_id, page: current_page},
					function (response) {
						if (response.data.files) {
							files_list = files_list.concat(response.data.files);
							if (files_list.length < pull_request_files_count) {
								current_page++;
								getFilesForPage(current_page);
							}
							else {
								callback(files_list);
							}
						}
						else {
							request_failed = true;
						}
					}
				);
			}

			getFilesForPage();
		});
	}

	refreshFilesAndComments(function () {
		decoratePullRequestFiles();
	});

	window.setInterval(function () { decoratePullRequestFiles(); }, 100);
	window.setInterval(function () { refreshFilesAndComments(); }, 5000);

	var floatingFileHeaderContainer = $(document.createElement('div'))
		.attr({id: 'floating_file_header_container'})
		.insertBefore(document.getElementById('files'));

	var floatingFileHeader = null;
	var $window = $(window);
	var previous_scrolled_away_file_headers_count = 0;
	document.addEventListener('scroll', function (event) {
		var scrolled_away_file_headers = Array.prototype.filter.call(document.querySelectorAll('.file-header'), function (fileHeader) {
			return $(fileHeader).offset().top - $window.scrollTop() < 60;
		});

		if (previous_scrolled_away_file_headers_count == scrolled_away_file_headers.length) {
			return;// Do not waste CPU if nothing changed
		}
		previous_scrolled_away_file_headers_count = scrolled_away_file_headers.length;

		var lastFileHeader = scrolled_away_file_headers.pop();

		function getFilePathByHeader(fileHeader) {
			return fileHeader.find('.file-info a').attr('title');
		}

		if ( !! lastFileHeader) {
			if (floatingFileHeader == null || getFilePathByHeader(floatingFileHeader) != getFilePathByHeader($(lastFileHeader))) {
				if (floatingFileHeader != null) {
					floatingFileHeader.remove();
				}
				floatingFileHeader = $(lastFileHeader).clone(true);
				floatingFileHeader.addClass('form-control focus');
				floatingFileHeader.css({position: 'fixed', top: '60px', zIndex: 1000000, width: $('#files').css('width')});

				floatingFileHeaderContainer.empty().prepend(floatingFileHeader);
			}
		}
		else {
			if (floatingFileHeader != null) {
				floatingFileHeader.remove();
				floatingFileHeader = null;
			}
		}

	}, false);
}
