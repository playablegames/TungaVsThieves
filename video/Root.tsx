import { Composition } from "remotion";
import { TeerKamanHit } from "./TeerKamanHit";
import { TeerKamanMiss } from "./TeerKamanMiss";
import { DalBadal } from "./DalBadal";
import { YourRole } from "./YourRole";
import { HeraPheri } from "./HeraPheri";
import { Talashi } from "./Talashi";
import { Bhukamp, Faisla, FaislaResult, FinalVote, Kundli, NewRound, TeerKamanAim, VoteGift, Winner } from "./Moments";

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
    <Composition id="TeerKamanHit" component={TeerKamanHit} durationInFrames={60} fps={30} width={720} height={1440} />
    <Composition id="TeerKamanMiss" component={TeerKamanMiss} durationInFrames={75} fps={30} width={720} height={1440} />
    <Composition id="HeraPheri" component={HeraPheri} durationInFrames={60} fps={30} width={720} height={1440} />
    <Composition id="Talashi" component={Talashi} durationInFrames={60} fps={30} width={720} height={1440} />
    <Composition id="Kundli" component={Kundli} durationInFrames={60} fps={30} width={720} height={1440} />
    <Composition id="TeerKamanAim" component={TeerKamanAim} durationInFrames={60} fps={30} width={720} height={1440} />
    <Composition id="Faisla" component={Faisla} durationInFrames={60} fps={30} width={720} height={1440} />
    <Composition id="FaislaResult" component={FaislaResult} durationInFrames={60} fps={30} width={720} height={1440} defaultProps={{ out: true }} />
    <Composition id="Bhukamp" component={Bhukamp} durationInFrames={60} fps={30} width={720} height={1440} />
    <Composition id="VoteGift" component={VoteGift} durationInFrames={60} fps={30} width={720} height={1440} />
    <Composition id="NewRound" component={NewRound} durationInFrames={60} fps={30} width={720} height={1440} defaultProps={{ round: 2 }} />
    <Composition id="FinalVote" component={FinalVote} durationInFrames={75} fps={30} width={720} height={1440} defaultProps={{ stones: ["TUNGA"], to: "village" }} />
    <Composition id="Winner" component={Winner} durationInFrames={75} fps={30} width={720} height={1440} defaultProps={{ side: "village" }} />
    <Composition id="DalBadal" component={DalBadal} durationInFrames={105} fps={30} width={720} height={1440} defaultProps={{ role: "chor" }} />
  </>
);
