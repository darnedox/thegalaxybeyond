#!/bin/bash
cd "$(dirname "$0")"
{
 cat src/head.html
 echo '<script>'
 echo '(function(){"use strict";'
 echo 'if(!window.THREE){var l=document.getElementById("loading");l.textContent="Could not load the 3D engine. Check your internet connection and reload.";return;}'
 cat src/01_data.js src/02_gfx.js src/03_audio.js src/04_space.js src/05_spacelogic.js src/06_planet.js src/07_combat.js src/08_ui.js src/09_net.js src/10_main.js
 echo '})();'
 echo '</script>'
} > index.html
wc -c index.html
