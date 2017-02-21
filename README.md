GitHub code review
=

Google Chrome extension to simplify code review of pull requests at GitHub
-

**Functionality:**

Each file gets own `Approve changes` button. Click on it collapses the file marking it as `passed review`.

**Nearest plans**

1. For now configuration is saved in `localStorage` and available for copy-paste from one working place to another manually.
The next steps here:
- make it be synced globally and automatically (using some global storage);
- allow GitHub token to clean-up for merged releases: no needs to keep them in storage anymore.
