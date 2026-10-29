# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Report privately to the unfoldingWord engineering team via
<security@unfoldingword.org>, or, where enabled, through GitHub's private
vulnerability reporting on this repository.

Include: what you found, how to reproduce it, and the impact you believe it
has. We will acknowledge within a few business days.

## Scope notes for this project

This repository holds data and the scripts that build it. It runs no service,
has no secrets, and has no users' data. The risks worth reporting are mostly
about integrity:

- a build input fetched or used without the pin in `sources.json`;
- a change that would let a released package or title table be altered
  without a new version;
- a secret committed by mistake (CI scans full history with gitleaks).
