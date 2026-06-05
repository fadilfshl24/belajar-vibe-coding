# Security Best Practices

## Code Security

- Never hardcode secrets, API keys, or passwords in source code
- Use environment variables for sensitive configuration
- Validate and sanitize all user inputs before processing
- Use parameterized queries to prevent SQL injection
- Implement proper authentication and authorization on every endpoint
- Never log sensitive data (passwords, tokens, PII)

## Dependency Management

- Keep dependencies updated to patch known vulnerabilities
- Use dependency scanning tools (e.g., `npm audit`, Dependabot)
- Review third-party packages before adding them to the project
- Use lock files (`package-lock.json`, `yarn.lock`, `poetry.lock`) and commit them
- Remove unused dependencies to reduce attack surface

## Data Protection

- Encrypt sensitive data at rest and in transit
- Use HTTPS for all web communications — never plain HTTP
- Implement proper session management (short expiry, secure flags)
- Use secure HTTP headers: HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- Follow OWASP Top 10 guidelines

## Infrastructure Security

- Apply least privilege principle for all IAM roles and service accounts
- Enable logging and monitoring for all critical services
- Use network segmentation to isolate services
- Implement proper backup strategies and test restores regularly
- Conduct regular security audits and penetration testing

## Development Practices

- Use static code analysis tools (e.g., ESLint security plugins, Semgrep)
- Include security testing in CI/CD pipelines
- Require code reviews with a security focus for sensitive changes
- Keep developers trained on current security threats
- Have a documented incident response procedure
