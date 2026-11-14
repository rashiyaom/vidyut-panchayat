const icon = (path: string) =>
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  path +
  "</svg>";
export const icons = {
  moon: icon(
    '<path d="M20.5 13.5A9 9 0 0 1 10.5 3a9 9 0 1 0 10 10.5Z"/><path d="m17 3 .5 1.5L19 5l-1.5.5L17 7l-.5-1.5L15 5l1.5-.5Z"/>',
  ),
  city: icon(
    '<path d="M3 21V9h6v12M9 21V3h7v18M16 21V12h5v9M6 12v1m0 3v1m6-11v1m0 3v1m0 3v1m0 3v1M19 15v1M2 21h20"/>',
  ),
  sun: icon(
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
  ),
  map: icon('<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16M15 5v16"/>'),
  home: icon('<path d="m3 10 9-7 9 7M5 9v12h14V9M10 21v-7h4v7"/>'),
  tree: icon('<path d="m12 3 7 10h-4l4 5H5l4-5H5ZM12 18v4"/>'),
  health: icon('<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z"/>'),
  water: icon('<path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z"/>'),
  bolt: icon('<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>'),
  station: icon(
    '<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 11h14M9 18l-2 4m8-4 2 4M8 15h1m6 0h1"/>',
  ),
  reset: icon('<path d="M3 10a9 9 0 1 1 2 8M3 3v7h7"/>'),
  rotate: icon('<path d="M5 8a8 8 0 1 1-1 8M5 3v5h5"/>'),
  play: icon('<path d="m8 4 12 8-12 8Z"/>'),
  pause: icon('<path d="M8 4v16M16 4v16"/>'),
  pin: icon(
    '<path d="M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  ),
  close: icon('<path d="m6 6 12 12M6 18 18 6"/>'),
  arrow: icon('<path d="M5 12h14m-6-6 6 6-6 6"/>'),
  cloudRain: icon(
    '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242M8 19v2m8-2v2m-4-1v2"/>',
  ),
};

export function mountExplorer(app: HTMLElement) {
  app.innerHTML = `
    <canvas id="city-canvas" aria-label="Interactive 3D city. Drag to orbit, right-drag to pan, scroll to zoom. Keyboard W A S D to pan." tabindex="0"></canvas>
    <div id="landmarks"></div>
    <header class="topbar">
      <div class="brand glass"><span class="brand-icon">${icons.city}</span><div><strong>VIDYUT PANCHAYAT</strong><span>Nagar <i>/</i> City explorer</span></div><span class="live-dot" title="City sandbox"></span></div>
      <div class="top-actions glass">
        <a id="reality-entry" class="reality-entry" href="?reality=1" aria-label="Explore the real system">Explore the real system <span>↗</span></a>
        <span class="dock-divider"></span>
        <button id="weather-toggle" class="weather-toggle" title="Toggle world: Raining / Sunny day">${icons.cloudRain}<span>Raining</span></button>
        <span class="dock-divider"></span>
        <button id="daylight" title="Change lighting">${icons.sun}<span>Daylight</span></button>
        <span class="dock-divider"></span>
        <button id="help" aria-label="Show controls">?</button>
      </div>
    </header>
    <aside class="directory glass collapsed" aria-label="Explore Nagar">
      <div class="panel-heading"><div><span class="eyebrow">YOUR NEXT PERSPECTIVE</span><h1>Explore Nagar</h1></div><button id="close-directory" class="icon-button" aria-label="Close city directory">${icons.close}</button></div>
      <div class="directory-tabs"><button class="active" data-tab="districts">Places</button><button data-tab="services">City services</button></div>
      <div id="districts">
        <button class="district active" data-district="all"><span class="district-icon">${icons.map}</span><span><b>City overview</b><small>The whole picture</small></span>${icons.arrow}</button>
        <button class="district" data-district="west"><span class="district-icon">${icons.home}</span><span><b>West Gardens</b><small>Courtyards, villas & local life</small></span>${icons.arrow}</button>
        <button class="district" data-district="civic"><span class="district-icon">${icons.health}</span><span><b>Civic Quarter</b><small>At the heart of Nagar</small></span>${icons.arrow}</button>
        <button class="district" data-district="east"><span class="district-icon">${icons.city}</span><span><b>Eastbank</b><small>A skyline with a different rhythm</small></span>${icons.arrow}</button>
        <button class="district" data-district="water"><span class="district-icon">${icons.water}</span><span><b>Palm Beach</b><small>Boardwalk, sand & rolling surf</small></span>${icons.arrow}</button>
      </div>
      <div id="services" hidden></div>
      <div class="directory-foot"><span id="block-count">64</span> blocks <span>·</span> <span id="service-count">11 city services</span></div>
    </aside>
    <section id="selection" class="selection glass" hidden>
      <button id="close-selection" class="close-button" aria-label="Close building details">${icons.close}</button>
      <div class="eyebrow" id="selection-category"></div><h2 id="selection-name"></h2><p id="selection-description"></p>
      <div class="detail-row"><span>Location</span><b id="selection-location"></b></div>
      <button id="focus-selection" class="primary-button">Explore this block ${icons.arrow}</button>
    </section>
    <div class="view-tools glass" aria-label="Camera controls"><button id="zoom-in" aria-label="Zoom in" title="Zoom in">+</button><button id="zoom-out" aria-label="Zoom out" title="Zoom out">−</button><span></span><button id="rotate" aria-label="Rotate camera" title="Rotate camera">${icons.rotate}</button><button id="reset" aria-label="Reset camera" title="Whole city">${icons.map}</button></div>
    <div class="bottom-left"><span class="mode-tag"><span class="live-dot"></span> FREE EXPLORATION</span><p>Drag to orbit <span>·</span> Scroll to zoom <span>·</span> Click to discover</p></div>
    <nav class="activity-dock glass" aria-label="City exploration controls">
      <button id="directory-toggle" aria-expanded="false" aria-controls="districts" aria-label="Open city directory">${icons.map}<span>Explore</span></button>
      <span class="dock-divider"></span>
      <button id="pause" aria-label="Pause city activity" title="Pause activity (Space)">${icons.pause}</button><button id="speed" title="Change activity speed" aria-label="Change activity speed">1×</button>
      <span class="dock-divider"></span>
      <button id="labels" aria-pressed="true" title="Show city services">${icons.pin}<span>Landmarks</span></button>
    </nav>
    <button id="facility-tour" class="facility-tour" type="button">${icons.pin}<span>Tour all facilities</span><b>→</b></button>
    <span id="activity-count" class="sr-only"></span>
    <div class="minimap glass"><div class="minimap-heading"><b>NAGAR</b><span>N ↑</span></div><canvas id="minimap-canvas" width="360" height="260" aria-label="City minimap. Click to navigate." tabindex="0"></canvas></div>
    <dialog id="controls-dialog" class="glass"><button id="close-help" class="close-button" aria-label="Close help">${icons.close}</button><div class="eyebrow">A CITY AT YOUR FINGERTIPS</div><h2>Find your perspective.</h2><p>Explore a place from the menu, or click any city block.</p><dl><dt>Orbit</dt><dd>Drag · one finger</dd><dt>Pan</dt><dd>Right-drag · two fingers · W A S D</dd><dt>Zoom</dt><dd>Scroll · pinch · + / −</dd><dt>Pause</dt><dd>Space</dd><dt>Overview</dt><dd>Home</dd></dl><p class="muted">Explore the city freely. City services are available through Explore or Landmarks.</p></dialog>
    <div id="loading"><div class="loading-mark">${icons.city}</div><b>A city, a little closer.</b><span>Preparing Nagar</span></div>`;
}
