# City exploration and customization

Run `npm run dev` from the repository root. The city now renders real worker-engine ticks; the authored layout and customization API are preserved.

## Explore

- Left-drag to orbit, right-drag to pan, scroll to zoom toward the cursor. Trackpad pinch and touch pinch zoom toward the gesture location. On a touch screen, use one finger to orbit and two fingers to pan or pinch.
- W/A/S/D or arrow keys pan. Home restores the overview; Space controls ordinary city activity. Disaster mode has its own simulation controls; approval pauses only that simulation.
- Open **Explore** for places and city services. The directory starts closed; selecting a destination closes it automatically. Click a block to inspect it. The minimap also moves the camera.
- The compact bottom dock controls normal city playback, speed and optional landmarks. Labels start hidden. Daylight switches to golden-hour lighting. Escape closes a selected block or the directory.

## Change the layout

`data/scenes/city_v1.json` is the editable visual layout. A facility has a stable `id`, a reusable `kind`, a `[row, column]` cell, optional `[x, z]` offset in world units, rotation in radians, scale, and facade color. Rows and columns begin at zero. IDs and occupied facility cells must be unique.

The district rows use `R` for residential, `C` for commercial, and `P` for parks. The seed keeps generated buildings repeatable. `blockSize` and `roadWidth` control the street grid. Offsets and scales are intentionally flexible; keep the model's footprint clear of adjacent roads and lots.

```json
{
  "id": "hospital",
  "kind": "hospital",
  "cell": [3, 4],
  "offset": [1, -2],
  "rotation": 1.5707963268,
  "scale": 1,
  "color": "#f3eee0"
}
```

This fragment shows placement fields; retain the existing name, category and description in the full JSON object.

For live changes from code or the browser console:

```ts
window.vidyutCity.updateBuilding('hospital', {
  offset: [1, -2],
  rotation: Math.PI / 2,
  color: '#e9dfc8',
});
window.vidyutCity.focus('hospital');
const editableCopy = window.vidyutCity.getScene();
window.vidyutCity.setScene(editableCopy);
```

Live edits last for the current page session. Save the corresponding JSON edits to keep them. Updates validate the full scene before replacing the rendered city. A rebuild also refreshes selection bounds, landmarks and street activity.

## Architectural styles and ordinary blocks

Eight reusable layouts produce different footprints and silhouettes: `terraces`, `courtyard`, `villas`, `townhouses`, `lofts`, `cylinder`, `slabs` and `hotel`. The seed and district choose defaults; `blockStyles` in the scene JSON assigns a specific layout to a `"row,col"` key. `blockTransforms` uses the same key for offset, rotation and scale. Facilities retain their own transforms.

```ts
window.vidyutCity.updateBlock(0, 0, {
  style: 'terraces',
  offset: [1, -1],
  rotation: Math.PI / 2,
  scale: 0.9,
});
window.vidyutCity.focus('block-0-0');
```

Use `updateBuilding` for a city service. To replace a park with buildings, first change its district from `P` in the scene data. Architectural dimensions are authored for the default 28-unit blocks; changing the grid spacing also needs suitable building scales. The beach's terrain and surf share a coastline function so they remain aligned when the city extent changes.

## Reusable modules

| File | Responsibility |
| --- | --- |
| `src/world3d/sceneSchema.ts` | Scene validation, types and seeded randomness |
| `src/world3d/civicLandmarks.ts` | Grand Panchayat hall, station and reusable utility-site details |
| `src/world3d/buildings.ts` | Building styles and utility landmark factories |
| `src/world3d/typologies.ts` | Eight neighborhood factories and district defaults |
| `src/world3d/coast.ts` | Curved beach terrain, palms, boardwalk, beach furniture and animated surf |
| `src/world3d/beachfront.ts` | Furnished plaza, cafes, cabanas and an animated observation wheel with upright cabins |
| `src/world3d/rendering.ts` | Antialiasing, contact shading and final tone mapping |
| `src/ui/CityExplorer.ts` | Minimal black-glass explorer interface |
| `src/world3d/primitives.ts` | Batched geometry, trees, benches and street lights |
| `src/world3d/environment.ts` | Streets, parks, promenade and bridges |
| `src/world3d/mobility.ts` | Road and sidewalk routes, detailed cars and buses, pedestrians |
| `src/world3d/rail.ts` | Elevated rail loop above the road grid, moving train sets and the Central Station platform |
| `src/world3d/city.ts` | Assemble, identify and dispose of a complete city |
| `src/world3d/camera.ts` | Camera controls and smooth navigation |
| `src/app/main.ts` | Scene lifecycle, UI interactions and public customization API |

All visual models are original procedural geometry. There are no external model, texture, font or runtime network requirements. Geometry is grouped into instanced batches; the rendering pixel ratio is capped at 1.25. Static sun shadows are cached and rebuilt after layout or lighting changes; moving people and vehicles use screen-space contact shading. Traffic and trains are ambient visual activity, not a traffic-routing, signaling or collision simulation. The elevated rail loop follows road corridors above vehicle clearance and connects to Central Station by an upper platform. Rendering modules do not import simulation engine internals.

The shoreline uses animated shader waves and foam; it is a visual effect rather than a fluid simulation. The world uses authored procedural forms and materials, with a stylized city-builder appearance.

Electrical facility IDs are required by the separate network contract. Moving, rotating, scaling and recoloring facilities is supported; removing or renaming one is rejected before replacing the working scene. Power overlays are rebuilt at the new positions. Panchayat Square remains a civic landmark.
