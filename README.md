# Menu Planner

A family meal planning application built with Next.js, InstantDB, and OpenAI.

## Local Development Setup

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- InstantDB account (for database)
- OpenAI API key (for AI menu generation feature)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env.local`:
     ```bash
     cp .env.example .env.local
     ```
   - Open `.env.local` and fill in your actual values:
     - `NEXT_PUBLIC_INSTANTDB_APP_ID`: Get this from [InstantDB Dashboard](https://instantdb.com)
     - `INSTANT_APP_ADMIN_TOKEN`: **Required for `/api/week-menu` and `/api/menu/vote`.** In the dashboard, open your app → **Admin** and create/copy the backend admin token (keep it secret; server-only).
     - `MENU_PLANNER_API_KEY`: Optional secret for those API routes (`Authorization: Bearer …`).
     - `OPENAI_API_KEY`: Get this from [OpenAI Platform](https://platform.openai.com/api-keys)

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_INSTANTDB_APP_ID` | Yes | Your InstantDB App ID for database and authentication |
| `INSTANT_APP_ADMIN_TOKEN` | Yes for server APIs | Admin token from Instant dashboard (App → Admin). Needed for `/api/week-menu` and `/api/menu/vote`. |
| `MENU_PLANNER_API_KEY` | For secured APIs | Shared secret; send as `Authorization: Bearer …` to week-menu and menu/vote routes. |
| `OPENAI_API_KEY` | Yes | Your OpenAI API key for AI menu generation feature |

**Note:** The `.env.local` file is gitignored and won't be committed to the repository. Always use `.env.example` as a template for other developers.

## Building for Production

```bash
npm run build
npm start
```
