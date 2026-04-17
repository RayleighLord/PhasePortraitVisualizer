# AGENTS.md

## Project Purpose

This project is an interactive website for exploring planar autonomous systems of two first-order differential equations of the form:

- `x' = f(x, y)`
- `y' = g(x, y)`

It is intended to remain compatible with static-site deployment, including GitHub Pages.

The current product goals are:

- Show an `x-y` grid.
- Let the user choose visible axis limits.
- Let the user enter both differential equations in the same style as `ScalarODEsVisualizer`.
- Draw a direction field using constant-size arrows whose color reflects the magnitude of the derivative.
- Plot the trajectory through any clicked point in the phase plane.
- Allow multiple trajectories to remain visible until cleared.
- Provide a multi-seed action that launches a deterministic family of trajectories from a symmetric sample grid that gives a bit more coverage near the origin.
- Provide a preset-example library that includes the main linear phase portraits associated with trace-determinant analysis, plus selected nonlinear examples.
- Loading an example from that library should automatically populate a deterministic set of showcase trajectories.
- Show a compact local linear-analysis panel for the detected equilibrium nearest the origin.

## Engineering Expectations

- Keep the implementation maintainable, modular, and easy to extend.
- Prefer clear separation between UI, math/parsing, solver logic, analysis logic, and rendering.
- Preserve static-site compatibility.
- Keep GitHub Pages deployment working through `.github/workflows/deploy-pages.yml`.
- Keep the repository support files aligned with the useful structure of `ScalarODEsVisualizer` when that improves maintainability.
- Keep `README.md` simple and lightweight, in the same spirit as the reference project rather than turning it into long documentation.
- Avoid introducing unnecessary complexity for basic interactions.

## Established UI And UX Preferences

- Preserve the overall visual language of `ScalarODEsVisualizer`.
- Prefer a light, pleasant, exploratory visual style over a dark theme.
- Use a polished light palette with some personality; avoid plain default styling.
- Avoid odd or heavy blue washes behind the plot; prefer softer, more pleasant plot backgrounds.
- Keep the left control panel readable and compact.
- On a typical laptop-sized desktop viewport, the app should adapt cleanly without awkward clipping.
- The `x` and `y` axes must use the same visual scale so phase portraits and trajectories are not geometrically distorted.
- Preserve equal `x:y` scaling even when the plot window changes; use the largest portrait area that still respects that constraint.
- The desktop layout should feel like a bounded application view rather than an endlessly growing page.
- If the control content becomes taller than the viewport, prefer graceful in-panel scrolling over breaking the overall layout.
- The preferred outcome is that the left control pane fits in a single desktop viewport without needing to scroll in common laptop-sized windows.
- The current multi-seed behavior should use 20 initial points unless the user changes that instruction.
- The multi-seed action should use 20 deterministic sample points arranged as a symmetric, visually pleasant grid across the visible window, with slightly denser coverage near the origin.
- The default reset/reference example should be the linear stable improper node example.
- The default reset/reference example should open with no trajectories already drawn.
- The nonlinear limit-cycle example should appear in the preset library as another nonlinear case.
- In the preset-example list, the nonlinear Lotka-Volterra example should appear last.
- Preset example trajectories should come from visually chosen grid points rather than random seeds.
- Preset example trajectories should be dense enough to fill the portrait meaningfully rather than only sketching it sparsely.
- In the system-entry area, show prefixes as `x' =` and `y' =`, preferably rendered as math.
- Those equation-entry prefixes should feel visually centered and natural; do not force them into awkward top alignment.
- Default visible limits should be integers unless there is a strong reason not to.
- Outer top and bottom margins should adapt to window size and stay modest on larger screens rather than leaving large empty bands.
- Do not regress the top headers out of view when tuning layout density.
- Favicon and touch-icon assets should be present and served correctly; do not regress the browser-tab logo.
- Keep `public/logo.svg` and the favicon set available unless the user asks to replace them.
- Each trajectory should use a distinct color from a broad, rich palette, with enough variation that multiple curves remain distinguishable.
- Direction-field arrows should keep a consistent visual size, with color intensity used to encode speed.
- Keep the plot naming mathematically correct for this project; prefer `Phase portrait`.
- Show a rendered LaTeX version of the current system above the diagram.
- Use LaTeX rendering where it adds clarity for equations and mathematical symbols in the UI.
- Make the rendered differential-equation preview visually prominent and pleasant, not tiny or incidental.
- Plot numbers and axis labels should also use LaTeX styling.
- Plot numbers and axis labels should be visually a bit larger rather than delicate or tiny.
- Changing the window size must not leave the plot ticks, overlays, or axis labels misaligned.
- Tick labels should stay visually contained and not spill awkwardly outside the plot framing when decimal bounds are used.
- Prefer a flatter, cleaner plot background over decorative color washes when the latter do not look good.
- Clicking should feel forgiving: snap near visible axes when that improves usability.
- Orbit direction markers should be subtle and helpful, not dense or visually noisy.
- Keep the hero equation and the eigenvalue analysis readable; do not shrink those mathematical displays too aggressively.
- The rendered system shown above the phase portrait should be clearly legible and slightly prominent.
- The classification/stability display should be prominent enough to read at a glance.
- Clicking to add a trajectory should not leave a dot marker at the clicked point.
- Trajectory arrows should be distributed along the orbit rather than clumping into one small region.
- Do not add a dark under-stroke behind trajectories; improve contrast through the field styling and palette instead.
- Static arrows on trajectories are no longer preferred; use a lightweight animated flow cue instead.
- The preferred flow cue style is a moving train of gradient-like gray-to-black segments along every visible trajectory when flow animation is enabled, not particles or thick traveling bands.
- That moving trajectory gradient should use many closely spaced gray tones, with at least 30 grayscale steps including very light leading grays, so the transition toward black feels smooth rather than banded.
- Prefer multiple flow trains to be visible along each long trajectory at the same time, so the motion reads as continuous rather than isolated to a single moving segment.
- When tuning the animated flow, prefer segments that are slightly longer and slightly slower than the previous baseline, while keeping the cue readable rather than sluggish.
- Keep the all-trajectories flow effect visually rich but computationally light; avoid decorative glow/filter work when a simpler layered gradient achieves the same goal.
- Prefer a lighter neutral base stroke beneath the moving gradient train so the segmented flow remains legible and does not collapse into a continuous dark band.
- Provide a simple left-pane toggle labeled `Animate flow` so the all-trajectories flow animation can be enabled or disabled.
- The example library should load the selected example immediately on selection; avoid an extra load button.
- Keep overall sizing slightly compact so the controls still fit within one viewport when possible.
- Label the multi-seed button `Sample trajectories`.

## Visual Verification Workflow

- For UI/layout changes, do not rely only on code inspection.
- Use browser-based visual inspection as part of the feedback loop.
- Prefer Playwright-based verification for layout-sensitive changes.
- Check realistic desktop/laptop viewports, not only very large screens.
- Re-check the browser console after asset or layout changes so missing favicon/logo regressions are caught.
- For solver changes, sanity-check performance on bounded trajectories such as limit cycles, not only on quickly escaping trajectories.
- When adjusting layout, confirm that the actual rendered page matches the intended result before considering the task complete.

## Showcase Videos

- Showcase videos should use a visible cursor or cursor overlay so mouse motion and clicks are clearly seen.
- If equations are typed during a showcase, keep the visible cursor from covering the typed expression.
- Early showcase clicks should demonstrate a variety of trajectories, not only equilibrium solutions.
- Final showcase assets should be high-resolution GIFs in the same spirit as the reference ScalarODEsVisualizer project.

## Current Interaction Expectations

- Clicking inside the plot adds a trajectory through that point.
- Multiple trajectories may remain visible simultaneously until cleared.
- The multi-seed button should create a family of trajectories from 20 symmetric preset sample points in the visible window, with slightly denser coverage near the origin.
- The local analysis card should remain compact and readable while showing the selected equilibrium, Jacobian, eigenvalues, and classification.
- If several equilibria are visible, locate all of them and compute their local type and stability.
- When several equilibria are visible, the user must be able to explicitly select which one drives the detailed Jacobian/eigenvalue/classification display.

## Deployment Expectations

- The site should remain deployable as a static build.
- GitHub Pages deployment should happen through the repository workflow on pushes to `main`.
- Changes to build tooling should be checked against the GitHub Pages workflow so deployment is not accidentally broken.

## Repository Structure Expectations

- When comparing this project to `ScalarODEsVisualizer`, review useful support files as well as source files.
- Keep top-level support files such as `.github`, `.gitignore`, `README.md`, public assets, and stable Vite scaffolding in mind when maintaining parity.
- Do not blindly copy generated cache artifacts from the reference project; if `.vite` structure is useful, keep only the stable scaffold and let generated metadata be recreated locally.
- If the user asks for recurring project-structure or workflow conventions, record them here immediately.

## If Making Further UI Changes

- Re-check spacing, viewport fit, responsiveness, and readability after every substantial CSS/layout change.
- Favor changes that preserve discoverability of the controls while keeping the plot visually prominent.
- Treat layout regressions as real bugs even if typecheck and tests still pass.
- If a styling decision deviates from `ScalarODEsVisualizer`, make sure it is intentional and improves this planar-system app specifically.

## Maintaining This File

- If the user gives a new instruction that complements, refines, or contradicts this file, update `AGENTS.md` accordingly.
- Prefer editing existing guidance when the new instruction supersedes prior guidance, instead of leaving conflicting rules in place.
- If the user states a standing preference, workflow rule, repository-maintenance rule, or recurring command expectation, add it here in the same turn whenever possible.
