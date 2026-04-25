import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from '@/components/layout/PageLayout'
import { GroomingBoard } from "./_components/grooming-board";

export const metadata: Metadata = {
  title: "✂️ Grooming",
  description: "Bảng điều phối SPA & grooming",
};

export default function GroomingPage() {
  return (
    <PageContainer
      maxWidth="full"
      className="!gap-0 !py-4"
    >
      <Suspense fallback={<div className="p-4">Đang tải cấu trúc bảng grooming...</div>}>
        <GroomingBoard />
      </Suspense>
    </PageContainer>
  );
}
