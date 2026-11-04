"use client";

import { useParams, useSearchParams } from "next/navigation";
import { RequestDetail } from "@/components/guard/request-detail";

export default function RequestPage() {
  const { id } = useParams<{ id: string }>();
  const replayed = useSearchParams().get("replayed") === "1";
  return <RequestDetail key={id} id={id} replayed={replayed} />;
}
