# Contributing

Thanks for your interest in this project. This repository currently publishes
a subset of the codebase — the generator's core logic, rendering, and
utility modules — not the full site. See [README.md](./README.md) for what's
in scope.

## Development

This repository is a source-code excerpt: it does not include its own
`package.json`/build config, since it's a curated subset of a larger private
project. To exercise it locally, wire up your own TypeScript + Vitest config
with:

- `react` / `react-dom` — the renderer is a React component
- `ajv` / `ajv-formats` — only to regenerate the validator; the committed
  `validator.generated.mjs` imports `ajv-formats` and `ajv` at runtime
- `@types/node` — several tests read fixtures and font files off disk, so the
  typecheck needs Node's types even though the library itself is
  browser-only
- a WASM-capable Node runtime, for the font subsetting tests

The `test/` files show the exact imports each module needs.

## Before opening a pull request

- Add or update tests under `test/` for any behavior change, and make sure
  they pass under your own harness.
- Keep changes scoped: prefer several small, focused pull requests over one
  large one.
- New logic should come with unit tests (see `test/` for existing patterns).
- Match the existing code style (TypeScript, no unnecessary comments, small
  pure functions where practical).
- Fixtures and examples must use fictional data only — no real company or
  product names, no real part numbers.

## Reporting issues

Please include: what you expected, what happened instead, and steps to
reproduce. For rendering/layout issues, a minimal part-number + item example
helps a lot.

## Code of Conduct

Participation in this project is governed by our
[Code of Conduct](./CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions will be licensed under the
project's [MIT License](./LICENSE).
