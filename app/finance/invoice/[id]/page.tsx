import { InvoicePreviewPage } from "./invoice-preview-page";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function InvoicePreviewRoute({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const autoPrint = sp?.autoPrint === "1" || sp?.autoPrint === "true";
  return <InvoicePreviewPage id={id} autoPrint={autoPrint} />;
}
