import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageLayout";
import { GroomingBoard } from "./_components/grooming-board";

export const metadata: Metadata = {
  title: "Grooming | Petshop",
  description: "Bảng điều phối SPA & grooming",
};

export default function GroomingPage() {
  return (
    <PageContainer
      maxWidth="full"
      className="!h-full !min-h-0 !gap-0 !overflow-hidden !py-4"
    >
      <GroomingBoard />
    </PageContainer>
  );
}
