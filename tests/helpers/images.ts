import sharp from "sharp";

/** A noisy photo-like JPEG with EXIF (orientation 6, camera make), for upload tests. */
export async function jpegWithExif(width = 3000, height = 2000): Promise<Uint8Array> {
  const noise = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: "#000",
      noise: { type: "gaussian", mean: 128, sigma: 60 },
    },
  })
    .jpeg()
    .toBuffer();
  const out = await sharp(noise)
    .withMetadata({
      orientation: 6,
      exif: { IFD0: { Make: "SecretCam", Copyright: "private" } },
    })
    .jpeg({ quality: 90 })
    .toBuffer();
  return new Uint8Array(out);
}

export async function pngImage(width = 800, height = 600, color = "#b14dff"): Promise<Uint8Array> {
  return new Uint8Array(
    await sharp({ create: { width, height, channels: 3, background: color } })
      .png()
      .toBuffer(),
  );
}

export const SVG_IMAGE = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
);

/** Windows executable header: what a ".exe renamed to .jpg" really contains. */
export const EXE_RENAMED_AS_JPG = new Uint8Array([
  0x4d,
  0x5a,
  0x90,
  0x00,
  0x03,
  0x00,
  0x00,
  0x00,
  0x04,
  0x00,
  0x00,
  0x00,
  0xff,
  0xff,
  0x00,
  0x00,
  ...new Array(48).fill(0),
]);
