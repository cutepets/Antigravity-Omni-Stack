import { ProductDetailView } from './_components/product-detail-view'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function ProductDetailPage({ params }: any) {
  const resolvedParams = await params
  
  return (
    <div className="flex-1 w-full flex flex-col h-full bg-background relative overflow-y-auto">
      <ProductDetailView productId={resolvedParams.id} />
    </div>
  )
}
