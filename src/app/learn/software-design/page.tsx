import { TrackLanding, trackMetadata } from "@/components/navigation/TrackLanding";

const TRACK = "software-design";

export const metadata = trackMetadata(TRACK);

export default function SoftwareDesignPage() {
  return <TrackLanding trackSlug={TRACK} />;
}
