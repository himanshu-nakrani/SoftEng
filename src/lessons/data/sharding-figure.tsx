"use client";

import { SectionFigure } from "@/components/lesson/SectionFigure";
import { shardingSim } from "./sharding";

export function ShardingFigure() {
  return (
    <SectionFigure
      sim={shardingSim}
      description="A router distributing keyed queries across shards using hash(key) mod N. A slider changes the shard count; the remapped meter shows what fraction of the keyspace changed owner after each change."
    />
  );
}
