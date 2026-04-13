import { redirect } from 'next/navigation'

export default async function PetCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  redirect(`/pets?petId=${encodeURIComponent(code)}`)
}
