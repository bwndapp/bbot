# Security

## Reporting a vulnerability

Please don't open a public issue. Use GitHub's private reporting instead:
**Security → Report a vulnerability** on this repository.

You'll get an acknowledgement within 5 working days and a plan within 14.

## Scope

- **The library** draws SVG in the page and takes no network input of its
  own. Issues here are things like script injection through options or
  styles.
- **The desktop widget** connects to an agent and can expose read-only file
  tools for folders the user picks. Anything that lets an agent read outside
  those folders, write, or run code is in scope and treated as serious.
- **The spec**: weaknesses in the protocol itself, for example a message that
  could mislead a person about what an agent is doing.

## Supported versions

Fixes go into the latest release.
