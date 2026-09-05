import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import { Callout, LI, Lead, P, Strong, Term, TryThis } from "@/components/lesson/prose";
import { MemoryLeakTriageFigure } from "@/lessons/resilience-engineering/memory-leak-triage-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("memory-leak-triage");

export default function MemoryLeakTriagePage() {
  return (
    <Lesson slug="memory-leak-triage">
      <LessonSection id="heap-growth">
        <Lead>
          A slow memory leak does not crash a service immediately — it steadily consumes heap space,
          forces the garbage collector into a CPU-choking thrashing loop, and ends in a sudden kernel OOM kill.
        </Lead>
        <P>
          In garbage-collected runtimes like Node.js, Go, or the JVM, memory leaks rarely stem from
          dangling pointers. Instead, they occur when live references prevent the runtime from reclaiming
          unreachable objects: unremoved event listeners on global singletons, unbounded in-memory request
          buffers, and growing cache maps that lack an eviction policy or TTL.
        </P>
        <P>
          As memory usage climbs past 85% of the container cgroup limit (<Term>memory.max</Term>), the
          runtime spends an increasing share of CPU cycles running full garbage collection cycles in a
          futile attempt to reclaim memory. This <Term>GC thrashing</Term> causes severe stop-the-world
          pauses, ballooning p99 latency before the memory limit is ever breached.
        </P>
        <P>
          When heap occupancy reaches 94%, an out-of-memory crash is imminent. At this inflection point,
          the on-call engineer faces a critical triage decision: how to remediate the outage without
          causing customer-facing connection drops or destroying the diagnostic data needed to find the root cause.
        </P>
      </LessonSection>

      <LessonSection id="triage-action">
        <TryThis>
          <LI>
            Move the slider to <Strong>Restart all service pods at once</Strong> — all pods terminate
            simultaneously, dropping between 350 and 500 in-flight requests and triggering a thundering cold
            start (0 of 200 runs hold SLA).
          </LI>
          <LI>
            Move the slider to <Strong>Wait for Kubernetes OOM-kill</Strong> — the Linux kernel sends an
            unblockable SIGKILL at 100% memory, resetting TCP sockets and dropping 180 to 260 requests with
            502 Bad Gateway errors (0 of 200 runs hold SLA).
          </LI>
          <LI>
            Move the slider to <Strong>Rolling drain, capture heap dump, and restart</Strong> — cordoning the
            pod, capturing a live profile, and draining in-flight requests preserves zero dropped requests
            across all 200 of 200 runs.
          </LI>
        </TryThis>
        <MemoryLeakTriageFigure />
        <Callout kind="insight">
          Panic-restarting the fleet drops 350 to 500 requests while a cold reboot thrashes dependencies.
          Waiting for the OOM killer drops 180 to 260 requests via abrupt TCP resets and destroys the heap
          evidence. Only a controlled rolling drain—cordoning the pod from ingress, capturing a diagnostic
          heap snapshot, and allowing in-flight connections to drain—achieves zero dropped requests (200/200 runs)
          while preserving the data required to fix the leak.
        </Callout>
      </LessonSection>

      <LessonSection id="graceful-drain">
        <Lead>
          Production resilience requires decoupling triage remediation from failure destruction: remove
          the instance from the routing mesh, capture diagnostics while memory is intact, and drain live traffic.
        </Lead>
        <P>
          When a pod is terminated abruptly or killed by the Linux cgroup OOM killer, the kernel delivers{" "}
          <Term>SIGKILL</Term> (signal 9). Runtimes cannot catch SIGKILL; no shutdown hooks execute,
          in-flight HTTP responses are abandoned mid-stream, active TCP sockets send a <code>RST</code> packet,
          and the heap state evaporates from RAM.
        </P>
        <P>
          A disciplined triage sequence follows four distinct stages:
        </P>
        <P>
          <Strong>1. Cordon and Isolate:</Strong> Fail the pod&apos;s readiness probe or remove its endpoints
          from the service mesh (e.g. <code>kubectl cordon</code> or endpoint slice deregistration). Ingress
          proxies stop routing new connections to the leaking pod while healthy replicas absorb incoming traffic.
        </P>
        <P>
          <Strong>2. Diagnostic Capture:</Strong> While the isolated pod is still running but free from new load,
          trigger an on-demand memory artifact capture—such as a V8 heap snapshot, Go <code>pprof</code> heap profile,
          or JVM <code>jcmd GC.heap_dump</code>. Because the pod is still alive, the retaining object graph is
          preserved for post-incident root cause analysis.
        </P>
        <P>
          <Strong>3. Graceful Draining:</Strong> Allow existing in-flight connections to complete up to the
          configured <Term>terminationGracePeriodSeconds</Term>. The web server sends <code>Connection: close</code>{" "}
          headers on active HTTP/1.1 connections and <code>GOAWAY</code> frames on HTTP/2 streams, ensuring
          every client request receives a clean response.
        </P>
        <P>
          <Strong>4. Rolling Replacement:</Strong> Kubernetes starts replacement pods, waits for their readiness
          checks to pass, and terminates the drained pod with <Term>SIGTERM</Term>. Capacity remains steady,
          zero requests are dropped, and engineers have the exact heap profile required to fix the underlying retention bug.
        </P>
      </LessonSection>
    </Lesson>
  );
}
