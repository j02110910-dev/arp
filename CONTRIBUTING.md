# Contributing to ARP

Thank you for your interest in contributing to Agent Reliability Platform (ARP)!

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

```bash
# Clone the repository
git clone https://github.com/<your-fork>/arp.git
cd arp

# Install dependencies
npm install
```

### Building

```bash
npm run build
```

Builds the TypeScript project into the `dist/` directory.

## Code Standards

### TypeScript

We use TypeScript in strict mode. All contributions should be type-safe.

```bash
# Type check without building
npm run typecheck
```

### Linting

ESLint is configured with TypeScript support and strict rules.

```bash
npm run lint
```

Lint errors must be resolved before submitting a pull request.

### Testing

All tests must pass before merging. We use Jest as the test framework.

```bash
# Run all tests
npm test

# Run all plugin tests + main tests
npm run test:all

# Run tests for a specific plugin
npm run test:silent-watch
npm run test:output-verifier
npm run test:cognitive-governor
npm run test:permission-sentinel
npm run test:agent-stress-tester
```

Each plugin has its own test suite located in `plugins/<plugin-name>/tests/`.

## Pull Request Process

1. **Fork the repository** and create a branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** — ensure all lint and type checks pass:
   ```bash
   npm run lint
   npm run typecheck
   ```

3. **Write tests** for any new functionality. All tests must pass:
   ```bash
   npm test
   ```

4. **Commit your changes** with a clear, descriptive message:
   ```bash
   git commit -m "Add: feature description"
   ```

   Follow conventional commit format (optional but recommended):
   - `Add:` for new features
   - `Fix:` for bug fixes
   - `Refactor:` for code refactoring
   - `Docs:` for documentation changes
   - `Test:` for test additions/changes

5. **Push to your fork** and open a Pull Request against `main`.

6. **Ensure CI passes** — all tests and lint checks must greenlight the PR.

## Project Structure

```
arp/
├── src/              # Core source code
├── dist/             # Compiled JavaScript output
├── plugins/          # Plugin packages
│   ├── silent-watch/
│   ├── output-verifier/
│   ├── cognitive-governor/
│   ├── permission-sentinel/
│   └── agent-stress-tester/
├── tests/            # Core test suite
├── docs/             # Documentation
└── landing/          # Landing page site
```

## Code Style

- Use 2 spaces for indentation (no tabs)
- Prefer `const` over `let`, avoid `var`
- Use named exports over default exports where reasonable
- Add JSDoc comments for public APIs
- Keep lines under 100 characters

## Reporting Issues

- Search existing issues before creating a new one
- Use the issue template if available
- Include reproduction steps for bugs
- Specify your Node.js version and ARP version

## Questions?

Open an issue on GitHub for discussion before submitting large PRs.
