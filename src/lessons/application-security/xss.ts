import { INJECT_COUNTERS, runXss } from "@/engine/algo/inject";
import type { AlgoDef } from "@/engine/algo/types";
import type { InjectState } from "@/engine/algo/views/inject";

/**
 * Cross-Site Scripting — archetype B (`engine: "steps"`).
 *
 * A greeting interpolates a name. Ada is a text node either way. The
 * payload `<script>` is a script node when concatenated as HTML, and a
 * text node when encoded first. The figure never executes it: the
 * payload is a chip, counted by `scripts`.
 *
 * THE CONTROL IS THE PAYLOAD INDEX. 0 = Ada, 1 = `<script>`, default 1.
 * Measured: raw 0 and encode 0 both stamp text, scripts 0. Raw 1: scripts
 * 1, ok false, stamp script, note "Raw payload becomes a script node."
 * Encode 1: scripts 0, ok true, stamp text, result `&lt;script&gt;`,
 * note "Encoded payload stays text." First note on payload 1 is
 * "Hello, <script>." Seed is ignored.
 *
 * MODELLING NOTE, and its limits. Encoding means the payload stayed a
 * text node, not that a sanitizer ran. Deliberately absent: a browser,
 * DOMPurify, CSP, innerHTML vs textContent as APIs. Those change how
 * you ship HTML. They do not change the argument: concatenating into
 * markup lets input become a script node; encoding keeps it text.
 */

const RAW_CODE = ['"Hello, " + name'];

const ENCODE_CODE = ["t = encode(name)", '"Hello, " + t'];

const sizeControl = {
  label: "payload",
  min: 0,
  max: 1,
  default: 1,
};

const counters = [{ key: INJECT_COUNTERS.scripts, label: "scripts" }];

function def(
  id: string,
  title: string,
  encode: boolean,
  code: string[],
): AlgoDef<InjectState, number> {
  return {
    id,
    title,
    code,
    counters,
    size: sizeControl,
    generateInput: (_rng, size) => size,
    run: (size) => runXss(encode, size),
  };
}

/** Concatenate the name as HTML. Payload 1 becomes a script node. */
export const xssAlgo = def("xss", "raw HTML", false, RAW_CODE);

/** Encode the name first. The same payload stays a text node. */
export const xssEncodeAlgo = def("xss-encode", "encoded", true, ENCODE_CODE);
