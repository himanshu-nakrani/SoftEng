"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { tlsHandshakeSim } from "./tls-handshake";

export function TlsHandshakeFigure() {
  return (
    <SectionFigure
      sim={tlsHandshakeSim}
      description="TODO: what a reader should watch for, in one or two sentences."
    />
  );
}
