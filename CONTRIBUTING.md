# Contributing to CrisisGrid

Thank you for your interest in contributing to CrisisGrid! This project is a real-time emergency coordination platform — contributions that improve reliability, security, or accessibility are especially valued.

## How to Contribute

### Reporting Bugs

- Check existing issues first
- Provide clear reproduction steps
- Include environment details (Node version, OS, browser)

### Suggesting Features

- Open an issue with the `enhancement` label
- Describe the use case and expected behavior

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes with clear commit messages
4. Ensure the project builds: `npm run build`
5. Submit a pull request with a detailed description

## Development Setup

```bash
npm install
npx tsx server/index.ts    # Backend (port 3001)
npm run dev                # Frontend (port 5000)
```

Mobile:
```bash
cd mobile && npm install && npx expo start
```

## Code Style

- TypeScript strict mode enabled
- Follow existing file naming conventions
- Keep components focused and reusable

## Questions?

Open a discussion or reach out via the contact form in the app.
