/* The sculpt, carried as base64 in modules beside this one.

   A published artifact serves pages, styles, scripts, images, fonts and media --
   not .glb -- so the bytes travel as script, which it does serve. Base64 is a third
   larger than the file and a text file may be 16MB, so it arrives in two pieces.
   The browser's own base64 decoder does the work, through a data: URL per piece, and
   the pieces are joined as one Blob rather than copied into an array by hand. */
import { part as part1 } from './dragon-model-1.mjs';
import { part as part2 } from './dragon-model-2.mjs';

let url;
export async function modelUrl() {
  if (url) return url;
  const pieces = await Promise.all([part1, part2].map(
    s => fetch('data:application/octet-stream;base64,' + s).then(r => r.blob())));
  return (url = URL.createObjectURL(new Blob(pieces, { type: 'model/gltf-binary' })));
}
