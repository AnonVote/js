# Issue: Package has no LICENSE file — add MIT license

## Summary

The JavaScript package (`js/`) declares `"license": "MIT"` in `package.json` but does not include an actual LICENSE file in the root directory. While the package metadata indicates MIT licensing, the legal document is missing. This creates compliance gaps for users, developers, and distribution systems. A LICENSE file must be added to the root of the `js/` directory containing the full MIT license text for legal clarity and compliance verification.

## Background

The `js` package in the workspace is a cryptographic utility library that generates and manages tokens, encrypts votes, and provides hashing functions for the voting system. It is distributed via npm and used by both the `contracts/service` and `core` components.

Currently:

- `js/package.json` declares `"license": "MIT"` (metadata only)
- No LICENSE file exists in `js/` directory
- License compliance tools flag this as missing documentation
- npm distribution may not include license text
- Users cannot review legal terms in the repository

## Scope

### MIT License File

- Create `js/LICENSE` file with full MIT license text
- Include copyright year and attribution
- Ensure compliance with OSI MIT license requirements
- Verify formatting matches standard MIT license structure

### Package Configuration

- Verify `package.json` has correct `"license": "MIT"` field
- Verify `.npmignore` (if exists) does not exclude LICENSE
- Ensure LICENSE is included in npm package distribution

### Documentation

- Update `js/README.md` to reference LICENSE file
- Add licensing section to documentation
- Include attribution requirements if any

## Error Handling

No runtime errors applicable — this is a distribution/compliance issue.

## Testing

- npm pack and verify LICENSE is included
- npm publish (test) and verify LICENSE appears in npm registry
- License compliance tools should recognize MIT license

## Relevant Files

- `js/LICENSE` (to be created)
- `js/package.json` (already correct, verify)
- `js/README.md` (update if needed)
- `js/.npmignore` (verify if exists)

## Acceptance Criteria

- LICENSE file exists at `js/LICENSE`
- Contains full MIT license text
- npm package includes LICENSE
- License compliance tools recognize MIT license
- README references LICENSE file
- No compilation warnings
- Documentation is clear

## Out of Scope

- Other license types (use MIT only)
- License updates for sub-packages
- CONTRIBUTING.md or CODE_OF_CONDUCT.md

## Note for Contributors

This is a straightforward documentation task. Copy the standard MIT license text from opensource.org/licenses/MIT into a new LICENSE file at `js/LICENSE`. Verify the npm package includes the file during distribution (check .npmignore and npm pack output). No code changes required, only file additions and minor documentation updates. This should take less than 15 minutes to complete.
