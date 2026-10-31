"use client";

import { SectionAlgoFigure } from "@/components/lesson/SectionAlgoFigure";
import { InodeView } from "@/engine/algo/views/InodeView";
import { inodeAlgo, inodeDirectAlgo } from "./inode";

/**
 * The RSC boundary: an AlgoDef carries functions, so the server page imports
 * these wrappers rather than the defs. This is also the only place allowed to
 * name a view COMPONENT.
 */
export function InodeDirectFigure() {
  return (
    <SectionAlgoFigure
      def={inodeDirectAlgo}
      view={InodeView}
      description="A four-block file named by four direct pointers. Step through d0, d1, d2, d3: each block is inode then data. Meters land on 4 inode reads, 4 data reads, 0 pointer reads. Drag past 4 to watch the first pointer read appear."
    />
  );
}

export function InodeIndirectFigure() {
  return (
    <SectionAlgoFigure
      def={inodeAlgo}
      view={InodeView}
      description="A five-block file, the first that needs the indirect block. The first four blocks are still direct; block 4 is i0 and costs one extra pointer read. Drag to 8: four pointer reads, eight data reads, eight inode reads."
    />
  );
}
