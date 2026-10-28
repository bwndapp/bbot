# Contributing

Thanks for helping. bbot has two parts, and they move at different speeds:

- **The library** (`src/`, `widget/`): bug fixes and small improvements are
  welcome as pull requests.
- **The spec** (`spec/`, the Agent Face Protocol): changes affect every agent
  and renderer, so open an issue labelled `spec` first and discuss it before
  sending a PR.

## Setup

```sh
npm install
npm run build   # dist/
npm test        # spec and library agree, poses in range
npm run demo    # http://localhost:8080/demo/
```

## Pull requests

- Keep each PR to one change.
- `npm test` must pass. CI runs it on Node 20 and 22.
- Adding an expression or reaction means adding it to `src/expressions.js`
  **and** `spec/vocabulary.json` with a gloss and usage note. The tests fail
  if the two disagree.
- Keep the library dependency-free. Size matters: check the table in the
  README if you add code to the core.
- Changes to how a face looks need a before/after screenshot in the PR.

## Developer Certificate of Origin

Sign off your commits (`git commit -s`) to certify you wrote the change or
have the right to submit it under the project's licence, per the
[DCO](https://developercertificate.org).

## Conduct

Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).
