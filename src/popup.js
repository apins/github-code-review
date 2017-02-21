if (document.querySelector('.js-apply-config')) {
	document.querySelector('.js-apply-config').addEventListener('click', function () {
		var value = document.querySelector('#config_container').value;
		var fullConfig = value.length > 0 ? JSON.parse(value) : {};

		if (confirm('This action can not be reversed. Confirm update')) {
			chrome.runtime.sendMessage(
				{command: 'setFullConfig', data: fullConfig}
			);
		}
	}, false);
}

if (document.querySelector('#config_container')) {
	chrome.runtime.sendMessage(
		{command: 'getFullConfig'},
		function(response) {
			document.querySelector('#config_container').innerText = JSON.stringify(response.data);
		}
	);
}
