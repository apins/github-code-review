var extension_name = chrome.runtime.getManifest().name;
var extension_version = chrome.runtime.getManifest().version;

var pull_files_url_matches = window.location.pathname.match(/^\/(.*\/.*)\/pull\/(\d+)\/files/i);
var pulls_url_matches = window.location.pathname.match(/^\/(.*)\/(.*)\/pulls/i);

var repository_author_and_name;
var config = {};
var is_config_protected = false;

function getPullRequestConfig(repository, pull_request_id, callback) {
    if (!is_config_protected) {
        sendMessage(
            'getPullRequestConfig',
            {repository: repository, pull_request_id: pull_request_id},
            function (response) {
                if (!config[repository]) {
                    config[repository] = {};
                }
                if (!config[repository][pull_request_id]) {
                    config[repository][pull_request_id] = {};
                }
                config[repository][pull_request_id] = response.data.config;

                callback(response);
            }
        );
    }
}

function getPullRequestChangedFilesCount(repository, pull_request_id, callback) {
    sendMessage('getChangedFilesCount', {repository: repository, pull_request_id: pull_request_id}, function (response) {
        if (response && !!response.data && typeof callback === 'function') {
            callback(response.data.changed_files_count);
        }
    });
}

function getRepositoryConfig(repository, callback) {
    if (!is_config_protected) {
        sendMessage(
            'getRepositoryConfig',
            {repository: repository},
            function (response) {
                callback(response);
            }
        );
    }
}

function refreshStampsStorage(stamps_storage, repository, pull_request_id, callback) {
    var files = undefined;
    var comments = undefined;

    function setPullRequestFileStateStamps() {
        Object.keys(stamps_storage).forEach(function (key) {
            delete stamps_storage[key];
        });

        files.forEach(function (fileItem) {
            stamps_storage[fileItem.filename] = {
                hash: fileItem.sha,
                last_comment_date: null
            };
        });

        comments.forEach(function (commentItem) {
            if (!commentItem.path && !commentItem.position) {
                // Skip comments that are not related to files
                return;
            }

            if (!stamps_storage[commentItem.path]) {
                return;
            }

            if (
                stamps_storage[commentItem.path].last_comment_date == null
                || moment(commentItem.updated_at) > moment(stamps_storage[commentItem.path].last_comment_date)
            ) {
                stamps_storage[commentItem.path].last_comment_date = moment(commentItem.updated_at).format();
            }
        });
    }


    getPullRequestFiles(repository, pull_request_id, function (files_list) {
        files = files_list;
        if (typeof files !== 'undefined' && typeof comments !== 'undefined') {
            setPullRequestFileStateStamps();
            if (typeof callback === 'function') {
                callback();
            }
        }
    });

    getPullRequestComments(repository, pull_request_id, function (comments_list) {
        comments = comments_list;

        if (typeof files !== 'undefined' && typeof comments !== 'undefined') {
            setPullRequestFileStateStamps();

            if (typeof callback === 'function') {
                callback();
            }
        }
    });
}

function getPullRequestFiles(repository, pull_request_id, callback) {
    var files_list = [];
    var request_failed = false;

    function getFilesForPage(current_page) {
        sendMessage(
            'getPullRequestFiles',
            {repository: repository, pull_request_id: pull_request_id, page: current_page},
            function (response) {
                if (response.data.files) {
                    files_list = files_list.concat(response.data.files);
                    var surely_the_last_page = response.data.files.length % 10 !== 0;

                    if (response.data.files.length > 0 && !surely_the_last_page) {
                        getFilesForPage(current_page + 1);
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

    getFilesForPage(1);
}

function getPullRequestComments(repository, pull_request_id, callback) {
    var comments_list = [];
    var request_failed = false;

    function getCommentsForPage(current_page) {
        sendMessage(
            'getPullRequestComments',
            {repository: repository, pull_request_id: pull_request_id, page: current_page},
            function (response) {
                if (response.data.comments) {
                    comments_list = comments_list.concat(response.data.comments);
                    var surely_the_last_page = response.data.comments.length % 10 !== 0;

                    if (response.data.comments.length > 0 && !surely_the_last_page) {
                        getCommentsForPage(current_page + 1);
                    }
                    else {
                        callback(comments_list);
                    }
                }
                else {
                    request_failed = true;
                }
            }
        );
    }

    getCommentsForPage(1);
}


function isFileApproved(config, pull_request_file_state_stamps, repository_author_and_name, pull_request_id, file_path) {
    if (!pull_request_file_state_stamps[file_path]) {
        return false;
    }

    return !!config[repository_author_and_name]
        && !!config[repository_author_and_name][pull_request_id]
        && !!config[repository_author_and_name][pull_request_id][file_path]
        && config[repository_author_and_name][pull_request_id][file_path].hash === pull_request_file_state_stamps[file_path].hash

        // Do not forget to suffer
        && !(moment(config[repository_author_and_name][pull_request_id][file_path].last_comment_date) > moment(pull_request_file_state_stamps[file_path].last_comment_date))
        && !(moment(config[repository_author_and_name][pull_request_id][file_path].last_comment_date) < moment(pull_request_file_state_stamps[file_path].last_comment_date));
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
    window.setTimeout(function () {
        syncSendMessage(command, data, closure);
    }, 0);
}

function syncSendMessage(command, data, closure) {
    data.command = command;

    try {
        chrome.runtime.sendMessage(data, closure);
    }
    catch ($e) {
        if (!reload_confirmation_asked) {
            reload_confirmation_asked = true;
            cleanUpExtensionDOMElements();

            if (confirm('Extension "' + extension_name + ' v' + extension_version + '" was unloaded.\nTo proceed using it you need to refresh the page.\n\nRefresh now?')) {
                document.location.reload();
            }
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
        document.querySelectorAll('.js-approve-file, .js-disapprove-file').forEach(function (item) {
            item.remove();
        });

        document.querySelectorAll('.js-file').forEach(function (fileBlock) {
            showFileContents(fileBlock);
        });
    }
}
