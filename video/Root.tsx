import { Composition } from "remotion";
import { TeerKamanHit } from "./TeerKamanHit";
import { TeerKamanMiss } from "./TeerKamanMiss";
import { DalBadal } from "./DalBadal";
import { YourRole } from "./YourRole";

// 720x1440 = a tall phone (owner's phone is 442x884 CSS, the same 1:2), 30 fps
export const RemotionRoot = () => (
  <>
    <Composition
      id="YourRole"
      component={YourRole}
      durationInFrames={105}
      fps={30}
      width={720}
      height={1440}
      defaultProps={{ role: "kisaan", thief: false }}
    />
    <Composition id="TeerKamanHit" component={TeerKamanHit} durationInFrames={90} fps={30} width={720} height={1440} />
    <Composition id="TeerKamanMiss" component={TeerKamanMiss} durationInFrames={75} fps={30} width={720} height={1440} />
    <Composition id="DalBadal" component={DalBadal} durationInFrames={105} fps={30} width={720} height={1440} defaultProps={{ role: "chor" }} />
  </>
);
