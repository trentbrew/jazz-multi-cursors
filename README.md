# Jazz Multi-Cursors Example

Track user presence on a canvas with multiple cursors and out of bounds indicators.
Live version: [https://multi-cursors.demo.jazz.tools/](https://multi-cursors.demo.jazz.tools/)

## Getting started

You can either

1. Clone the jazz repository, and run the app within the monorepo.
2. Or create a new Jazz project using this example as a template.

### Using the example as a template

Create a new Jazz project, and use this example as a template.

```bash
npx create-jazz-app@latest multi-cursors-app --example multi-cursors
```

Go to the new project directory.

```bash
cd multi-cursors-app
```

Run the dev server.

```bash
npm run dev
```

If you want to persist the cursors between server restarts, you'll need to update your .env file. Check your console logs for the correct values to add to your .env file.

```
VITE_CURSOR_FEED_ID=
VITE_GROUP_ID=
VITE_OLD_CURSOR_AGE_SECONDS=5
```

### Using the monorepo

This requires `pnpm` to be installed, see [https://pnpm.io/installation](https://pnpm.io/installation).

Clone the jazz repository.

```bash
git clone https://github.com/garden-co/jazz.git
```

Install and build dependencies.

```bash
pnpm i && npx turbo build
```

Go to the example directory.

```bash
cd jazz/examples/multi-cursors/
```

Start the dev server.

```bash
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) with your browser to see the result.

If you want to persist the cursors between server restarts, you'll need to update your .env file. Check your console logs for the correct values to add to your .env file.

```
VITE_CURSOR_FEED_ID=
VITE_GROUP_ID=
VITE_OLD_CURSOR_AGE_SECONDS=5
```

## Questions / problems / feedback

If you have feedback, let us know on [Discord](https://discord.gg/utDMjHYg42) or open an issue or PR to fix something that seems wrong.

## Configuration: sync server

By default, the example app uses [Jazz Cloud](https://jazz.tools/cloud) (`wss://cloud.jazz.tools`) - so cross-device use, invites and collaboration should just work.

You can also run a local sync server by running `npx jazz-run sync`, and setting the `sync` parameter of `JazzReactProvider` in [./src/main.tsx](./src/main.tsx) to `{ peer: "ws://localhost:4200" }`.
