# Contributing

Thanks for helping build Palmetto Run.

## Workflow

1. Fork the repo and create a branch: `git checkout -b feature/my-thing`
2. Make your change in `src/` (or `legacy/` for the 2D version).
3. Run `npm run check` and `npm run dev`, then play-test in the browser. Check the browser console for errors.
4. Open a pull request describing what you changed and how you tested it. A screenshot or short clip helps.

CI runs `npm run check` and `npm run build` on every pull request.

## Guidelines

- **Keep it one page.** The artifact must stay a single HTML file under 16 MB. Inline new assets (canvas-generated textures, data URIs) instead of loading files.
- **Only allowed CDNs.** Claude Artifacts only load scripts from cdnjs.cloudflare.com, cdn.jsdelivr.net/npm, unpkg.com, cdn.tailwindcss.com and code.jquery.com, pinned to an exact version. Other network requests are blocked.
- **No new dependencies or build tools** unless there is a strong reason. `npm run build` should keep working with plain Node.
- **Match the existing style.** The code is compact and organized into `// ---------- section ----------` blocks. Put new systems in their own section.
- **Multiplayer.** If you add something other players should see, add a small field to the presence object in `publish()` and read it defensively in `syncRoom()`. Everything received from other players is untrusted: validate numbers with `num()`, colours with `hex()`, and strings with `str()`.
- **Performance.** Watch draw calls (`renderer.info.render.calls`). Static meshes added to the scene before `staticBatch()` runs are merged automatically. Share geometries and materials, and use `InstancedMesh` for repeated objects.
- **Test on a phone** if you touch input or the HUD.

## Reporting bugs

Open an issue with what you did, what you expected, what happened, your browser, and any console errors.
