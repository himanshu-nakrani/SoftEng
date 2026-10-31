import { Lesson } from "@/components/lesson/Lesson";
import { LessonSection } from "@/components/lesson/LessonSection";
import {
  Callout,
  Compare,
  CompareCol,
  LI,
  Lead,
  P,
  Strong,
  Term,
  TryThis,
} from "@/components/lesson/prose";
import {
  EncodeFigure,
  RawFigure,
} from "@/lessons/application-security/xss-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("xss");

export default function XssPage() {
  return (
    <Lesson slug="xss">
      <LessonSection id="text-or-script">
        <Lead>
          The name is not HTML. A greeting interpolates a string. Whether
          that string becomes a text node or a script node is the whole
          lesson.
        </Lead>
        <P>
          Concatenating a name into HTML lets the input become a{" "}
          <Term>script</Term> node. Encoding keeps it a <Term>text</Term>{" "}
          node. Ada is text. The payload <Term>{"<script>"}</Term> is also
          a string until the page treats it as markup.
        </P>
        <P>
          This page never runs the payload. The figure draws it as a chip.
          Encoding here is not a sanitizer: it means the payload stayed a
          text node.
        </P>
      </LessonSection>

      <LessonSection id="raw">
        <P>
          The slider is the payload, 0 or 1. Default <Strong>1</Strong> is
          the string <Term>{"<script>"}</Term>. Payload <Strong>0</Strong>{" "}
          is Ada.
        </P>
        <TryThis>
          <LI>
            Leave payload at <Strong>1</Strong>. The first caption is
            &quot;Hello, {"<script>"}.&quot;
          </LI>
          <LI>
            Step. <Term>scripts</Term> is <Strong>1</Strong>. The stamp
            reads <Strong>script</Strong>. The last caption: &quot;Raw
            payload becomes a script node.&quot;
          </LI>
          <LI>
            Drag to <Strong>0</Strong>. Ada is a text node. scripts is{" "}
            <Strong>0</Strong>. The stamp reads <Strong>text</Strong>.
          </LI>
        </TryThis>
        <RawFigure />
        <Callout kind="insight">
          Raw <Term>{"<script>"}</Term> becomes a script node (scripts{" "}
          <Strong>1</Strong>). The chip is tainted. Nothing ran.
        </Callout>
      </LessonSection>

      <LessonSection id="encoded">
        <P>
          Same greeting, same slider. The name is encoded before it is
          concatenated, so a payload that looks like markup stays a text
          node.
        </P>
        <TryThis>
          <LI>
            Leave payload at <Strong>1</Strong>. The first caption is
            still &quot;Hello, {"<script>"}.&quot;
          </LI>
          <LI>
            Step. scripts is <Strong>0</Strong>. The stamp reads{" "}
            <Strong>text</Strong>. The DOM chip is{" "}
            <Term>{"&lt;script&gt;"}</Term>. The last caption: &quot;Encoded
            payload stays text.&quot;
          </LI>
          <LI>
            Drag to <Strong>0</Strong>. Payload 0 is Ada, text, both
            figures. scripts stays <Strong>0</Strong>.
          </LI>
        </TryThis>
        <EncodeFigure />
        <Compare>
          <CompareCol title="raw · payload 1">
            Concatenated as HTML. scripts <Strong>1</Strong>, stamp{" "}
            <Strong>script</Strong>, ok false. A script node.
          </CompareCol>
          <CompareCol title="encoded · payload 1">
            Encoded first. scripts <Strong>0</Strong>, stamp{" "}
            <Strong>text</Strong>, ok true. Result{" "}
            <Term>{"&lt;script&gt;"}</Term>. Still text.
          </CompareCol>
        </Compare>
        <Callout kind="insight">
          Ada is a text node either way (scripts <Strong>0</Strong>).
          Encoded, the same payload stays text as{" "}
          <Term>{"&lt;script&gt;"}</Term> (scripts <Strong>0</Strong>).
        </Callout>
        <Callout kind="warning">
          This figure never executes a script. The payload is a chip. This
          is not a browser sanitizer lesson; encoding means the payload
          stayed a text node.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
