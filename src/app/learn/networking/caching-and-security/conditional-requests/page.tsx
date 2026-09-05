import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { ConditionalRequestsFigure } from "@/lessons/caching-and-security/conditional-requests-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("conditional-requests");

export default function ConditionalRequestsPage() {
  return (
    <Lesson slug="conditional-requests">
      <LessonSection id="validators">
        <Lead>
          When a cache lease expires, the data itself is rarely obsolete—it only requires validation.
        </Lead>
        <P>
          In HTTP caching, <Term>freshness</Term> (governed by `max-age`) and <Term>validity</Term> are distinct
          concerns. An API response or CSS stylesheet might have a conservative `max-age=60`, but the file on the
          server might not change for weeks. Blindly re-downloading the full payload whenever the 60-second lease
          elapses wastes mobile bandwidth, increases server CPU, and fills the network with redundant bytes.
        </P>
        <P>
          HTTP solves this with two conditional validators:
        </P>
        <P>
          1. <Term>Last-Modified / If-Modified-Since</Term>: A weak validator using a human timestamp with 1-second resolution.
        </P>
        <P>
          2. <Term>ETag / If-None-Match</Term>: A strong validator using an opaque cryptographic hash or version token
          (such as <code>ETag: &quot;3a8f2&quot;</code>). If even a single byte of the resource changes, the hash changes.
        </P>
      </LessonSection>

      <LessonSection id="not-modified-exchange">
        <TryThis>
          <LI>Observe the baseline with <Strong>conditional If-None-Match</Strong> enabled: after the first 50 KB download, subsequent polls send the cached ETag.</LI>
          <LI>Watch the server answer with <Strong>304 Not Modified</Strong>: the response carries only ~300 bytes of headers and zero body bytes.</LI>
          <LI>Notice that over six requests, total data transferred is only <Strong>51.5 KB</Strong> (saving <Strong>83%</Strong> of bandwidth) with an <Strong>83%</Strong> 304 response rate.</LI>
          <LI>Disable <Strong>conditional If-None-Match</Strong>: watch unconditional GETs re-download the 50 KB body every time, transferring <Strong>300 KB</Strong> with 0% bandwidth savings.</LI>
          <LI>Toggle <Strong>origin resource changed</Strong>: watch the ETag hash mismatch trigger a fresh 200 OK transfer to sync the new version.</LI>
        </TryThis>
        <ConditionalRequestsFigure />
        <Callout kind="insight">
          A `304 Not Modified` response has no body. It costs only a single round trip to confirm validity,
          allowing the browser to extend its local cache lifetime without paying the payload transfer penalty.
        </Callout>
      </LessonSection>

      <LessonSection id="bandwidth-savings">
        <Lead>
          ETags turn revalidation into a metadata exchange, preserving edge and origin capacity.
        </Lead>
        <P>
          In high-scale production systems, conditional validation is the secret to surviving traffic spikes.
          When millions of client applications wake up and check for updates, the overwhelming majority receive
          a 304 response.
        </P>
        <P>
          A 304 response requires almost zero serialization overhead from the server, consumes minimal egress
          bandwidth from cloud providers, and completes significantly faster over high-latency cellular networks
          because only a single packet traverses the downlink.
        </P>
        <P>
          Combined with `stale-while-revalidate`, conditional requests allow browsers to render cached content
          with zero user latency while quietly verifying with the origin in the background that nothing has changed.
        </P>
      </LessonSection>
    </Lesson>
  );
}
