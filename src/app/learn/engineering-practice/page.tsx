import { TrackLanding, trackMetadata } from "@/components/navigation/TrackLanding";

const TRACK = "engineering-practice";

export const metadata = trackMetadata(TRACK);

export default function EngineeringPracticePage() {
  return <TrackLanding trackSlug={TRACK} />;
}
