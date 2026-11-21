# Third-party components and licence register

This register is the control point for recording third-party software, assets and contributions used by IA Admin Adjunta.

## Policy

- The root `LICENSE` covers only original materials for which Igor André Maximiano Russo Fontes holds the relevant rights.
- Third-party libraries, frameworks, assets, datasets, fonts and code remain under their own licences and notices.
- Do not remove, replace or obscure third-party copyright or licence notices.
- Before a release or commercial distribution, generate and review a Software Bill of Materials (SBOM), identify direct and transitive dependency licences, and preserve required notices and source-offer obligations.
- Flag copyleft obligations (including GPL, LGPL and AGPL) for compatibility review before combining, modifying or distributing affected components.
- Record manually copied or vendored code separately; a package-lock file alone is not a complete licence inventory.
- Do not mark this register complete until it has been generated from the exact release commit and independently reviewed.

## Current audit status

**Pending.** The repository contains npm and Python dependencies and application code. A complete dependency, asset and contribution licence audit has not yet been completed. The presence of a dependency in a manifest does not establish that its licence obligations have been fulfilled.

## Register fields

For each component, record:

- **Component:** Package, asset or contribution name.
- **Version:** Exact version used in the release.
- **Source:** Canonical project or package source.
- **Licence:** SPDX identifier and licence text/reference.
- **Use:** Runtime, build, development, bundled or vendored.
- **Notice:** Required copyright/attribution notice.
- **Obligations:** Source disclosure, attribution, patent notice or other requirements.
- **Review:** Reviewer and review date.
