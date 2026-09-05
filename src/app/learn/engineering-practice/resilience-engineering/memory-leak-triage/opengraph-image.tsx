import { lessonOg } from "@/lib/og";

const og = lessonOg("memory-leak-triage");

export const { alt, size, contentType, dynamic } = og;
export default og.image;
