import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, Lead, P, Strong, Term } from "@/components/lesson/prose";
import { CachingFigure } from "@/lessons/data/caching-figure";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Caching",
};

export default function CachingPage() {
  return (
    <Lesson slug="caching">
      <LessonSection id="why-cache">
        <Lead>
          Your database can answer any question — in 400 milliseconds. Your
          users expect 60. The gap is bridged by remembering answers:{" "}
          a <Term>cache</Term>.
        </Lead>
        <P>
          A cache is a small, fast memory in front of a large, slow truth.
          The entire game is the <Strong>hit ratio</Strong> — the fraction of
          reads answered without waking the database. Real traffic makes
          this winnable: access patterns are wildly skewed, so a cache
          holding a handful of hot keys can absorb most of the read load.
        </P>
      </LessonSection>

      <LessonSection id="tune-it">
        <P>
          Green packets are hits; amber ones are misses making the long trip
          to <Term>pg-main</Term>. The chip on <Term>redis-1</Term> counts
          the keys it currently holds. You have two knobs —{" "}
          <Term>cache size</Term> and <Term>ttl</Term> — and one dial to
          win: hit ratio.
        </P>
        <CachingFigure />
        <Callout kind="insight">
          Watch <Term>db load</Term> as the hit ratio climbs. Every point of
          hit ratio is load the database never sees — caches don&apos;t just
          make reads fast, they&apos;re what keeps the database alive under
          read-heavy traffic.
        </Callout>
      </LessonSection>

      <LessonSection id="eviction">
        <P>
          A full cache must forget something to learn something:{" "}
          <Strong>eviction</Strong>. This sim evicts the least-recently-used
          key — the safe default, because recent past predicts near future.{" "}
          <Strong>TTL</Strong> is the other forgetting mechanism: entries
          expire on a clock, bounding how stale a cached answer can get.
        </P>
        <P>
          That&apos;s the quiet trade you made when you tuned the sliders:
          bigger + longer = faster and staler; smaller + shorter = fresher
          and slower. There is no setting that gives you both. Caching is
          the art of choosing which lie you can afford.
        </P>
        <Callout kind="warning">
          The two hardest problems here are famous for a reason: cache
          invalidation (knowing <em>when</em> the truth changed) and the
          thundering herd (a hot key expiring and a thousand misses
          stampeding the database at once).
        </Callout>
      </LessonSection>

    </Lesson>
  );
}
