# Photos

Drop the image files in this folder using **exactly these filenames**. The page picks them up
automatically once they exist; nothing else needs editing.

| Filename | Where it appears | Shape |
| --- | --- | --- |
| `work-01.jpg` … `work-06.jpg` | the Recent cuts grid | **4:5 portrait** |
| `shop.jpg` | the About section | **4:5 portrait** |

## What to supply

- **Aspect ratio 4:5 (portrait).** The tiles crop to fill, anchored on the centre, so anything
  squarer or wider loses its top and bottom. Cropping to 4:5 before uploading gives you control
  over what survives.
- **About 1200 × 1500 px.** Larger is wasted; the biggest a tile is ever displayed is roughly
  400 px wide on a desktop screen, doubled for retina.
- **Under ~300 KB each**, JPEG quality 80 or so. Eight images at 300 KB is already 2.4 MB, which
  is most of the page weight. WebP is roughly 30% smaller again if your export supports it.
- **sRGB colour.** Photos exported in Display P3 look oversaturated in some browsers.

## Straight from Instagram

Instagram serves posts at 1080 px wide, which is enough. Save the original from the post rather
than screenshotting — a screenshot bakes in the interface and halves the effective resolution.

Instagram's own API links cannot be used here: `media_url` is a signed URL that expires, so any
page storing one starts returning "URL signature expired" after a few weeks. The files have to
be downloaded and committed, which is what this folder is for.

## Uploading without git

On the repo page: **Add file → Upload files**, drag them in, then **Commit changes**. That is
enough; the deploy runs itself.

## Captions

Each tile currently carries a short label (`Skin fade`, `Balayage`, and so on) which doubles as
the image's alt text. If a photo shows something different, say so and the label will be
updated to match — alt text that misdescribes a picture is worse than none.
