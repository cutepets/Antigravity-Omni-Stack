import { PetList } from '../../pets/_components/pet-list'

export default async function PetCodePage({ params }: { params: Promise<{ code: string }> }) {
  await params // For Next.js 15
  return <PetList />
}
