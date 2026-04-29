# web-app

### Development Environment Setup

This project supports both macOS and WSL2 environments. When opening in Cursor/VS Code, the recommended extensions will
be automatically suggested for installation.

#### For Windows (WSL2):

- The 'Windows Subsystem for Linux (WSL)' extension will be automatically recommended
- Use the devcontainer setup for a consistent development experience
- Open the workspace file: `pnpm run workspace:open` or manually open `freeism-app.code-workspace`

#### For macOS/Linux:

- All extensions will be automatically recommended when opening the project
- TypeScript Server and ESLint will work seamlessly

#### Setup Steps:

1. git clone [repository-url]
2. Copy `.env.example` to `.env.local` and configure your environment variables
3. pnpm install
4. pnpm run dev

#### VS Code Workspace:

- For optimal experience, open the workspace file: `freeism-app.code-workspace`
- This ensures all extensions and settings are properly configured

### Available Commands

See `CLAUDE.md` for a complete list of development commands.
