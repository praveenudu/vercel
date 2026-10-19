import { client } from "./api";

export async function uploadFile(file: File) {
  const { url, key } = await client.files.presign({ filename: file.name, contentType: file.type || "application/octet-stream" });
  const res = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
  if (!res.ok) throw new Error("Upload failed");
  return { key, name: file.name, size: file.size, contentType: file.type };
}

export async function openFile(key: string, filename?: string) {
  const { url } = await client.files.url({ key, filename });
  window.open(url, "_blank");
}

/** Opens a stored document (presigned file, or the e-signed lease print view). */
export async function openDocument(id: number) {
  const { url } = await client.documents.open({ id });
  if (url) window.open(url, "_blank");
}
