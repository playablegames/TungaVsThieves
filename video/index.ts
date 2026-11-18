// Remotion films for the big moments (2026-11-18, owner: "Remotion will make the game come alive").
// Rendered on the laptop to plain video files in public/video/ — the phone only PLAYS them, it never draws them.
//   npx remotion render video/index.ts YourRole public/video/role-kisaan.mp4 --props='{"role":"kisaan","thief":false}'
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
