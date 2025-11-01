# Contributing to AI Worker Proxy

Thank you for your interest in contributing to AI Worker Proxy!

## Development Setup

1. **Fork and clone the repository**

```bash
git clone https://github.com/YOUR_USERNAME/AI-Worker-Proxy.git
cd AI-Worker-Proxy
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

```bash
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your API keys
```

4. **Run locally**

```bash
npm run dev
```

## Code Style

This project uses ESLint and Prettier for code formatting.

```bash
# Check linting
npm run lint

# Check types
npm run type-check

# Format code
npm run format
```

## Adding a New Provider

To add a new AI provider:

1. Create a new file in `src/providers/` (e.g., `my-provider.ts`)
2. Implement the `AIProvider` interface from `src/providers/base.ts`
3. Add the provider type to `src/types.ts`
4. Register it in `src/providers/index.ts`
5. Update documentation in `README.md`

Example:

```typescript
import { BaseProvider } from './base';
import { OpenAIChatRequest, ProviderResponse } from '../types';

export class MyProvider extends BaseProvider {
  async chat(request: OpenAIChatRequest, apiKey: string): Promise<ProviderResponse> {
    // Your implementation
  }
}
```

## Testing

Before submitting a PR:

1. Run all checks:

```bash
npm run lint
npm run type-check
```

2. Test locally with `npm run dev`
3. Test with different providers and routes
4. Test both streaming and non-streaming modes
5. Test error handling and failover

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Ensure all tests and linting pass
4. Update documentation if needed
5. Submit a pull request with a clear description

## Commit Messages

Use clear, descriptive commit messages:

- `feat: add support for XYZ provider`
- `fix: handle timeout errors in token rotation`
- `docs: update configuration examples`
- `refactor: simplify error handling`

## Questions?

Open an issue on GitHub if you have any questions!
