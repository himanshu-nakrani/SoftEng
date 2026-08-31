import { TrackLanding, trackMetadata } from "@/components/navigation/TrackLanding";

const TRACK = "concurrency";

export const metadata = trackMetadata(TRACK);

export default function ConcurrencyPage() {
  return <TrackLanding trackSlug={TRACK} />;
}
