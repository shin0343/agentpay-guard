"use client";

import { useParams } from "next/navigation";
import { ReviewFocus } from "@/components/guard/review-focus";

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  return <ReviewFocus key={id} id={id} />;
}
