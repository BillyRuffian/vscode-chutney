# vscode-chutney 

This is the official VS Code extension for [Chutney](https://www.usechutney.com/), a ruby based linter for Cucumber / Gherkin feature files.

## Features

This extension supports the fast linting of your Gherkin files, checking for best practice so you can BDD / ATDD in a manintainable way.

On open and save, the feature file will be evaluated for any bad patterns and these will be highlighted in the editor.

## Requirements

Chutney is distributed as a Ruby [gem](https://rubygems.org/gems/chutney), so you will need both Ruby and Chutney installed on your system.

* Ruby >= 3.2
* Chutney >= 3.8.1

If you have a Ruby project with a Gemfile (e.g. a Ruby-Cucumber test pack) the bundled version of chutney will be used, otherwise it will fallback to a system version.


## Known Issues

None known.

## Release Notes

First release.

### 1.0.0

Initial release of the Chutney LSP VS Code Extension.

---

## Acknowledgements

This extension was heavily influenced by the [Rubocop extension](https://github.com/rubocop/vscode-rubocop).