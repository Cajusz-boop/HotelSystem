import { InvoicePreviewPage } from "./invoice-preview-page";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function InvoicePreviewRoute({ params }: PageProps) {
  const { id } = await params;
  return <InvoicePreviewPage id={id} />;
}
