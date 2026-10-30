// Renders the watermark tile used by SharpImageProcessor. The PNG is committed so the server
// needs no fonts at runtime. Run: node scripts/build-watermark.mjs
import sharp from "sharp";

const WIDTH = 420;
const HEIGHT = 240;
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <!-- Crescent moon mark: a circle with an offset circle cut out. -->
    <mask id="crescent">
      <circle cx="0" cy="0" r="24" fill="#fff" />
      <circle cx="10" cy="-7" r="20" fill="#000" />
    </mask>
  </defs>
  <g transform="translate(${WIDTH / 2} ${HEIGHT / 2}) rotate(-24)" opacity="0.25">
    <g transform="translate(-126 -12)">
      <circle cx="0" cy="0" r="25.5" fill="#000" mask="url(#crescent)" />
      <circle cx="0" cy="0" r="24" fill="#fff" mask="url(#crescent)" />
    </g>
    <text x="-92" y="1" font-family="DejaVu Sans, sans-serif" font-size="38" font-weight="700"
          fill="#ffffff" stroke="#000000" stroke-width="1.5" paint-order="stroke">@nightdaro</text>
  </g>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile("src/infra/media/assets/watermark-tile.png");
console.log("Wrote src/infra/media/assets/watermark-tile.png");
