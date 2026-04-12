import { redirect } from 'next/navigation'

export default function RedirectToModal({ params }: { params: { id: string } }) {
  redirect(`/pets?petId=${params.id}`)
}
