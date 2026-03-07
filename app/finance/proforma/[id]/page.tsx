import { ProformaPreviewPage } from "./proforma-preview-page";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProformaPreviewRoute({ params }: PageProps) {
  const { id } = await params;
  return <ProformaPreviewPage id={id} />;
}
