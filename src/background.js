chrome.storage.local.get(null, function (data) {
	var config = data ? data : {};

	chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
		if (message.command == 'getConfig') {
			var requested_config = config[message.repository] && config[message.repository][message.pull_request_id]
				? config[message.repository][message.pull_request_id]
				: {};
			sendResponse({data: requested_config});
		}
		else if (message.command == 'getFullConfig') {
			sendResponse({data: config});
		}
		else if (message.command == 'setFullConfig') {
			config = message.data;
			chrome.storage.local.set(config);
		}
		else if (message.command == 'setConfig') {
			if ( ! config[message.repository]) {
				config[message.repository] = {};
			}
			if ( ! config[message.repository][message.pull_request_id]) {
				config[message.repository][message.pull_request_id] = {};
			}
			config[message.repository][message.pull_request_id] = message.config;
			chrome.storage.local.set(config);
		}
	});

	chrome.webNavigation.onHistoryStateUpdated.addListener(function(details) {
		chrome.tabs.executeScript(null, {file: "content.js"});
	});

});
