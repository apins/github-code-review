const extension_version = chrome.runtime.getManifest().version;

$(document).ready(function () {
    var pull_requests_names = {};

    $('#plugin-version').text(extension_version);

    document.querySelector('.js-apply-config').addEventListener('click', function () {
        var value = document.querySelector('#config_container').value;
        var config = value.length > 0 ? JSON.parse(value) : {};

        if (confirm('This action can not be undone. Save?')) {
            chrome.runtime.sendMessage({command: 'setFullConfig', config: config});
            refreshView(config);
        }
    }, false);

    document.querySelector('.js-integration-save').addEventListener('click', function () {
        chrome.runtime.sendMessage({command: 'setGitHubAccessToken', data: document.querySelector('#github_api_token').value});
    }, false);

    $(document).on('click', '.js-forget-repository', function (evt) {
        evt.preventDefault();
        var repository = $(this).data('repository');

        if (window.confirm('You requested to forgetting repository `' + repository + '`. Proceed?')) {
            chrome.runtime.sendMessage({command: 'getFullConfig'}, function (response) {
                var config = response.data.config;

                delete config[repository];
                chrome.runtime.sendMessage({command: 'setFullConfig', config: config}, function (response) {
                    refreshView(config);
                });
            });
        }
    });

    $(document).on('click', '.js-forget-pull-request', function (evt) {
        evt.preventDefault();
        var repository = $(this).data('repository');
        var pull_request_id = $(this).data('pull-request-id');

        if (window.confirm('Use requested to forget `' + repository + '/' + pull_request_id + '`. Proceed?')) {
            chrome.runtime.sendMessage({command: 'getFullConfig'}, function (response) {
                var config = response.data.config;

                if (config[repository]) {
                    delete config[repository][pull_request_id];

                    if (Object.keys(config[repository]).length === 0) {
                        delete config[repository];
                    }
                }

                chrome.runtime.sendMessage({command: 'setFullConfig', config: config}, function (response) {
                    refreshView(config);
                });
            });
        }
    });

    $(document).on('click', '.js-copy-repository-to-clipboard', function (evt) {
        evt.preventDefault();
        var repository = $(this).data('repository');
        var _this = this;

        chrome.runtime.sendMessage({command: 'getFullConfig'}, function (response) {
            var config = response.data.config;
            var repository_config = {};

            repository_config[repository] = config[repository];

            chrome.runtime.sendMessage({command: 'copyToClipboard', text: JSON.stringify(repository_config)}, function (response) {
                blink($(_this).closest('tr'));
            });
        });
    });

    $(document).on('click', '.js-copy-pull-request-to-clipboard', function (evt) {
        evt.preventDefault();
        var repository = $(this).data('repository');
        var pull_request_id = $(this).data('pull-request-id');
        var _this = this;

        chrome.runtime.sendMessage({command: 'getFullConfig'}, function (response) {
            var config = response.data.config;
            var repository_config = {};

            repository_config[repository] = {};
            repository_config[repository][pull_request_id] = config[repository][pull_request_id];

            chrome.runtime.sendMessage({command: 'copyToClipboard', text: JSON.stringify(repository_config)}, function (response) {
                blink($(_this).closest('tr'));
            });
        });
    });

    function refreshView(config) {
        refreshTextarea(config);
        refreshTableConfigView(config);
        refreshStateInfo(config);
    }

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
            var progress_bar_step = Math.floor(100 / Object.keys(config).length);
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

                                    if (response.data.state && response.data.state !== 'open') {
                                        delete config[repository][pull_request_id];

                                        if (Object.keys(config[repository]).length === 0) {
                                            delete config[repository];
                                        }
                                    }

                                    progressbar.css({width: current_step_percentage + '%'});

                                    if (requests_counter === 0) {
                                        // Mark completed and hide progressbar
                                        progressbar.css({width: '100%'});
                                        progressbar_container.fadeOut(1000, function () {
                                            progressbar.css({width: 0});
                                        });

                                        chrome.runtime.sendMessage({command: 'setFullConfig', config: config}, function (response) {
                                            refreshView(config);
                                            unlockTextarea();
                                        });
                                    }
                                }
                            );
                        }, 0);
                    });
                });

                if (requests_counter === 0) {
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

    chrome.runtime.sendMessage({command: 'getFullConfig'}, function (response) {
        refreshView(response.data.config);
    });

    chrome.runtime.sendMessage(
        {command: 'getGitHubAccessToken'},
        function (response) {
            document.querySelector('#github_api_token').value = response.data.access_token;
        }
    );

    function refreshTextarea(config) {
        if (
            document.querySelector('#config_container').value !== JSON.stringify(config)
            && document.querySelector('#config_container') !== document.activeElement
        ) {
            document.querySelector('#config_container').value = JSON.stringify(config);
        }
    }

    function updatePullRequestsTitles() {
        $('.js-pull-request-name-container').each(function () {
            var repository = $(this).data('repository');
            var pull_request_id = $(this).data('pull-request-id');

            if (pull_requests_names[repository + '/' + pull_request_id]) {
                $(this)
                    .html(pull_requests_names[repository + '/' + pull_request_id])
                    .val(pull_requests_names[repository + '/' + pull_request_id]);
            }
        });
    }

    function refreshTableConfigView(config) {
        var container = $('#table_config_container').find('tbody').empty();

        Object.keys(config).forEach(function (each_repository) {
            // Add repository header
            container.append(
                $(document.createElement('tr')).append(
                    $(document.createElement('th')).html(
                        $(document.createElement('a')).attr({href: 'https://github.com/' + each_repository + '/pulls', target: '_blank'})
                            .html(each_repository)
                    ),
                    $(document.createElement('th')).append(
                        // Copy to clipboard
                        $(document.createElement('a')).attr({href: '#', title: 'Copy repository config to clipboard'})
                            .append(
                                $(document.createElement('i')).addClass('glyphicon glyphicon-duplicate')
                            )
                            .addClass('js-copy-repository-to-clipboard')
                            .data({repository: each_repository}),

                        document.createTextNode(' '),

                        // Clear
                        $(document.createElement('a')).attr({href: '#', title: 'Forget repository'})
                            .append(
                                $(document.createElement('strong')).addClass('glyphicon glyphicon-trash')
                            )
                            .addClass('js-forget-repository text-danger')
                            .data({repository: each_repository})
                    )
                )
            );

            // List all the pull requests
            Object.keys(config[each_repository]).forEach(function (each_pull_request_id) {
                container.append(
                    $(document.createElement('tr')).append(
                        $(document.createElement('td')).append(
                            $(document.createElement('a')).attr({
                                href: 'https://github.com/' + each_repository + '/pull/' + each_pull_request_id,
                                target: '_blank'
                            })
                                .append(
                                    $(document.createElement('span')).html('# ' + each_pull_request_id),
                                    document.createTextNode(' '),
                                    $(document.createElement('span')).addClass('js-pull-request-name-container')
                                        .attr({
                                            'data-repository': each_repository,
                                            'data-pull-request-id': each_pull_request_id
                                        })
                                        .html(pull_requests_names[each_repository + '/' + each_pull_request_id])
                                )
                        ),
                        $(document.createElement('td')).append(
                            // Copy to clipboard
                            $(document.createElement('a')).attr({href: '#', title: 'Copy pull request config to clipboard'})
                                .append(
                                    $(document.createElement('i')).addClass('glyphicon glyphicon-duplicate')
                                )
                                .addClass('js-copy-pull-request-to-clipboard')
                                .data({repository: each_repository})
                                .data({pullRequestId: each_pull_request_id}),

                            document.createTextNode(' '),

                            // Clear
                            $(document.createElement('a')).attr({href: '#', title: 'Forget pull request'})
                                .append(
                                    $(document.createElement('i')).addClass('glyphicon glyphicon-trash')
                                )
                                .addClass('js-forget-pull-request text-danger')
                                .data({repository: each_repository})
                                .data({pullRequestId: each_pull_request_id})
                        )
                    )
                );
            });
        });
    }

    function refreshStateInfo(config) {
        var repositories_count = Object.keys(config).length;
        var pull_requests_count = 0;

        Object.keys(config).forEach(function (each_repository) {
            pull_requests_count += Object.keys(config[each_repository]).length;
        });

        document.querySelector('#state_info_human_readable').innerHTML = '(' + repositories_count + ' repositories observed, ' + pull_requests_count + ' pull requests)';
    }

    function lockTextarea() {
        document.querySelector('#config_container').setAttribute('disabled', 'disabled');
        document.querySelector('#config_container').setAttribute('readonly', 'readonly');
    }

    function unlockTextarea() {
        document.querySelector('#config_container').removeAttribute('disabled');
        document.querySelector('#config_container').removeAttribute('readonly');
    }

    function blink(element) {
        $(element).fadeIn(300).fadeOut(300).fadeIn(300).fadeOut(300).fadeIn(300);
    }

    window.setInterval(function () {
        chrome.runtime.sendMessage({command: 'getFullConfig'}, function (response) {
            Object.keys(response.data.config).forEach(function (each_repository) {
                Object.keys(response.data.config[each_repository]).forEach(function (each_pull_request_id) {
                    var repository = each_repository;
                    var pull_request_id = each_pull_request_id;

                    if (pull_requests_names[repository + '/' + pull_request_id]) {
                        updatePullRequestsTitles();
                        return;
                    }

                    window.setTimeout(function () {
                        chrome.runtime.sendMessage({
                            command: 'getPullRequestTitle',
                            repository: repository,
                            pull_request_id: pull_request_id
                        }, function (response) {
                            pull_requests_names[repository + '/' + pull_request_id] = response.data.title;
                            updatePullRequestsTitles();
                        });
                    }, 0);
                });
            });
        });
    }, 100);
});
