# Homepage 3D models

The homepage scene is drawn in the logo's style (flat cartoon colours, thick dark outline).
The duck guide swims from one set piece to the next as you scroll, one per section.
Everything has a built-in version made from code, so these files are optional.
Drop Tripo exports (glTF binary, `.glb`) into `public/models/` and the scene uses them by name.
They get the same cartoon shading and outline on load.

| File | Section | What it is |
| --- | --- | --- |
| duck-guide.glb | all (the guide) | The logo duck: yellow, orange beak, thick black glasses, three-feather tuft. Made from the logo image. |
| set-overpay-cloud.glb | Are you overpaying for AI? | A cartoon cloud with a coin slot on top and a price tag (renting AI). Coins fly into it in code. |
| set-offers-hq.glb | Ways to start | A small AI headquarters: a server box with lights and a dish, sits on top of the third step. |
| set-proof-rig.glb | Built & shipped | A chunky gaming PC tower with glowing GPU and fans, duck sticker on the side (the local AI lab). |
| set-book-calendar.glb | Next move (book a call) | A desk calendar with a big check mark. |

Made in code only (no file needed): the six service badges, the six "every kind of AI" tiles,
the numbered offer steps, the process stepping stones and the FAQ question mark.

Facing: glTF faces +z. The duck is turned 90 degrees so its beak points down +x.
If a model faces the wrong way, add `public/models/manifest.json`, for example
`{"duck-guide.glb": {"yaw": 45}}`, with the extra turn in degrees.

Sizes: duck under ~2.5 MB and ~30k triangles; each set piece under ~1 MB and ~10k triangles.
No Draco or meshopt compression (the scene uses the plain glTF loader).

## How the current models were made (Nov 2026)

- duck-guide.glb: ChatGPT image turned the logo into a rounded toy render (three-quarter view), Tripo Studio
  made it 3D (H3.5, 2K texture, 30k faces), then `tools/flatpaint.py` repainted it in the logo's flat colours
  (yellow, orange beak, black glasses, white glints) with no texture, and dropped stray seam strokes:
  `python tools/flatpaint.py in.glb public/models/duck-guide.glb "yellow=#FDD02F,orange=#F7931E,black=#141414,white=#FFF8E1,stroke=#8A8A8A" 3 3 "orange:150:1:0.7,black:40,white:4"`
- The four set pieces: Gemini image in the logo's style, then Tripo image to 3D (2K texture, about 10k faces).
- Generated models are made of overlapping shells, so they get an ink rim in their material instead of the
  inverted-hull outline the built-in shapes use. The duck's beak sits 45 degrees off +z (MODEL_YAW).
