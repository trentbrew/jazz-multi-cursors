Looking at your multi-cursor example, the issue is that you're using `DemoAuth` which creates separate accounts for each browser session. To share the same instance across different browsers, you need to configure the authentication to use the same account.

Let me check your current setup and show you how to fix this:

Read file: multi-cursors/src/main.tsx
Read file: multi-cursors/src/App.tsx
Read file: multi-cursors/src/utils/loadCursorContainer.ts
Now I understand the issue! The problem is that each browser session creates a new account with `DemoAuth`, so they're treated as different users. To share the same instance, you need to either:

1. **Use a shared account** (simplest for testing)
2. **Use environment variables** to specify the same group/cursor feed

Let me show you the quickest fix - using environment variables:

Read file: multi-cursors/.env.example
Ran tool
Let me check if there's a .env file or create one:

```bash
ls -la | grep env
```

Read file: multi-cursors/.env.example

```bash
cat .env.example
```

Perfect! Now I understand the setup. To share the same instance across different browsers, you need to:

1. **Create a `.env` file** with the same group and cursor feed IDs
2. **Use the same environment variables** in both browser sessions

Here's how to fix it:

```bash
cp .env.example .env
```

Now let me start the dev server to test this:

```bash
pnpm dev
```

Perfect! Now here's what you need to do to share the same instance across different browsers:

## Solution: Use Environment Variables

The multi-cursor example is already set up to use environment variables for sharing. Here's what's happening:

1. **Environment Variables**: The app uses `VITE_GROUP_ID` and `VITE_CURSOR_FEED_ID` to load the same shared group and cursor feed
2. **Shared Group**: All users connect to the same group, so they see each other's cursors
3. **DemoAuth**: Each browser still gets its own account, but they all share the same group

## How to Test:

1. **Open two different browsers** (Chrome, Firefox, Safari, etc.)
2. **Navigate to `localhost:5173`** in both browsers
3. **You should now see each other's cursors** because they're using the same group ID

## Alternative: Create Your Own Shared Instance

If you want to create a fresh shared instance:

1. **Remove the `.env` file** (or comment out the variables)
2. **Open the app in one browser** - it will create a new group
3. **Copy the group ID** from the console log: `Add "VITE_GROUP_ID=co_xxxxx" to your .env file`
4. **Create a `.env` file** with that group ID
5. **Restart the dev server**
6. **Open in other browsers** - they'll all share the same instance

The key insight is that **Jazz uses groups to share data between users**. Each browser session gets its own account, but they can all join the same group to see each other's cursors.

Try opening the app in two different browsers now - you should see each other's cursors moving around!
