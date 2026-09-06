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
  AbacFigure,
  RbacFigure,
} from "@/lessons/defense-in-depth/rbac-vs-abac-figure";
import { lessonMetadata } from "@/lib/curriculum";

export const metadata = lessonMetadata("rbac-vs-abac");

export default function RbacVsAbacPage() {
  return (
    <Lesson slug="rbac-vs-abac">
      <LessonSection id="the-action">
        <Lead>
          Does the role grant the write, or do the attributes?
        </Lead>
        <P>
          The action is one write: <Term>doc1</Term>, owned by{" "}
          <Strong>bob</Strong>. Three subjects try it.{" "}
          <Term>alice</Term> is an admin and does not own the doc.{" "}
          <Term>bob</Term> is an editor and owns it.{" "}
          <Term>mallory</Term> is an editor and does not. The slider is
          which of those three is asking — <Strong>0</Strong>,{" "}
          <Strong>1</Strong>, or <Strong>2</Strong>. Default{" "}
          <Strong>2</Strong> is mallory, because that is the subject the
          two policies disagree on.
        </P>
        <P>
          This is a toy of two rules. There is no role hierarchy and no
          deny-override. <Term>RBAC</Term> asks whether the role is
          allowed to write. <Term>ABAC</Term> asks whether the subject is
          the admin or the owner. <Term>Horizontal escalation</Term> is a
          grant that is not admin and not owner: allowed, and the wrong
          person.
        </P>
        <Compare>
          <CompareCol title="RBAC">
            Role grants the write. Admin writes. Editor writes. Mallory
            is an editor, so she writes doc1. allowed{" "}
            <Strong>1</Strong>, escalation <Strong>1</Strong>.
          </CompareCol>
          <CompareCol title="ABAC">
            Attributes grant the write. Admin writes. Owner writes.
            Mallory is neither, so she is denied. allowed{" "}
            <Strong>0</Strong>, escalation <Strong>0</Strong>.
          </CompareCol>
        </Compare>
      </LessonSection>

      <LessonSection id="rbac">
        <TryThis>
          <LI>
            Leave subject at <Strong>2</Strong>. The first caption is
            &quot;mallory writes doc1.&quot;
          </LI>
          <LI>
            Step. &quot;mallory role=editor owner=no.&quot; Then
            &quot;RBAC: editor writes.&quot; The editor rule fires
            because her role is editor.
          </LI>
          <LI>
            Last frame: &quot;mallory writes a doc they do not own.&quot;
            The stamp reads <Strong>escalation</Strong>. allowed is{" "}
            <Strong>1</Strong>, escalation is <Strong>1</Strong>.
          </LI>
          <LI>
            Drag to <Strong>0</Strong> (alice) and <Strong>1</Strong>{" "}
            (bob). Both allow. allowed <Strong>1</Strong>, escalation{" "}
            <Strong>0</Strong>, stamp <Strong>allow</Strong>.
          </LI>
        </TryThis>
        <RbacFigure />
        <Callout kind="insight">
          RBAC answered with a role. Mallory is an editor, so the write
          is allowed. The meter that moved is escalation, not a second
          kind of deny.
        </Callout>
      </LessonSection>

      <LessonSection id="abac">
        <TryThis>
          <LI>
            Leave subject at <Strong>2</Strong>. Same first captions:
            &quot;mallory writes doc1.&quot; then &quot;mallory
            role=editor owner=no.&quot;
          </LI>
          <LI>
            Step to the rules. &quot;ABAC: no rule fires.&quot; Last
            frame: &quot;mallory is denied.&quot; The stamp reads{" "}
            <Strong>deny</Strong>. allowed is <Strong>0</Strong>,
            escalation is <Strong>0</Strong>.
          </LI>
          <LI>
            Drag to <Strong>0</Strong> and <Strong>1</Strong>. Alice
            (admin) and bob (owner) are allowed under both. allowed{" "}
            <Strong>1</Strong>, escalation <Strong>0</Strong>.
          </LI>
        </TryThis>
        <AbacFigure />
        <Callout kind="insight">
          ABAC answered with who owns the row. Alice is still allowed
          because she is admin. Bob is still allowed because he owns
          doc1. Mallory is not — the same editor role is no longer
          enough.
        </Callout>
        <Callout kind="warning">
          Two rules, no role hierarchy, no deny-overrides. A real PDP
          would nest roles and combine permits with denies. Those change
          the table. They do not change the argument: a role grant that
          ignores ownership is horizontal escalation, counted here as
          allowed 1 with escalation 1.
        </Callout>
      </LessonSection>
    </Lesson>
  );
}
