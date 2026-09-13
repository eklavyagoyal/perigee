# Cinematic scroll footage — production brief

Use the following prompt with your chosen video generator. Deliver a clean master file, not a screen recording. No API or generation provider is required by the website.

## Ready-to-copy prompt

Create a photorealistic cinematic shot for a scroll-controlled spacecraft-safety website. One continuous, uncut camera move, approximately 12–15 seconds, landscape 16:9, highest available resolution. Begin with a clearly identifiable satellite in low Earth orbit: a compact gold thermal-foil body, two symmetrical dark-blue solar arrays, and a small communications dish. Frame the satellite in the right half of the image, leaving the left half uncluttered for website text. Below it, show Earth’s curved horizon, detailed clouds, deep-blue oceans, and a thin blue atmospheric rim against black space.

During the first quarter, the spacecraft is stable and intact. The camera then follows the same spacecraft as it descends toward Earth. Introduce a subtle loss of attitude stability, followed by progressively stronger atmospheric heating. Show physically inspired plasma glow and a long, turbulent incandescent wake only as atmospheric entry develops—not ordinary fire burning in vacuum. Solar panels bend and detach; the heated spacecraft breaks into glowing fragments that fade into the atmosphere. Keep the satellite’s design and proportions consistent until breakup.

In the final quarter, continue the camera move downward through atmospheric haze and layered clouds. End on a calm, dark blue view within the atmosphere, with generous negative space in the centre for a final message. Hold this clean ending for approximately two seconds.

Visual style: premium aerospace cinematography, realistic materials and lighting, restrained colour grading, dramatic but credible scale, smooth deliberate camera motion. This is an illustrative, time-compressed re-entry sequence, not a reconstruction of a real mission. No cuts, no sudden camera jumps, no replacement spacecraft, no duplicated solar arrays, no explosions like a Hollywood fireball, no text, no subtitles, no logos, no interface, no watermarks. Every frame must be usable as a sharp still image; avoid heavy motion blur.

## Delivery and approval checklist

- Original MP4 or MOV; 1920 × 1080 minimum, 4K preferred if available; 24 or 30 fps.
- Keep typography out of the video. The website supplies accessible, responsive React text and buttons.
- No audio is needed for a scroll-controlled sequence.
- Inspect several still frames: one stable spacecraft, consistent structure, no premature fire in vacuum, no malformed panels, no unplanned jump cuts.
- Preserve a clean two-second ending; don't finish on a bright explosion or an abrupt black cut.
- Deliver a separate 9:16 version if possible. Move the spacecraft into the lower-middle area and leave the upper third clear for mobile copy. A centre crop of the right-aligned desktop version will often cut the spacecraft off.
- If the generator only produces shorter clips, split into orbit / entry / clouds, using matching reference frames and camera direction. Review the joins before exporting the master.

## Website handoff

The current procedural scene stays active until the footage is approved. From `web/`, convert an approved video with `npm run frames -- /absolute/path/master.mp4 --name descent-v1`. Add `--mobile /absolute/path/portrait.mp4` for a matching portrait master. Then set `NEXT_PUBLIC_SCENE_MANIFEST=/sequences/descent-v1/manifest.json` in `.env.local` and restart/rebuild. The resulting image sequence is consumed by the scroll renderer; a separate film page or video-player UI is not required. The original text-baked showcase film is not suitable as the master.

For close alignment with the existing text chapters, aim for stable orbit at 0–20% of the clip, a first attitude deviation at 20–43%, visible entry heating at 43–64%, breakup at 64–84%, and the clean atmospheric ending at 84–100%. These are editorial timing targets, not a realistic orbital timeline.
