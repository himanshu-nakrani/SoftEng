import { lessonOg } from "@/lib/og";

const og = lessonOg("page-faults");

export const { alt, size, contentType, dynamic } = og;
export default og.image;
