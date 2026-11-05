# Third-party notices

Audited 2026-11-05 against the installed lockfile on macOS ARM64. AgentPay Guard's own
source is MIT; that does not relicense dependencies, fonts, provider SDKs or voices.

## Software

[DEPENDENCY_LICENSES.json](DEPENDENCY_LICENSES.json) records 374 installed package entries
and their declared licenses from `pnpm licenses list --json`, with local paths removed.
Other operating systems install different optional native packages. Preserve each dependency's
license and notices when redistributing its code or a compiled application.

| Declared license | Installed entries |
|---|---:|
| MIT | 321 |
| Apache-2.0 | 21 |
| ISC | 15 |
| BSD-2-Clause | 7 |
| MPL-2.0 | 3 |
| BSD-3-Clause | 2 |
| LGPL-3.0-or-later | 1 |
| CC-BY-4.0 | 1 |
| CC0-1.0 | 1 |
| BlueOak-1.0.0 | 1 |
| 0BSD | 1 |

Next.js and React are MIT, PostgreSQL's `pg` client is MIT, and Zod is MIT.
The native `@img/sharp-libvips-darwin-arm64` package is LGPL-3.0-or-later;
`lightningcss` and `axe-core` are MPL-2.0; `caniuse-lite` is CC-BY-4.0.
This source release references them through the package manager rather than vendoring their binaries.
Binary/container redistribution needs the accompanying license/source obligations retained;
the project's MIT file alone is not sufficient for those packages.

## Fonts and visual assets

- Newsreader: Copyright 2020 The Newsreader Project Authors, SIL OFL 1.1;
  [license](licenses/Newsreader-OFL.txt), [upstream](https://github.com/google/fonts/tree/main/ofl/newsreader).
- Geist and Geist Mono: Copyright 2026 The Geist Project Authors, SIL OFL 1.1;
  [license](licenses/Geist-OFL.txt), [upstream](https://github.com/vercel/geist-font).
- These fonts are fetched by `next/font/google` during a clean build and self-hosted in its output.
  Include their notices when distributing font files.
- Repository screenshots show the application and fictional demo data. Design reference URLs are
  inspiration references, not redistributed source/assets from those sites.
- The PayPal button is rendered by the official SDK. PayPal branding remains the property of its owner;
  it is not licensed by this project's MIT file. Do not imply endorsement or certification.
- No separately sourced stock footage or music was identified in the recording/assembly sources.
  The final English track was independently transcribed offline with Whisper during reconciliation;
  a human watch/listen of the rights-cleared replacement is still required.

## Video narration — publication gate

The inspected final uses macOS `say -v Samantha`. The installed OS reports macOS 26.7.
Apple's [macOS Tahoe license, section 2.F](https://www.apple.com/legal/sla/docs/macOSTahoe.pdf)
restricts system voices to personal, non-commercial content and excludes public sharing.
No separate permission was supplied during this audit. The final audio is **not cleared for public
YouTube publication**. Use the entrant's own recorded English narration, or a voice whose applicable
license explicitly permits public distribution, and keep the permission/license evidence.
Reassemble the video and synchronize captions after replacement. Installing a system voice or
having generated its WAV files does not establish redistribution permission.
