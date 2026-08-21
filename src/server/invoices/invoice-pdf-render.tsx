import "server-only";

import { createHash } from "node:crypto";
import { Readable } from "node:stream";

import { pdf } from "@react-pdf/renderer";

import type { InvoicePdfRenderModel } from "@/domain/invoices/pdf";
import { InvoicePdfDocument } from "@/server/invoices/invoice-pdf-document";

export type RenderedInvoicePdf = {
  readonly bytes: Uint8Array;
  readonly checksumSha256: string;
  readonly byteSize: number;
};

async function readableToUint8Array(stream: Readable): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return new Uint8Array(Buffer.concat(chunks));
}

/**
 * Render branded invoice PDF bytes with React-pdf (ADR-013).
 */
export async function renderInvoicePdfBytes(
  model: InvoicePdfRenderModel,
): Promise<RenderedInvoicePdf> {
  const instance = pdf(<InvoicePdfDocument model={model} />);
  const output = await instance.toBuffer();
  const bytes =
    output instanceof Uint8Array
      ? output
      : await readableToUint8Array(output as unknown as Readable);
  const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
  return {
    bytes,
    checksumSha256,
    byteSize: bytes.byteLength,
  };
}
