import { redirect } from 'next/navigation'

export default async function RedirectToModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/pets?petId=${encodeURIComponent(id)}`)
}
