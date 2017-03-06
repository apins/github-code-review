$(document).ready(function () {
	document.querySelector('.js-apply-config').addEventListener('click', function () {
		var value = document.querySelector('#config_container').value;
		var config = value.length > 0 ? JSON.parse(value) : {};

		if (confirm('This action can not be undone. Save?')) {
			chrome.runtime.sendMessage({command: 'setFullConfig', config: config});
			refreshTextarea(config);
			refreshJsonConfigView(config);
			refreshStateInfo(config);
		}
	}, false);

	document.querySelector('.js-integration-save').addEventListener('click', function () {
		chrome.runtime.sendMessage({command: 'setGitHubAccessToken', data: document.querySelector('#github_api_token').value});
	}, false);

	$(document).on('click', '.js-forget-repository', function (evt) {
		evt.preventDefault();
		var repository = $(this).data('repository');

		if (window.confirm('You requested to forgetting repository `'+repository+'`. Proceed?')) {
			chrome.runtime.sendMessage({command: 'getFullConfig'}, function (response) {
				var config = response.data.config;

				delete config[repository];
				chrome.runtime.sendMessage({command: 'setFullConfig', config: config}, function (response) {
					refreshTextarea(config);
					refreshJsonConfigView(config);
					refreshStateInfo(config);
				});
			});
		}
	});

	$(document).on('click', '.js-forget-pull-request', function (evt) {
		evt.preventDefault();
		var repository = $(this).data('repository');
		var pull_request_id = $(this).data('pull-request-id');

		if (window.confirm('Use requested to forget `'+repository+'/'+pull_request_id+'`. Proceed?')) {
			chrome.runtime.sendMessage({command: 'getFullConfig'}, function (response) {
				var config = response.data.config;

				if (config[repository]) {
					delete config[repository][pull_request_id];

					if (Object.keys(config[repository]).length == 0) {
						delete config[repository];
					}
				}

				chrome.runtime.sendMessage({command: 'setFullConfig', config: config}, function (response) {
					refreshTextarea(config);
					refreshJsonConfigView(config);
					refreshStateInfo(config);
				});
			});
		}
	});

	document.querySelector('.js-cleanup-garbage').addEventListener('click', function () {
		var token = document.querySelector('#github_api_token').value;
		lockTextarea();

		chrome.runtime.sendMessage({command: 'getFullConfig'}, function (response) {
			var config = response.data.config;
			var requests_counter = 0;

			// Display progress bar
			var progressbar = $('#merged_pr_data_cleanup_progressbar');
			var progressbar_container = progressbar.closest('.form-group');


			progressbar_container.show();
			progressbar.css({width: 0});
			var progress_bar_step = Math.floor(100/Object.keys(config).length);
			var current_step_percentage = 0;

			window.setTimeout(function () {
				Object.keys(config).forEach(function (each_repository) {
					Object.keys(config[each_repository]).forEach(function (each_pull_request_id) {
						var repository = each_repository;
						var pull_request_id = each_pull_request_id;

						requests_counter++;

						setTimeout(function () {
							chrome.runtime.sendMessage(
								{command: 'getPullRequestState', repository: repository, pull_request_id: pull_request_id, access_token: token},
								function (response) {
									current_step_percentage += progress_bar_step;
									requests_counter--;

									if (response.data.state && response.data.state != 'open') {
										delete config[repository][pull_request_id];

										if (Object.keys(config[repository]).length == 0) {
											delete config[repository];
										}
									}

									progressbar.css({width: current_step_percentage+'%'});

									if (requests_counter == 0) {
										// Mark completed and hide progressbar
										progressbar.css({width: '100%'});
										progressbar_container.fadeOut(1000, function () {
											progressbar.css({width: 0});
										});

										chrome.runtime.sendMessage({command: 'setFullConfig', config: config}, function (response) {
											refreshTextarea(config);
											refreshJsonConfigView(config);
											refreshStateInfo(config);

											unlockTextarea();
										});
									}
								}
							);
						}, 0);
					});
				});

				if (requests_counter == 0) {
					// Mark completed and hide progressbar
					progressbar.css({width: '100%'});
					progressbar_container.fadeOut(1000, function () {
						progressbar.css({width: 0});
					});

					unlockTextarea();
				}
				
			}, 100);
		});
	}, false);

	chrome.runtime.sendMessage({command: 'getFullConfig'}, function(response) {
		refreshTextarea(response.data.config);
		refreshJsonConfigView(response.data.config);
		refreshStateInfo(response.data.config);
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

	function refreshJsonConfigView(config) {
		var container = $('#json_config_container');
		container.empty();

		Object.keys(config).forEach(function (each_repository_name, repository_index) {
			var repository_pull_requests_container = $(document.createElement('div'))
				.addClass('pull_requests_container')
				.css({paddingLeft: '20px'});

			Object.keys(config[each_repository_name]).forEach(function (each_pull_request_id) {
				var files_container = $(document.createElement('div'))
					.addClass('pull_request_files_container')
					.css({paddingLeft: '20px'})
					.hide();

				Object.keys(config[each_repository_name][each_pull_request_id]).forEach(function (each_filename, filename_key) {
					files_container.append(
						$(document.createElement('div'))
							.attr({title: each_filename})
							.css({overflow: 'hidden', whiteSpace: 'nowrap'})
							.append(
								$(document.createElement('span')).addClass('text-muted').html((+filename_key+1)+'.'),
								document.createTextNode(' '),
								each_filename
							)
					);
				});

				repository_pull_requests_container.append(
					$(document.createElement('div'))
						.append(
							$(document.createElement('a')).attr({href: '#', title: 'Collapse/Expand list'})
								.addClass('css-collapse-expand-list collapsed')
								.on('click', function (evt) {
									evt.preventDefault();
									files_container.toggle();
									$(this).toggleClass('collapsed');
								})
								.append(
									$(document.createElement('span')).addClass('glyphicon glyphicon-collapse-down'),
									$(document.createElement('span')).addClass('glyphicon glyphicon-expand')
								),
							document.createTextNode(' '),
							$(document.createElement('span')).html('#'+each_pull_request_id),
							document.createTextNode(', '+Object.keys(config[each_repository_name][each_pull_request_id]).length+' files'),
							document.createTextNode(' '),
							$(document.createElement('a')).html('Forget pull request')
								.attr({href: '#'})
								.addClass('label label-danger js-forget-pull-request')
								.data({repository: each_repository_name})
								.data({pullRequestId: each_pull_request_id})
						),
						files_container
					);
			});

			container.append(
				repository_index == 0 ? null : document.createElement('br'),
				$(document.createElement('div')).append(
					$(document.createElement('a')).attr({href: '#', title: 'Collapse/Expand list'})
						.addClass('css-collapse-expand-list')
						.on('click', function (evt) {
							evt.preventDefault();
							repository_pull_requests_container.toggle();
							$(this).toggleClass('collapsed');
						})
						.append(
							$(document.createElement('span')).addClass('glyphicon glyphicon-collapse-down'),
							$(document.createElement('span')).addClass('glyphicon glyphicon-expand')
						),
					document.createTextNode(' '),
					$(document.createElement('strong')).html(each_repository_name),
					document.createTextNode(', '+Object.keys(config[each_repository_name]).length+' pull requests'),
					document.createTextNode(' '),
					$(document.createElement('a')).html('Forget repository')
						.attr({href: '#'})
						.addClass('label label-danger js-forget-repository')
						.data({repository: each_repository_name})
				),
				repository_pull_requests_container
			);
		});
	}

	function refreshStateInfo(config) {
		var repositories_count = Object.keys(config).length;
		var pull_requests_count = 0;

		Object.keys(config).forEach(function (each_repository) {
			pull_requests_count += Object.keys(config[each_repository]).length;
		});
		
		document.querySelector('#state_info_human_readable').innerHTML = '('+repositories_count+' repositories observed, '+pull_requests_count+' pull requests)';
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
