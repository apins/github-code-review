if (pulls_url_matches) {
    var repository_author = pulls_url_matches[1];
    var repository_name = pulls_url_matches[2];
    repository_author_and_name = repository_author + '/' + repository_name;

    function refreshPullRequestsView(repository, repository_config) {
        if (!is_config_protected) {
            config[repository] = repository_config;

            Array.prototype.forEach.call(document.querySelectorAll('.issues-listing .js-issue-row'), function (eachPullRequestBlock) {
                var pullRequestBlock = eachPullRequestBlock;
                var pullRequestHeader = pullRequestBlock.querySelector('.opened-by');
                var changed_files_count = pullRequestHeader.dataset.changed_files_count;
                var approved_files_count = pullRequestHeader.dataset.approved_files_count;
                var block_pull_request_id;

                var pull_request_matches = pullRequestBlock.id.match(/issue_(\d+)/i);
                if (pull_request_matches) {
                    block_pull_request_id = pull_request_matches[1];
                }
                else {
                    return;// Must be impossible situation
                }

                if (changed_files_count == null && !pullRequestHeader.dataset.changed_files_count_requested) {
                    pullRequestHeader.dataset.changed_files_count_requested = true;

                    window.setTimeout(function () {
                        var closured_repository = repository;
                        var closured_pull_request_id = block_pull_request_id;
                        var closured_pullRequestBlock = pullRequestBlock;
                        var closured_pullRequestHeader = pullRequestHeader;
                        var stamps_storage = {};

                        refreshStampsStorage(stamps_storage, repository_author_and_name, closured_pull_request_id, function () {
                            var approved_files_count = 0;

                            if (!!config[closured_repository][closured_pull_request_id]) {
                                Object.keys(config[closured_repository][closured_pull_request_id]).forEach(function (filename) {
                                    if (isFileApproved(config, stamps_storage, closured_repository, closured_pull_request_id, filename)) {
                                        approved_files_count++;
                                    }
                                });
                            }

                            closured_pullRequestHeader.dataset.changed_files_count = Object.keys(stamps_storage).length;
                            closured_pullRequestHeader.dataset.approved_files_count = approved_files_count;
                            updatePullRequestCounter(closured_pullRequestBlock, approved_files_count, Object.keys(stamps_storage).length);

                            closured_repository = null;
                            closured_pull_request_id = null;
                            closured_pullRequestBlock = null;
                            closured_pullRequestHeader = null;
                            stamps_storage = null;
                        });
                    }, 0);

                    createChangedFilesCounter(pullRequestHeader);
                }
                else if (typeof changed_files_count === 'number') {
                    updatePullRequestCounter(pullRequestBlock, approved_files_count, changed_files_count);
                }
            });
        }
    }

    function updatePullRequestCounter(pullRequestBlock, approved_files_count, changed_files_count) {
        var pullRequestHeader = pullRequestBlock.querySelector('.opened-by');
        var counterElement = pullRequestHeader.querySelector('.js-changed-files-counter');


        if (approved_files_count >= changed_files_count) {
            // Hello, buggy pull requests with 0 changed files: https://github.com/octocat/Hello-World/pulls
            changed_files_count = approved_files_count;

            markPullRequestReady(pullRequestBlock);
            counterElement.innerHTML = ', all <strong>' + changed_files_count + '</strong> files passed review';
        }
        else {
            unmarkPullRequestReady(pullRequestBlock);
            if (counterElement.innerHTML !== ', <strong>' + approved_files_count + '</strong> of ' + changed_files_count + ' files passed review') {
                counterElement.innerHTML = ', <strong>' + approved_files_count + '</strong> of ' + changed_files_count + ' files passed review';
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

        counter.innerHTML = ', loading reviews data...';
        counter.className = 'js-changed-files-counter';
        counter.style.fontWeight = 'normal';
        counter.style.fontSize = '10pt';
        counter.style.position = 'relative';
        counter.style.left = '-5px';
        counter.style.color = '#767676';
        counter.style.whiteSpace = 'nowrap';
        pullRequestHeader.appendChild(counter);
    }

    function decoratePullRequests() {
        sendMessage('getApiToken', {}, function (response) {
            if (!!response.data && !!response.data.access_token) {
                getRepositoryConfig(repository_author_and_name, function (response) {
                    refreshPullRequestsView(repository_author_and_name, response.data.config);
                });
            }
        });
    }

    decoratePullRequests();

    window.setInterval(function () {
        decoratePullRequests();
    }, 100);
}
